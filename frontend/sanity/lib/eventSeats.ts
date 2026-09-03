import { createAdminClient } from '@/lib/supabase/admin'
import { buildMirrorRegIds } from '@/lib/registrationDedup'

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
 *         + event_registrations [paid|pending] that are NOT slot mirrors
 *
 * Per flow: individual = 1 reg; captain_pays_all(N) = 1 captain reg + (N-1) invitee
 * slots; individual-pay(N) = N slots + 0 (mirror rows excluded).
 *
 * The dedup keys on the slot↔reg link (see lib/registrationDedup.ts), NOT on
 * team.payment_mode. Admins can move a player between teams of different payment
 * modes; a payment_mode-keyed rule would make a moved player either vanish from
 * the count or be counted twice.
 *
 * The count includes in-progress reservations so display matches the checkout
 * capacity gate.
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

  // Fetch ALL slots, not just active ones. The mirror set below needs every
  // slot (a cancelled slot still marks its ledger row as a mirror); seat
  // counting filters to active slots in JS.
  const { data: slots } = await admin
    .from('registration_slots')
    .select('event_sanity_id, status, event_registration_id')
    .in('event_sanity_id', unique)

  const { data: regs } = await admin
    .from('event_registrations')
    .select('id, event_sanity_id, registration_type, registration_slot_id')
    .in('event_sanity_id', unique)
    .in('status', ['paid', 'pending'])

  // 1. Active slots — one seat each (individual-pay members + captain_pays_all invitees)
  for (const s of slots ?? []) {
    if (s.status === 'expired' || s.status === 'cancelled') continue
    add(s.event_sanity_id)
  }

  // 2. Active registrations, excluding slot mirrors.
  // Volunteers hold a registration row but do not occupy a player seat, so
  // they are filtered out below.
  const mirrorRegIds = buildMirrorRegIds(regs ?? [], slots ?? [])

  for (const r of regs ?? []) {
    // Volunteers do not occupy a player seat.
    if (r.registration_type === 'volunteer') continue
    // Skip mirror rows — their seat is already counted via the slot.
    if (mirrorRegIds.has(r.id)) continue
    add(r.event_sanity_id)
  }

  return seats
}
