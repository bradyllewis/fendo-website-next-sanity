'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import {
  getTournamentRoster,
  type RosterEntry,
  type RosterMember,
  type RosterMemberSource,
} from '@/lib/tournamentRoster'

// ─── Types ──────────────────────────────────────────────────────────────────

export type MoveDestination =
  | { kind: 'existingTeam'; teamId: string }
  | { kind: 'newTeam'; name: string; teamSize: number }
  | { kind: 'solo' }

export interface MemberRef {
  sourceTable: RosterMemberSource
  sourceId: string
  linkedRegistrationId: string | null
}

export interface MoveOptions {
  /** Replacement captain for each source team left captain-less, keyed by team id. */
  newCaptainByTeamId: Record<string, MemberRef>
  /** Admin acknowledged that a destination team will exceed max_members. */
  confirmOverflow: boolean
  /** Team ids the admin acknowledged will be emptied and soft-cancelled. */
  confirmEmptyTeams: string[]
  /** For destination `newTeam`: which moved player becomes captain. */
  newTeamCaptain?: MemberRef
}

export interface MoveResult {
  error?: string
  moved: number
  failed: { sourceId: string; reason: string }[]
  notes: string[]
}

const INACTIVE_SLOT_STATUSES = ['expired', 'cancelled']
const PAID_SLOT_STATUSES = ['paid', 'claimed', 'captain_registered']

type AdminDb = ReturnType<typeof createAdminClient>

// ─── Auth ───────────────────────────────────────────────────────────────────

async function requireAdmin(): Promise<{ ok: true; email: string } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthenticated' }

  const adminDb = createAdminClient()
  const { data: profile } = await adminDb
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') return { error: 'Forbidden' }
  return { ok: true, email: user.email ?? 'unknown admin' }
}

function revalidateRoster(eventSanityId: string) {
  revalidatePath(`/admin/tournaments/${eventSanityId}/teams`)
  revalidatePath('/admin/registrations')
  revalidatePath('/admin/teams')
}

// ─── Team status ────────────────────────────────────────────────────────────

/**
 * Recomputes `teams.team_status` from the team's ACTIVE members only, using
 * the same definition of "active" as getTournamentRoster. Expired and
 * cancelled rows are absent from the calculation and never drag a team down.
 *
 * Never writes 'expired' — that value belongs to the expiry cron.
 */
async function recalcTeamStatus(db: AdminDb, teamId: string): Promise<void> {
  const [slotsRes, regsRes] = await Promise.all([
    db.from('registration_slots').select('status').eq('team_id', teamId),
    db.from('event_registrations').select('status, registration_slot_id').eq('team_id', teamId),
  ])

  const activeSlots = (slotsRes.data ?? []).filter(
    (s) => !INACTIVE_SLOT_STATUSES.includes(s.status),
  )
  // Only non-mirror regs are members in their own right.
  const activeRegs = (regsRes.data ?? []).filter(
    (r) => !r.registration_slot_id && (r.status === 'paid' || r.status === 'pending'),
  )

  const total = activeSlots.length + activeRegs.length
  if (total === 0) {
    await db.from('teams').update({ team_status: 'cancelled' }).eq('id', teamId)
    return
  }

  const paid =
    activeSlots.filter((s) => PAID_SLOT_STATUSES.includes(s.status)).length +
    activeRegs.filter((r) => r.status === 'paid').length

  const status = paid === total ? 'complete' : paid > 0 ? 'partially_paid' : 'pending'
  await db.from('teams').update({ team_status: status }).eq('id', teamId)
}

// ─── Roster lookup helpers ──────────────────────────────────────────────────

/**
 * Finds a member in the roster by its source table + id.
 *
 * NOT exported: this file carries the `'use server'` directive, and Next.js
 * requires every export from such a file to be an async function. A synchronous
 * export here is a build error. Type-only exports are erased and are fine.
 */
function findMember(
  roster: RosterEntry[],
  ref: MemberRef,
): { entry: RosterEntry; member: RosterMember } | null {
  for (const entry of roster) {
    for (const member of entry.members) {
      if (member.sourceTable === ref.sourceTable && member.sourceId === ref.sourceId) {
        return { entry, member }
      }
    }
  }
  return null
}

// ─── Per-member writes ──────────────────────────────────────────────────────

interface DestTeamContext {
  teamId: string
  teamName: string
  registrationType: string
  inviteCode: string | null
  /** auth user id of the destination team's captain, or null. */
  captainUserId: string | null
}

/**
 * Moves one member onto a destination team (or to solo when `dest` is null).
 *
 * Writes ONLY team membership, ownership and captaincy. Member status,
 * amounts, and every stripe_* column are left exactly as they were.
 */
async function applyMemberMove(
  db: AdminDb,
  member: RosterMember,
  dest: DestTeamContext | null,
  isCaptain: boolean,
  adminEmail: string,
  fromTeamName: string | null,
): Promise<string | null> {
  const historyEntry = {
    at: new Date().toISOString(),
    action: dest ? 'moved_to_team' : 'detached_to_solo',
    from: fromTeamName,
    to: dest?.teamName ?? null,
    by: adminEmail,
  }

  const mergeHistory = (metadata: unknown) => {
    const base =
      metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>) : {}
    const prior = Array.isArray(base.adminHistory) ? base.adminHistory : []
    return { ...base, adminHistory: [...prior, historyEntry] }
  }

  if (member.sourceTable === 'registration_slots') {
    if (!dest) return 'Slot members cannot be detached to solo directly'

    const { data: existing } = await db
      .from('registration_slots')
      .select('metadata')
      .eq('id', member.sourceId)
      .maybeSingle()

    const { error } = await db
      .from('registration_slots')
      .update({
        team_id: dest.teamId,
        invited_by_user_id: dest.captainUserId,
        is_captain: isCaptain,
        metadata: mergeHistory(existing?.metadata),
      })
      .eq('id', member.sourceId)
    if (error) return error.message

    // Keep the mirrored ledger row in sync.
    if (member.linkedRegistrationId) {
      const { data: mirror } = await db
        .from('event_registrations')
        .select('metadata')
        .eq('id', member.linkedRegistrationId)
        .maybeSingle()

      const meta = mergeHistory(mirror?.metadata) as Record<string, unknown>
      meta.teamId = dest.teamId
      meta.inviteCode = dest.inviteCode

      await db
        .from('event_registrations')
        .update({
          team_id: dest.teamId,
          team_name: dest.teamName,
          registration_type: dest.registrationType,
          is_captain: isCaptain,
          metadata: meta,
        })
        .eq('id', member.linkedRegistrationId)
    }
    return null
  }

  // Registration-canonical member (solo, or a captain_pays_all captain).
  const { data: existing } = await db
    .from('event_registrations')
    .select('metadata')
    .eq('id', member.sourceId)
    .maybeSingle()

  const meta = mergeHistory(existing?.metadata) as Record<string, unknown>
  meta.teamId = dest?.teamId ?? null
  meta.inviteCode = dest?.inviteCode ?? null

  const { error } = await db
    .from('event_registrations')
    .update({
      team_id: dest?.teamId ?? null,
      team_name: dest?.teamName ?? null,
      registration_type: dest ? dest.registrationType : 'individual',
      is_captain: dest ? isCaptain : false,
      metadata: meta,
    })
    .eq('id', member.sourceId)

  return error ? error.message : null
}

/** auth user id of a team's current captain, for slot ownership rewrites. */
async function resolveCaptainUserId(db: AdminDb, teamId: string): Promise<string | null> {
  const { data: captainSlot } = await db
    .from('registration_slots')
    .select('app_user_id')
    .eq('team_id', teamId)
    .eq('is_captain', true)
    .maybeSingle()
  if (captainSlot?.app_user_id) return captainSlot.app_user_id

  const { data: captainReg } = await db
    .from('event_registrations')
    .select('user_id')
    .eq('team_id', teamId)
    .eq('is_captain', true)
    .maybeSingle()
  return captainReg?.user_id ?? null
}

/** Sets exactly one captain on a team and repoints slot ownership to them. */
async function promoteCaptain(db: AdminDb, teamId: string, ref: MemberRef): Promise<void> {
  await db.from('registration_slots').update({ is_captain: false }).eq('team_id', teamId)
  await db.from('event_registrations').update({ is_captain: false }).eq('team_id', teamId)

  if (ref.sourceTable === 'registration_slots') {
    await db.from('registration_slots').update({ is_captain: true }).eq('id', ref.sourceId)
    if (ref.linkedRegistrationId) {
      await db
        .from('event_registrations')
        .update({ is_captain: true })
        .eq('id', ref.linkedRegistrationId)
    }
  } else {
    await db.from('event_registrations').update({ is_captain: true }).eq('id', ref.sourceId)
  }

  const captainUserId = await resolveCaptainUserId(db, teamId)
  await db
    .from('registration_slots')
    .update({ invited_by_user_id: captainUserId })
    .eq('team_id', teamId)
}

// ─── movePlayers ────────────────────────────────────────────────────────────

export async function movePlayers(
  eventSanityId: string,
  members: MemberRef[],
  destination: MoveDestination,
  options: MoveOptions,
): Promise<MoveResult> {
  const check = await requireAdmin()
  if ('error' in check) return { error: check.error, moved: 0, failed: [], notes: [] }

  if (members.length === 0) {
    return { error: 'No players selected', moved: 0, failed: [], notes: [] }
  }

  const db = createAdminClient()
  const roster = await getTournamentRoster(eventSanityId)

  // Resolve every selected member against the live roster.
  const resolved: { ref: MemberRef; member: RosterMember; entry: RosterEntry }[] = []
  for (const ref of members) {
    const hit = findMember(roster, ref)
    if (!hit) {
      return {
        error: 'A selected player is no longer on this roster. Reload and try again.',
        moved: 0,
        failed: [],
        notes: [],
      }
    }
    resolved.push({ ref, member: hit.member, entry: hit.entry })
  }

  // Volunteers must never be moved — a move rewrites registration_type, which
  // would convert them into a counted player and change spots-filled.
  const regSourceIds = resolved
    .map((r) => (r.member.sourceTable === 'event_registrations' ? r.member.sourceId : null))
    .filter((id): id is string => !!id)
  if (regSourceIds.length > 0) {
    const { data: volunteerCheck } = await db
      .from('event_registrations')
      .select('id')
      .in('id', regSourceIds)
      .eq('registration_type', 'volunteer')
    if ((volunteerCheck ?? []).length > 0) {
      return { error: 'Volunteers cannot be moved between teams', moved: 0, failed: [], notes: [] }
    }
  }

  const notes: string[] = []
  let dest: DestTeamContext | null = null

  if (destination.kind === 'existingTeam') {
    const { data: team } = await db
      .from('teams')
      .select(
        'id, event_sanity_id, team_name, registration_type, invite_code, max_members, team_status',
      )
      .eq('id', destination.teamId)
      .maybeSingle()

    if (!team) return { error: 'Destination team not found', moved: 0, failed: [], notes: [] }
    if (team.event_sanity_id !== eventSanityId) {
      return {
        error: 'Destination team belongs to a different tournament',
        moved: 0,
        failed: [],
        notes: [],
      }
    }
    if (team.team_status === 'cancelled' || team.team_status === 'expired') {
      return { error: 'Destination team is cancelled or expired', moved: 0, failed: [], notes: [] }
    }

    // Capacity check against the live roster.
    const destEntry = roster.find((e) => e.teamId === team.id)
    const incoming = resolved.filter((r) => r.entry.teamId !== team.id).length
    const projected = (destEntry?.members.length ?? 0) + incoming
    if (projected > team.max_members) {
      if (!options.confirmOverflow) {
        return {
          error: `This would put ${projected} players on a team sized for ${team.max_members}. Confirm to raise the team size.`,
          moved: 0,
          failed: [],
          notes: [],
        }
      }
      await db.from('teams').update({ max_members: projected }).eq('id', team.id)
      notes.push(`Raised ${team.team_name} size to ${projected}.`)
    }

    dest = {
      teamId: team.id,
      teamName: team.team_name,
      registrationType: team.registration_type,
      inviteCode: team.invite_code,
      captainUserId: await resolveCaptainUserId(db, team.id),
    }
  }

  return await executeMoves(
    db,
    eventSanityId,
    roster,
    resolved,
    dest,
    destination,
    options,
    check.email,
    notes,
  )
}

/**
 * Applies the resolved moves, then repairs every affected team: captain
 * reassignment, status recalculation, and soft-cancelling emptied teams.
 *
 * Not transactional. Because dedup is structural, `team_id` does not affect
 * whether a player is counted, so a partially applied move is cosmetic and
 * re-running repairs it.
 */
async function executeMoves(
  db: AdminDb,
  eventSanityId: string,
  roster: RosterEntry[],
  resolved: { ref: MemberRef; member: RosterMember; entry: RosterEntry }[],
  dest: DestTeamContext | null,
  destination: MoveDestination,
  options: MoveOptions,
  adminEmail: string,
  notes: string[],
): Promise<MoveResult> {
  const sourceTeamIds = new Set(
    resolved.map((r) => r.entry.teamId).filter((id): id is string => !!id),
  )

  // Captain vacancy / emptied-team checks on every source team.
  for (const teamId of sourceTeamIds) {
    if (dest && teamId === dest.teamId) continue
    const entry = roster.find((e) => e.teamId === teamId)
    if (!entry) continue
    const leaving = new Set(
      resolved.filter((r) => r.entry.teamId === teamId).map((r) => r.member.sourceId),
    )
    const remaining = entry.members.filter((m) => !leaving.has(m.sourceId))
    const losingCaptain = entry.members.some((m) => leaving.has(m.sourceId) && m.isCaptain)

    if (losingCaptain && remaining.length > 0 && !options.newCaptainByTeamId[teamId]) {
      return {
        error: `${entry.teamName ?? 'A team'} would be left without a captain. Choose a replacement.`,
        moved: 0,
        failed: [],
        notes: [],
      }
    }
    if (remaining.length === 0 && !options.confirmEmptyTeams.includes(teamId)) {
      return {
        error: `${entry.teamName ?? 'A team'} would be left with no players. Confirm to cancel it.`,
        moved: 0,
        failed: [],
        notes: [],
      }
    }
  }

  // Apply the moves.
  const failed: { sourceId: string; reason: string }[] = []
  let moved = 0
  for (const r of resolved) {
    const isNewTeamCaptain =
      destination.kind === 'newTeam' && options.newTeamCaptain?.sourceId === r.member.sourceId
    const err = await applyMemberMove(
      db,
      r.member,
      dest,
      isNewTeamCaptain,
      adminEmail,
      r.entry.teamName,
    )
    if (err) failed.push({ sourceId: r.member.sourceId, reason: err })
    else moved++
  }

  // A brand-new team has no captain until its members arrive, so ownership is
  // resolved after the moves rather than before.
  if (destination.kind === 'newTeam' && dest && options.newTeamCaptain) {
    await promoteCaptain(db, dest.teamId, options.newTeamCaptain)
    let captainUserId: string | null = null
    if (options.newTeamCaptain.sourceTable === 'event_registrations') {
      const { data } = await db
        .from('event_registrations')
        .select('user_id')
        .eq('id', options.newTeamCaptain.sourceId)
        .maybeSingle()
      captainUserId = data?.user_id ?? null
    } else {
      const { data } = await db
        .from('registration_slots')
        .select('app_user_id')
        .eq('id', options.newTeamCaptain.sourceId)
        .maybeSingle()
      captainUserId = data?.app_user_id ?? null
    }
    await db.from('teams').update({ created_by: captainUserId }).eq('id', dest.teamId)
  }

  // Promote replacement captains on source teams.
  for (const [teamId, ref] of Object.entries(options.newCaptainByTeamId)) {
    await promoteCaptain(db, teamId, ref)
  }

  // Recalculate status for every touched team.
  const touched = new Set<string>([...sourceTeamIds])
  if (dest) touched.add(dest.teamId)
  for (const teamId of touched) await recalcTeamStatus(db, teamId)

  for (const teamId of options.confirmEmptyTeams) {
    const entry = roster.find((e) => e.teamId === teamId)
    if (entry) notes.push(`${entry.teamName ?? 'Team'} was left empty and marked cancelled.`)
  }

  revalidateRoster(eventSanityId)
  return { moved, failed, notes }
}
