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
