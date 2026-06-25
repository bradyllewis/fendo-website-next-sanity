# Derive "Spots Filled" from Registrations

**Date:** 2026-06-25
**Status:** Approved for implementation

## Problem

`spotsFilled` is a manually-entered number on the Sanity `event` schema. It is stale by
nature and was being used (directly or partially) as the source of truth for how many
spots an event has filled. For events that use in-app registration, the filled count must
instead be derived from actual registrations in Supabase.

Compounding the bug: each call site counted differently, and team registrations were
mis-counted — a `captain_pays_all` team is a single `event_registrations` row representing
2–4 seats, while `individual`-pay team members live in `registration_slots` and also get
mirror `event_registrations` rows (double-count).

## Seat model (ground truth, verified against checkout + webhook source)

A "seat" = one player holding an active spot. Players are represented as either an
`event_registrations` row or a `registration_slots` row. The only overlap (same person in
both tables) is **individual-pay mirror rows**.

| Flow | event_registrations | registration_slots | seats |
|------|--------------------|--------------------|-------|
| Individual | 1 row (team_id null) | — | 1 |
| captain_pays_all (max N) | 1 captain row (team_id, payment_mode=captain_pays_all) | N−1 invitee slots | N |
| individual-pay (max N) | 0..N mirror rows (payment_mode=individual) | N slots | N |

## Canonical helper

`frontend/sanity/lib/eventSeats.ts` — mirrors the `getCurrentEventTitles` pattern.

```ts
getEventSeatCounts(eventIds: string[]): Promise<Map<string /*event_sanity_id*/, number>>
```

Formula (includes in-progress reservations — chosen so display matches the capacity gate):

```
seats(event) =
    count of registration_slots   where event_sanity_id = X
                                  and status NOT IN ('expired','cancelled')
  + count of event_registrations  where event_sanity_id = X
                                  and status IN ('paid','pending')
                                  and (team_id IS NULL OR team.payment_mode = 'captain_pays_all')
```

The dedup discriminator is `team.payment_mode`, NOT the slot→reg link
(`registration_slots.event_registration_id`), because the claim page inserts a mirror reg
row without linking the slot — the link is unreliable; `payment_mode` is immutable.

Implementation: batched queries over the id set (active slots; paid/pending regs; team
payment_mode for the team_ids seen) + JS aggregation. No N+1.

## Sanity schema change

Keep `spotsFilled` but hide it when in-app registration is on:

```ts
hidden: ({ parent }) => parent?.requiresRegistration === true,
```

It then exists only for externally-managed events (its only legitimate use) and disappears
for the events where it caused this bug.

## Display rule (everywhere)

```
filled = requiresRegistration ? (seatMap.get(_id) ?? 0) : (spotsFilled ?? 0)
```

## Call sites

1. `compete/page.tsx` — replace `paidCountMap` row-count loop with `getEventSeatCounts`.
2. `compete/[slug]/page.tsx` — `filledCount`/`spotsLeft` + `RegisterButton` `isFull`.
3. `components/compete/EventCard.tsx` — `effectiveFilled` uses the seat count.
4. `compete/[slug]/register/page.tsx` — capacity redirect.
5. `api/stripe/checkout/route.ts` — both capacity gates use a shared single-event seat count
   with the correct per-flow delta (+1 individual, +maxMembers teams). Fixes latent bugs:
   captain_pays_all was only checked for 1 free seat; individual-pay gate double-counted
   paid members. **Behavioral change: enforcement becomes correct/stricter.**
6. `admin/tournaments` — show derived seats (currently shows `event_registrations` row
   count, which under-reports teams).

## Out of scope

- "Join Existing Team" via code can create reg rows on a team that already has slots — a
  pre-existing data-model overlap, independent of display. Noted, not fixed here.
- `event_date` / sponsor tier staleness — separate spec.

## Verification

- `npx tsc --noEmit` exit 0.
- Manual reasoning per flow (table above) confirms each yields the correct seat total.
