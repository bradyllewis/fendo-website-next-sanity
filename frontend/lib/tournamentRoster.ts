import { createAdminClient } from '@/lib/supabase/admin'
import { buildMirrorRegIds } from '@/lib/registrationDedup'

// ─── Types ──────────────────────────────────────────────────────────────────

export type RosterMemberSource = 'event_registrations' | 'registration_slots'

export interface RosterMember {
  /** Which table this member's canonical record lives in. */
  sourceTable: RosterMemberSource
  /** Primary key in `sourceTable`. */
  sourceId: string
  /**
   * For slot-sourced members, the id of the mirrored `event_registrations`
   * row (linked via `registration_slots` ↔ `event_registrations.registration_slot_id`),
   * or null. Mutations must keep both rows in sync.
   */
  linkedRegistrationId: string | null
  firstName: string
  lastName: string
  email: string
  phone: string | null
  shirtSize: string | null
  status: string
  amountPaidCents: number | null
  isCaptain: boolean
  /**
   * Stripe payment intent for an individual refund, or null when no
   * standalone charge exists (e.g. captain_pays_all invitees, free events).
   */
  paymentIntentId: string | null
}

export interface RosterEntry {
  kind: 'team' | 'solo'
  teamId: string | null
  teamName: string | null
  inviteCode: string | null
  registrationType: 'individual' | 'duo' | 'team'
  paymentMode: 'captain_pays_all' | 'individual' | null
  teamStatus: string | null
  members: RosterMember[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Slot statuses that represent an active reservation that hasn't been paid. */
export const UNPAID_SLOT_STATUSES = ['invited', 'payment_started', 'captain_pending'] as const

/**
 * True when a roster member is an unpaid `registration_slots` reservation.
 * Only these members have a per-member pay link (`/compete/invite/{token}`),
 * so they're the sole valid recipients of a payment-pending reminder.
 */
export function isUnpaidSlotMember(m: RosterMember): boolean {
  return (
    m.sourceTable === 'registration_slots' &&
    (UNPAID_SLOT_STATUSES as readonly string[]).includes(m.status)
  )
}

function readShirtSize(metadata: unknown): string | null {
  if (metadata && typeof metadata === 'object' && 'shirtSize' in metadata) {
    const v = (metadata as { shirtSize?: unknown }).shirtSize
    return typeof v === 'string' && v.trim() ? v : null
  }
  return null
}

function readMetaString(metadata: unknown, key: string): string | null {
  if (metadata && typeof metadata === 'object' && key in metadata) {
    const v = (metadata as Record<string, unknown>)[key]
    return typeof v === 'string' && v.trim() ? v : null
  }
  return null
}

function splitName(full: string | null): { first: string; last: string } {
  if (!full) return { first: '', last: '' }
  const parts = full.trim().split(/\s+/)
  return { first: parts[0] ?? '', last: parts.slice(1).join(' ') }
}

// ─── Core ───────────────────────────────────────────────────────────────────

/**
 * Resolves a tournament's full roster (solo + duo + team registrations),
 * grouped by team, from the three registration sources in Supabase.
 *
 * Dedup rule (mirrors `getEventSeatCounts` in sanity/lib/eventSeats.ts so the
 * roster's player count equals the "spots filled" shown elsewhere):
 *   - Slot members: every active `registration_slots` row (status NOT IN
 *     expired/cancelled) — covers individual-pay members and captain_pays_all
 *     invitees.
 *   - Registration members: `event_registrations` with status paid|pending,
 *     excluding volunteers and excluding slot mirror rows (identified by the
 *     slot↔reg link, not by team.payment_mode) — covers solos and
 *     captain_pays_all captains. Keying on the link rather than the payment
 *     mode is what lets an admin move a player between teams of different
 *     modes without the player vanishing or being counted twice.
 *
 * Solo/captain registration rows store the player's name in `metadata.name`
 * and have no email column, so we join `profiles` (by user_id) for email and
 * fall back through metadata → profile full_name for the name.
 */
export async function getTournamentRoster(eventSanityId: string): Promise<RosterEntry[]> {
  const db = createAdminClient()

  const [teamsRes, regsRes, slotsRes] = await Promise.all([
    db
      .from('teams')
      .select('id, team_name, invite_code, registration_type, payment_mode, team_status, created_at')
      .eq('event_sanity_id', eventSanityId),
    db
      .from('event_registrations')
      .select(
        'id, user_id, team_id, registration_type, team_name, player_first_name, player_last_name, player_email, player_phone, metadata, status, amount_paid, is_captain, registration_slot_id, stripe_payment_intent_id',
      )
      .eq('event_sanity_id', eventSanityId),
    db
      .from('registration_slots')
      .select(
        'id, team_id, is_captain, player_first_name, player_last_name, player_email, player_phone, metadata, status, amount_due, event_registration_id, stripe_payment_intent_id',
      )
      .eq('event_sanity_id', eventSanityId),
  ])

  const teams = teamsRes.data ?? []
  const regs = regsRes.data ?? []
  const slots = slotsRes.data ?? []

  // Mirror set is built from ALL slots (not just active ones) — a cancelled
  // slot still marks its ledger row as a mirror. See lib/registrationDedup.ts.
  const mirrorRegIds = buildMirrorRegIds(regs, slots)

  // Reliable slot → mirror lookup (both live webhook and backfill set registration_slot_id)
  const mirrorBySlotId = new Map<string, (typeof regs)[number]>()
  for (const r of regs) {
    if (r.registration_slot_id) mirrorBySlotId.set(r.registration_slot_id, r)
  }

  // Resolve emails/names for registration-sourced members that rely on profiles.
  const userIds = [...new Set(regs.map((r) => r.user_id).filter((id): id is string => !!id))]
  const profileById = new Map<string, { email: string | null; full_name: string | null }>()
  if (userIds.length > 0) {
    const { data: profiles } = await db
      .from('profiles')
      .select('id, email, full_name')
      .in('id', userIds)
    for (const p of profiles ?? []) {
      profileById.set(p.id, { email: p.email, full_name: p.full_name })
    }
  }

  // Prepare team member buckets (preserve DB order; captains float to top later)
  const teamMembers = new Map<string, RosterMember[]>()
  for (const t of teams) teamMembers.set(t.id, [])
  const soloEntries: RosterEntry[] = []

  const pushToTeam = (teamId: string, member: RosterMember) => {
    const bucket = teamMembers.get(teamId)
    if (bucket) bucket.push(member)
    else teamMembers.set(teamId, [member])
  }

  // 1. Slot members — canonical for individual-pay members + captain_pays_all invitees
  for (const s of slots) {
    if (s.status === 'expired' || s.status === 'cancelled') continue
    const mirror = mirrorBySlotId.get(s.id) ?? null
    // Prefer the reg→slot link (mirror), but fall back to the slot→reg link
    // (event_registration_id). The backfill's Phase 1 sets only the latter for
    // individual-pay captains whose ledger row came from their own checkout, so
    // without this fallback those captains' mutations wouldn't reach the reg row.
    const member: RosterMember = {
      sourceTable: 'registration_slots',
      sourceId: s.id,
      linkedRegistrationId: mirror?.id ?? s.event_registration_id ?? null,
      firstName: s.player_first_name ?? '',
      lastName: s.player_last_name ?? '',
      email: s.player_email ?? '',
      phone: s.player_phone ?? null,
      shirtSize: readShirtSize(s.metadata),
      status: s.status,
      amountPaidCents: mirror?.amount_paid ?? s.amount_due ?? null,
      isCaptain: !!s.is_captain,
      paymentIntentId: s.stripe_payment_intent_id ?? null,
    }
    if (s.team_id) pushToTeam(s.team_id, member)
  }

  // 2. Registration members — solos + captain_pays_all captains; skip mirrors + volunteers
  for (const r of regs) {
    if (r.status !== 'paid' && r.status !== 'pending') continue
    if (r.registration_type === 'volunteer') continue
    // Skip mirror rows — the slot already represents this member.
    if (mirrorRegIds.has(r.id)) continue

    const profile = r.user_id ? profileById.get(r.user_id) : undefined
    const metaName = readMetaString(r.metadata, 'name')
    const fallback = splitName(metaName ?? profile?.full_name ?? null)

    const member: RosterMember = {
      sourceTable: 'event_registrations',
      sourceId: r.id,
      linkedRegistrationId: null,
      firstName: r.player_first_name ?? fallback.first,
      lastName: r.player_last_name ?? fallback.last,
      email: r.player_email ?? profile?.email ?? readMetaString(r.metadata, 'email') ?? '',
      phone: r.player_phone ?? null,
      shirtSize: readShirtSize(r.metadata),
      status: r.status,
      amountPaidCents: r.amount_paid ?? null,
      isCaptain: r.is_captain,
      paymentIntentId: r.stripe_payment_intent_id ?? null,
    }

    if (r.team_id) {
      pushToTeam(r.team_id, member)
    } else {
      soloEntries.push({
        kind: 'solo',
        teamId: null,
        teamName: null,
        inviteCode: null,
        registrationType: (r.registration_type as RosterEntry['registrationType']) ?? 'individual',
        paymentMode: null,
        teamStatus: null,
        members: [member],
      })
    }
  }

  // Assemble team entries (drop teams with no active members), captains first.
  const teamEntries: RosterEntry[] = []
  for (const t of teams) {
    const members = teamMembers.get(t.id) ?? []
    if (members.length === 0) continue
    members.sort((a, b) => Number(b.isCaptain) - Number(a.isCaptain))
    teamEntries.push({
      kind: 'team',
      teamId: t.id,
      teamName: t.team_name,
      inviteCode: t.invite_code,
      registrationType: t.registration_type as RosterEntry['registrationType'],
      paymentMode: t.payment_mode as RosterEntry['paymentMode'],
      teamStatus: t.team_status,
      members,
    })
  }

  // Teams first (alpha by name), then solos (alpha by member name).
  teamEntries.sort((a, b) => (a.teamName ?? '').localeCompare(b.teamName ?? ''))
  soloEntries.sort((a, b) => {
    const an = `${a.members[0]?.lastName} ${a.members[0]?.firstName}`.trim()
    const bn = `${b.members[0]?.lastName} ${b.members[0]?.firstName}`.trim()
    return an.localeCompare(bn)
  })

  return [...teamEntries, ...soloEntries]
}
