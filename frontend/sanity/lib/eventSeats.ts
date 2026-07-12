import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Resolves event_sanity_id → number of occupied seats, derived live from
 * Supabase registrations. This is the single source of truth for "spots filled"
 * on in-app-registration events; the Sanity `spotsFilled` field is only used for
 * externally-managed events that have no registrations here.
 *
 * A "seat" is one player holding an active spot. Players live in EITHER
 * `event_registrations` or `registration_slots`; the only overlap (same person in
 * both) is individual-pay mirror rows, which we exclude.
 *
 *   seats = active registration_slots (status NOT IN expired/cancelled)
 *         + event_registrations [paid|pending] that are NOT individual-pay mirrors
 *           (team_id IS NULL OR team.payment_mode = 'captain_pays_all')
 *
 * Per flow: individual = 1 reg; captain_pays_all(N) = 1 captain reg + (N-1) invitee
 * slots; individual-pay(N) = N slots + 0 (mirror rows excluded). The dedup keys on
 * the immutable team.payment_mode, not the slot→reg link (which the claim page
 * leaves unset). The count includes in-progress reservations so display matches the
 * checkout capacity gate.
 */
export async function getEventSeatCounts(
  eventIds: (string | null | undefined)[],
): Promise<Map<string, number>> {
  const unique = [...new Set(eventIds.filter((id): id is string => !!id))]
  if (unique.length === 0) return new Map()

  const admin = createAdminClient()
  // Seed every requested id with 0 so callers get an explicit count (not undefined)
  // for registration events that simply have no signups yet.
  const seats = new Map<string, number>(unique.map((id) => [id, 0]))
  const add = (id: string) => seats.set(id, (seats.get(id) ?? 0) + 1)

  // 1. Active slots — one seat each (individual-pay members + captain_pays_all invitees)
  const { data: slots } = await admin
    .from('registration_slots')
    .select('event_sanity_id')
    .in('event_sanity_id', unique)
    .not('status', 'in', '("expired","cancelled")')

  for (const s of slots ?? []) add(s.event_sanity_id)

  // 2. Active registrations, excluding individual-pay mirror rows.
  // Volunteers hold a registration row but do not occupy a player seat, so
  // they are filtered out below.
  const { data: regs } = await admin
    .from('event_registrations')
    .select('event_sanity_id, team_id, registration_type')
    .in('event_sanity_id', unique)
    .in('status', ['paid', 'pending'])

  const teamIds = [...new Set((regs ?? []).map((r) => r.team_id).filter((t): t is string => !!t))]

  let modeByTeamId = new Map<string, string>()
  if (teamIds.length > 0) {
    const { data: teams } = await admin
      .from('teams')
      .select('id, payment_mode')
      .in('id', teamIds)
    modeByTeamId = new Map((teams ?? []).map((t) => [t.id, t.payment_mode]))
  }

  for (const r of regs ?? []) {
    // Volunteers do not occupy a player seat.
    if (r.registration_type === 'volunteer') continue
    // Skip individual-pay mirror rows — their seat is already counted via the slot.
    if (r.team_id && modeByTeamId.get(r.team_id) !== 'captain_pays_all') continue
    add(r.event_sanity_id)
  }

  return seats
}
