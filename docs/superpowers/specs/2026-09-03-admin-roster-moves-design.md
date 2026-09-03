# Admin Roster Moves — Design Spec

**Date:** 2026-09-03
**Status:** Approved

## Problem

Tournament rosters need manual adjustment for logistical reasons — a foursome shows up as a threesome, two duos need to merge, a player wants to switch teams, a team splits. The admin roster page (`/admin/tournaments/[id]/teams`, built in the 2026-07-21 spec) can edit and cancel members but cannot **move** them. Today the only way to reshuffle is to cancel a player and have them re-register, which destroys their payment record.

Two existing assumptions in the codebase make a naive "update `team_id`" implementation actively wrong. They are prerequisites, not side quests — see Design §1.

## Goals

- Move one or more players from their current team into another existing team in the same tournament.
- Create a new team and move selected existing players into it in one action.
- Detach a player from a team so they stand alone (solo), and absorb an existing solo registrant into a team.
- Reassign a team's captain.
- Every destructive or surprising consequence (over-capacity, emptied team, captain vacancy) is surfaced in a confirmation dialog before it happens.
- Payment state — Stripe charges, refunds, `amount_paid`, `amount_due`, payment intents, registration status — is never modified by a move.

## Non-goals

- No automated test suite (manual verification, consistent with existing admin features).
- No changes to the public-facing registration/checkout flow.
- No cross-tournament moves. Every move is scoped to a single `event_sanity_id`.
- No hard deletion. An emptied team is soft-cancelled (`team_status = 'cancelled'`); `registration_slots.team_id` is `ON DELETE CASCADE`, so deleting a team would destroy its players' records.
- No new payments, refunds, or price adjustments. If a move implies money should change hands, an admin handles that separately through the existing cancel/refund flow.
- No `INSERT` into `event_registrations` anywhere in this feature (see §2, "Blocked case").

## Background: the existing data model

A tournament's players live in two tables, and which one holds a given player depends on their team's `payment_mode` and their role:

| Player | Canonical row | Mirror row |
|---|---|---|
| Solo registrant | `event_registrations` (`team_id IS NULL`) | — |
| `captain_pays_all` captain | `event_registrations` (`team_id` set) | — |
| `captain_pays_all` invitee | `registration_slots` (`status='captain_registered'`, later `'paid'`) | — |
| `individual`-pay member (incl. captain) | `registration_slots` | `event_registrations` linked via `registration_slot_id` |

`getEventSeatCounts` (`sanity/lib/eventSeats.ts`) and `getTournamentRoster` (`lib/tournamentRoster.ts`) must agree on which rows are real players and which are mirrors, because the first gates checkout capacity and the second drives the admin roster, exports, and reminder emails.

## Design

### 1. Prerequisites — two fixes that must land first

#### 1a. Replace `payment_mode`-keyed dedup with structural dedup

Both `getEventSeatCounts` and `getTournamentRoster` currently identify a mirror `event_registrations` row by asking whether its team is `captain_pays_all`:

```ts
if (r.team_id && modeByTeamId.get(r.team_id) !== 'captain_pays_all') continue // skip as mirror
```

This ties a row's identity to its *current team's* payment mode, so moving a player between teams of different modes corrupts the count:

- Solo → `individual`-pay team: the reg row now has a `team_id` on a non-cpa team, so it is skipped as a "mirror". The player **disappears** from the roster and from spots-filled.
- `individual`-pay member → `captain_pays_all` team: the mirror reg is no longer skipped, so the slot and its mirror are both counted. The player is **counted twice**.

Replace it with a rule derived from the slot↔reg link itself, which no move can change:

```ts
// lib/registrationDedup.ts
export function buildMirrorRegIds(
  regs: { id: string; registration_slot_id: string | null }[],
  slots: { event_registration_id: string | null }[],
): Set<string>
```

A reg is a mirror when `registration_slot_id IS NOT NULL` **or** some slot's `event_registration_id` points at it. Both directions are required: the webhook, `/compete/invite/[token]/success`, and `/account/claim/[token]` all set `registration_slot_id` on insert, but backfill migration `20260627010000` Phase 1 set only the slot→reg direction for individual-pay captains.

Both call sites import this one helper. `getTournamentRoster` additionally stops needing `modeByTeamId` for dedup (it still reads `payment_mode` for display).

**Verified safe:** the free-event `captain_pays_all` branch in `app/api/stripe/checkout/route.ts` marks invitee slots paid but never sets `event_registration_id`, so a cpa captain's own reg row can never be misclassified as a mirror.

**Known live-data caveat:** `/account/claim/[token]` admits any slot with `status = 'paid'`, and the webhook sets cpa invitee slots to `'paid'` when the captain pays. A cpa invitee who reaches their claim link therefore gets a mirror reg row on a cpa team, which today is **double-counted**. Structural dedup fixes this. The parity check in §5 must therefore expect "zero diff, or a diff explained by this case" — not blind zero.

#### 1b. Add a real `is_captain` column to `event_registrations`

`getTournamentRoster` infers captaincy as `isCaptain: !!r.team_id`, valid only while the sole reg rows carrying a `team_id` are cpa captains and mirrors. Once a solo can be moved into a team, that inference marks every moved solo as a captain.

Migration `supabase/migrations/20260903000000_admin_roster_moves.sql`:

```sql
ALTER TABLE event_registrations
  ADD COLUMN IF NOT EXISTS is_captain BOOLEAN NOT NULL DEFAULT false;

-- Captains: non-mirror rows that belong to a team.
UPDATE event_registrations
  SET is_captain = true
  WHERE team_id IS NOT NULL AND registration_slot_id IS NULL;

-- Mirrors: inherit from the slot they mirror (both link directions).
UPDATE event_registrations r SET is_captain = s.is_captain
  FROM registration_slots s WHERE s.id = r.registration_slot_id;
UPDATE event_registrations r SET is_captain = s.is_captain
  FROM registration_slots s WHERE s.event_registration_id = r.id
   AND r.registration_slot_id IS NULL;
```

`getTournamentRoster` then reads the column instead of inferring.

### 2. The move primitive

One operation underlies all four features: *move these players to this destination*.

```ts
type MoveDestination =
  | { kind: 'existingTeam'; teamId: string }
  | { kind: 'newTeam'; name: string; teamSize: number }
  | { kind: 'solo' }
```

| Source player | → Existing team | → New team | → Solo |
|---|---|---|---|
| Slot member | update slot `team_id` + ownership; sync mirror reg | same, after team insert | only if a mirror reg exists (see below) |
| CPA captain (reg) | update reg `team_id`, `team_name`, `registration_type`, `is_captain` | same | clear `team_id`, `team_name` |
| Solo (reg) | set `team_id`, `team_name`, `registration_type`, `is_captain=false` | same | n/a |

**Field writes per move**

- Slot: `team_id`, `invited_by_user_id` (see ownership below), `is_captain`.
- **`is_captain` on arrival is always `false`**, for every source kind, with one exception: the player designated captain of a newly created team. Moving players into an existing team never disturbs that team's existing captain.
- Mirror reg (when present): `team_id`, `team_name`, `registration_type`, `is_captain`, and `metadata.teamId` / `metadata.inviteCode`.
- Reg-canonical member: `team_id`, `team_name`, `registration_type`, `is_captain`, `metadata`.
- Never written: **member-level** status (`registration_slots.status`, `event_registrations.status`), `amount_paid`, `amount_due`, `stripe_*`, `paid_at`, `invite_token`, `expires_at`. The **team-level** `teams.team_status` *is* recomputed — see the recalculation rule below. These are different columns on different tables; no member's own status is ever changed by a move.
- **Volunteers cannot be moved.** `getTournamentRoster` skips `registration_type = 'volunteer'`, so volunteers never appear on the roster page and cannot be selected. `movePlayers` rejects a volunteer `MemberRef` defensively anyway: a move writes `registration_type` from the destination team, which would convert a volunteer into a counted player and break the §5 invariant.
- `event_slug` on the moved row is left alone. It is a historical snapshot; live titles already come from Sanity via `getCurrentEventInfo`.

**Ownership rewrite (the non-obvious requirement).** Every moved slot must have `invited_by_user_id` set to the destination team's captain (that captain's `app_user_id` for a slot captain, `user_id` for a reg captain, else `null`). Five separate consumers authorize on this column, and leaving it stale hands the *old* captain control of a player who is no longer on their team:

- `registration_slots` RLS: `USING (invited_by_user_id = auth.uid())`.
- `app/components/account/MyTeams.tsx` — renders the team and every member's invite token.
- `app/api/registration-slots/[token]/resend/route.ts` — `403` unless `invited_by_user_id === user.id`.
- `app/api/registration-slots/[token]/shirt-size/route.ts` — same check.
- `app/api/cron/expire-slots/route.ts` — emails `invited_by_user_id` about expiring slots.

**Guards, all enforced server-side**

- **Same event.** `destTeam.event_sanity_id` must equal the source's. Rejected otherwise.
- **Active destination only.** The team picker and the server both exclude teams with `team_status IN ('cancelled','expired')`. `app/api/stripe/slot-checkout/route.ts` returns `410` for those, so moving an unpaid player onto one would silently break their pay link. It does *not* gate on `payment_mode`, so a move between modes leaves the pay link working and correctly relabelled.
- **Capacity.** If the move pushes a team past `max_members`, the dialog warns and, on confirm, raises `max_members` to fit. No silent overflow.
- **Emptied team.** If a move removes the last active member, the dialog warns and, on confirm, sets `team_status = 'cancelled'`. Never deleted.
- **Captain vacancy.** If a moved player `is_captain` and active members remain on the source team, the dialog will not submit without a named replacement. Applied together with the move: `is_captain=false` on all of that team's members, `true` on the chosen one, and every slot's `invited_by_user_id` repointed to the new captain.
- **Blocked case:** detaching a slot member who has **no** mirror reg (an unpaid slot, or a cpa invitee) to solo is refused, with a message directing the admin to create a one-person team instead. Supporting it would require inserting into `event_registrations`, which risks the `idx_event_reg_one_paid_per_user_event` partial unique index. Keeping the feature INSERT-free removes that entire failure class.

**New team creation**

- `registration_type`: `'duo'` when the team size is 2, otherwise `'team'`. The CHECK constraint permits no other value.
- `max_members`: admin-entered, defaulting to the number of selected players, minimum that count.
- `payment_mode`: `'individual'`. An admin-assembled team has no captain paying for everyone; each moved player carries their own payment record.
- **Captain:** the modal requires designating one of the moved players as the new team's captain. That player gets `is_captain = true`; every other moved player gets `false`.
- `team_status`: derived from members (see below). `expires_at`: `null` — admin teams do not expire. `created_by`: the designated captain's user id, else `null`.
- Consequence worth knowing: `MyTeams.tsx` finds a captain's teams via `registration_slots WHERE invited_by_user_id = me AND is_captain`. If the designated captain is reg-canonical (a former cpa captain, who has no slot), the new team will not appear in their account view. Acceptable — this is an admin-managed team, and the admin roster page remains its source of truth.
- `invite_code`: generated with the same 3-attempt uniqueness retry loop used by `app/api/stripe/checkout/route.ts`.
- `event_sanity_id` / `event_slug`: copied from the source players' event.

**`team_status` recalculation.** After any move, each affected team's status is recomputed. It is defined over **active members only**, using exactly the roster's definition of active — slots whose status is not `expired`/`cancelled`, plus regs with status `paid`/`pending`. Expired and cancelled rows are simply absent from the calculation; they never drag a team's status down.

A member counts as *paid* when their slot status is `paid`, `claimed`, or `captain_registered`, or their reg status is `paid`.

| Active members | Result |
|---|---|
| none | `cancelled` |
| all paid | `complete` |
| some paid | `partially_paid` |
| none paid (all active-but-unpaid) | `pending` |

A move never writes `expired` as a team status — that value belongs to the expiry cron. This keeps the badge in `MyTeams.tsx` and the `slot-checkout` gate honest: a team left holding only unpaid-but-active members reads `pending` and its members' pay links keep working, which is the correct outcome.

### 3. UI

All on `/admin/tournaments/[id]/teams`.

- **Selection.** A checkbox on each member row plus a sticky action bar (`N players selected → Move…`). One mental model covers single moves, merges, and new-team creation.
- **Per-row shortcut.** A `Move` action on each row pre-selects that one player and opens the same modal, so there is a fast path without a second code path.
- **Move modal.** Lists the players moving and their current teams; destination as three radio options (existing team / new team / solo, with solo disabled and explained for multi-select and for the blocked case); a required replacement-captain picker when a captain is leaving; a required captain picker when the destination is a new team; and a plain-language warning block:
  - *"Foursome A will exceed its size of 4 (maximum will be raised to 5)."*
  - *"Team B will be left with no players and will be marked cancelled."*
  - *"Payment records, refunds, and registration status are not affected."*

  The confirm button restates the whole operation in one sentence.
- **Change captain.** A separate action on each team header for the standalone case, opening a member picker with confirmation.
- **File layout.** `TournamentRosterTable.tsx` is already 761 lines; it gains only selection state, checkboxes, and mount points. New UI lives in `app/components/admin/roster/MovePlayersModal.tsx` and `ChangeCaptainModal.tsx`, reusing the existing `OVERLAY` / `PANEL` / `FIELD` modal styling constants.

### 4. Server actions and failure model

New file `app/admin/tournaments/[id]/teams/moveActions.ts` (kept separate so the existing `actions.ts` does not grow further), behind the same `requireAdmin` guard and calling the same `revalidateRoster` helper.

```ts
movePlayers(
  eventSanityId: string,
  members: MemberRef[],
  destination: MoveDestination,
  options: {
    newCaptainByTeamId: Record<string, MemberRef>
    confirmOverflow: boolean
    confirmEmptyTeams: string[]
  },
): Promise<MoveResult>

setTeamCaptain(
  eventSanityId: string,
  teamId: string,
  member: MemberRef,
): Promise<AdminActionResult>
```

Warnings are computed client-side from the roster already passed to the table (no preview round trip) and **re-validated server-side** — a client that omits `confirmOverflow` gets a rejection, not a silent overflow.

**No transaction.** Supabase JS offers none, and the existing `cancelTeam` already performs multiple sequential updates. This is acceptable here because structural dedup (§1a) makes a half-applied move *cosmetic*: `team_id` does not affect whether a player is counted, so a player is counted exactly once regardless of where the sequence stops. The one seat-affecting path is detach-to-solo, which clears the slot↔reg link; it is ordered **reg row first, then slot** so a mid-sequence failure double-counts briefly rather than making the player vanish, and re-running the move repairs it. `movePlayers` returns per-player results so a partial failure is reported as "3 of 4 moved" rather than a bare error.

**Audit trail.** Each move appends an entry to `metadata.adminHistory` (an array) on both the slot and the reg row: timestamp, action, source team name, destination team name, admin email. Cheap, and makes "what happened to this player?" answerable later.

### 5. Verification

**Parity check (gate for §1a).** `scripts/verify-dedup-parity.ts`, run locally with `tsx` against `.env.local` — it needs `SUPABASE_SERVICE_ROLE_KEY` via `createAdminClient`, so it cannot run in CI. It computes per-event seat counts under both the old `payment_mode` rule and the new structural rule and prints any event where they differ. It must produce zero diff, or a diff wholly explained by the claimed-cpa-invitee case documented in §1a. If anything else differs, stop and investigate before proceeding. The script is a one-off verification tool and is not committed.

**Coverage reporting is part of the check.** A zero diff only proves the two rules agreed on the data that exists. If production held no mirror rows, the check would pass while never exercising the case the rules disagree about — false confidence. The script therefore also reports how many of each shape it saw: events, teams by `payment_mode`, solo regs, active slots, and above all **mirror rows broken down by link direction** plus the count of mirrors sitting on a cpa team. A result is only meaningful when those counts are non-trivial.

**This check must run before any move code exists.** Once a move has been performed, old and new rules legitimately disagree and the check loses all meaning. §1a and §1b therefore form a hard phase boundary: ship them, verify parity, and only then build §2–§4.

#### Parity gate result — run 2026-09-03 (PASSED)

Executed read-only against production before any code changes. **0 of 10 events differed.**

Coverage confirming the check had teeth:

| Shape | Count |
|---|---|
| Events with registration data | 10 |
| Teams (`captain_pays_all` / `individual`) | 30 (19 / 11) |
| `event_registrations` rows (solo / volunteer) | 63 (21 / 6) |
| `registration_slots` rows (active) | 67 (63) |
| **Mirror rows total** | **23** |
| — via `reg.registration_slot_id` (forward) | 17 |
| — via `slot.event_registration_id` (reverse) | 23 |
| — **reverse-link ONLY** | **6** |
| Mirrors on a cpa team (the double-count case) | **0** |

Three findings that change how much confidence to place in §1a:

1. **The reverse-link fallback is load-bearing, not defensive.** Six mirrors resolve only via `slot.event_registration_id`, and three of them are real paid/claimed players on team "Shankaholics Anonymous" ($175 each, `status='paid'`, no forward link). A forward-link-only implementation would have double-counted three paying customers. Verified individually: all three resolve to an existing `paid` reg row.
2. **The known cpa-invitee double-count does not exist in production.** Zero mirrors sit on a cpa team, so the "diff explained by the claimed-invitee case" allowance was never needed — the result is a true zero. No event's spots-filled figure will change when §1a ships.
3. **Every paid or claimed slot has a ledger row.** The only slots without a mirror are 2 `captain_pending` and 6 `invited` — all unpaid, exactly the population the §2 blocked case refuses to detach to solo. No paid player is missing a ledger row.

Integrity probes were all clean: no regs on a team from a different event, no orphaned team references, no slots linking to a missing reg row.

**Feature invariant (success criterion).**

> For any event, the total from `getEventSeatCounts` and the player total from `getTournamentRoster` are equal to each other, and both are unchanged before and after any sequence of moves and team creations.

Moves are seat-neutral by definition. Any shift in either number is a bug, and this single invariant catches every dedup mistake reachable from this feature. It is checkable directly from the admin UI: the roster's "Total Players" stat against the event's spots-filled figure.

**Manual test matrix.** Solo → individual team; solo → cpa team; individual member → cpa team; cpa invitee → individual team; captain moved out with replacement named; move that empties a team; move that overflows `max_members`; two-player merge into a new team; detach-to-solo with a mirror reg; detach-to-solo without one (expect refusal). After each: roster total unchanged, spots-filled unchanged, `/admin/registrations` shows the new team name, no payment field altered.

### 6. Downstream effects reviewed

| Surface | Effect |
|---|---|
| `MyTeams.tsx`, slots RLS, `resend`, `shirt-size`, `expire-slots` cron | Correct only because of the ownership rewrite in §2. |
| `slot-checkout` | Gates on `team_status`, not `payment_mode`. Pay links survive a move into any active team and relabel to the new team. |
| `/admin/teams` `member_count` | Counts non-cancelled `event_registrations` only, so slot-only players were never counted there. Pre-existing quirk, out of scope. |
| Roster CSV / XLSX export, both reminder emails | Derive from `getTournamentRoster`; follow automatically. |
| Sanity `spotsFilled` | Untouched — moves are seat-neutral. |
| `/admin/registrations` | Shows the synced `team_name`. |
| `registration_payments.team_id` | Deliberately left historical. It is a payment audit trail, not a roster record. |
| `event_registrations.team_name` | Denormalized; synced on every move, as `updateTeamName` already does. |

## Files touched

**New**
- `supabase/migrations/20260903000000_admin_roster_moves.sql`
- `frontend/lib/registrationDedup.ts`
- `frontend/app/admin/tournaments/[id]/teams/moveActions.ts`
- `frontend/app/components/admin/roster/MovePlayersModal.tsx`
- `frontend/app/components/admin/roster/ChangeCaptainModal.tsx`

**Modified**
- `frontend/sanity/lib/eventSeats.ts` — use shared dedup helper
- `frontend/lib/tournamentRoster.ts` — shared dedup helper; read `is_captain` column
- `frontend/lib/supabase/types.ts` — `is_captain` on the registration type
- `frontend/app/components/admin/TournamentRosterTable.tsx` — selection state, checkboxes, mount points

## Risks

- **Touching `getEventSeatCounts` changes the function that gates checkout capacity.** Mitigated by the §5 parity check, which must pass before anything else ships.
- **The migration's mirror backfill runs two `UPDATE`s in link-direction order.** The second is scoped by `registration_slot_id IS NULL`, so a row reachable by both directions is written once.
- **Non-atomic moves** can leave cosmetic inconsistency on failure. Mitigated by ordering, per-player result reporting, and idempotent re-runs.
