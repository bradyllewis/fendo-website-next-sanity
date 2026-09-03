/**
 * Identifies which `event_registrations` rows are mirrors of a
 * `registration_slots` row, so a player who exists in both tables is counted
 * exactly once.
 *
 * This rule is STRUCTURAL — it reads the slot↔reg link itself, never the
 * team's `payment_mode`. That matters because admins can move a player
 * between teams of different payment modes; a payment_mode-keyed rule would
 * make a moved player either vanish from the roster or be counted twice.
 *
 * Both link directions are required. Live writers (the Stripe webhook,
 * /compete/invite/[token]/success, /account/claim/[token]) set
 * `event_registrations.registration_slot_id`, but backfill migration
 * 20260627010000 Phase 1 set only `registration_slots.event_registration_id`.
 * A 2026-09-03 production audit found 6 rows reachable ONLY by the reverse
 * link, 3 of them paid players — dropping it would double-count them.
 */

export interface MirrorRegInput {
  id: string
  registration_slot_id: string | null
}

export interface MirrorSlotInput {
  event_registration_id: string | null
}

/**
 * Returns the set of `event_registrations.id` values that are slot mirrors.
 *
 * IMPORTANT: pass EVERY slot for the events in question, not just active
 * ones. A cancelled slot still marks its ledger row as a mirror; filtering
 * slots by status here would let a cancelled member's row be recounted as a
 * standalone player.
 */
export function buildMirrorRegIds(
  regs: MirrorRegInput[],
  slots: MirrorSlotInput[],
): Set<string> {
  const mirrors = new Set<string>()
  const knownRegIds = new Set(regs.map((r) => r.id))

  // Forward link: the reg row points at its slot.
  for (const r of regs) {
    if (r.registration_slot_id) mirrors.add(r.id)
  }

  // Reverse link: a slot points at its reg row (backfill Phase 1 rows).
  for (const s of slots) {
    if (s.event_registration_id && knownRegIds.has(s.event_registration_id)) {
      mirrors.add(s.event_registration_id)
    }
  }

  return mirrors
}
