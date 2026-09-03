# Admin Roster Moves Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins manually move players between teams, build a new team from existing players, detach a player to solo, and reassign captains within a tournament — without ever altering payment state.

**Architecture:** Three phases. Phase 1 replaces the seat-count dedup rule (currently keyed on `team.payment_mode`, which breaks the moment a player changes teams) with a structural rule keyed on the slot↔reg link, and adds a real `is_captain` column. Phase 2 builds one server-side move primitive that all four features route through. Phase 3 adds selection checkboxes and two modals to the existing roster page.

**Tech Stack:** Next.js App Router (RSC + server actions), Supabase (`@supabase/supabase-js`, service-role admin client), TypeScript, Tailwind. No test framework in this repo.

**Spec:** `docs/superpowers/specs/2026-09-03-admin-roster-moves-design.md`

## Global Constraints

- **No automated test suite.** This repo has no vitest/jest and no test files. Verification is: `npm run type-check`, `npm run lint`, `npm run build`, read-only Node probe scripts, and the manual test matrix in Task 13. Do not add a test framework.
- **All commands run from `frontend/`** unless stated otherwise.
- **Never write member-level status.** `registration_slots.status` and `event_registrations.status` are never modified by any code in this plan. `teams.team_status` *is* recomputed — different column, different table.
- **Never write** `amount_paid`, `amount_due`, `stripe_*`, `paid_at`, `invite_token`, `expires_at` on any row.
- **No `INSERT` into `event_registrations`** anywhere in this feature.
- **No hard deletes.** Emptied teams are soft-cancelled. `registration_slots.team_id` is `ON DELETE CASCADE`.
- **`moveActions.ts` carries `'use server'`, so every *value* export must be an async function.** Synchronous helpers stay module-internal. Type and interface exports are erased at compile time and are safe.
- **Any component with an event handler needs `'use client'`.** Omitting it causes a runtime RSC serialization error — a repeat failure in this codebase.
- **Probe scripts are read-only and uncommitted.** Write them to the scratchpad directory, never to the repo. Grep every probe for `.insert(`/`.update(`/`.upsert(`/`.delete(`/`.rpc(` before running it.
- **Mirror set is built from ALL slots regardless of status; seat counting uses only active slots.** These are two different filters over the same fetch. Getting this wrong is the single most likely way to break the parity baseline (see Task 3).
- Recorded parity baseline (production, 2026-09-03) — per-event seat counts that must not change:

  | event_sanity_id | seats |
  |---|---|
  | `5c7db159-08a4-4364-9149-9e7921c989dc` | 0 |
  | `6aa70a3e-f5e4-40c3-a56a-71cbbbb30545` | 78 |
  | `aca3171e-d714-48b7-b172-0b3aff071978` | 1 |
  | `b4aca70e-5f03-4c72-8b39-f9cb39770889` | 1 |
  | `b6b2fc0b-98f3-4a00-8cf6-b09219a25f6b` | 0 |
  | `c268ec9d-af45-4075-8bf6-d7a9a00f1d38` | 0 |
  | `cbe625c5-97e9-4813-82df-9ab2c345bc99` | 0 |
  | `cf488c87-c673-4407-84cc-07e2da9aa12a` | 0 |
  | `cf7491d6-5bd9-4a77-a544-73232ee75fc7` | 4 |
  | `ecbfbfc9-22d0-403b-b639-3048aac8f125` | 1 |

---

## File Structure

**Create**
- `frontend/lib/registrationDedup.ts` — the single mirror-detection rule. Pure functions, no I/O.
- `supabase/migrations/20260903000000_admin_roster_moves.sql` — `is_captain` column + backfill.
- `frontend/app/admin/tournaments/[id]/teams/moveActions.ts` — `movePlayers`, `setTeamCaptain`, and their guards.
- `frontend/app/components/admin/roster/MovePlayersModal.tsx` — destination picker, warnings, confirm.
- `frontend/app/components/admin/roster/ChangeCaptainModal.tsx` — standalone captain reassignment.

**Modify**
- `frontend/sanity/lib/eventSeats.ts` — use the shared rule.
- `frontend/lib/tournamentRoster.ts` — use the shared rule; read `is_captain`.
- `frontend/lib/supabase/types.ts` — add `is_captain` to the registration type.
- `frontend/app/components/admin/TournamentRosterTable.tsx` — selection state, checkboxes, sticky bar, modal mounts.

---

# PHASE 1 — Prerequisites (hard gate)

Phase 1 must ship and be verified before any Phase 2 code exists. Once a move has run, the old and new dedup rules legitimately disagree and the parity baseline becomes meaningless.

---

### Task 1: The shared mirror-detection rule

**Files:**
- Create: `frontend/lib/registrationDedup.ts`
- Verify with: scratchpad script (uncommitted)

**Interfaces:**
- Consumes: nothing.
- Produces: `buildMirrorRegIds(regs: MirrorRegInput[], slots: MirrorSlotInput[]): Set<string>`, plus the two input interfaces. Tasks 3, 5–9 import this.

- [ ] **Step 1: Create the helper**

Create `frontend/lib/registrationDedup.ts`:

```ts
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
```

- [ ] **Step 2: Write a fixture check**

There is no test runner and no TS loader for scratchpad scripts, so mirror the function body in plain JS and assert against it. Keep the two copies identical — if you change `registrationDedup.ts`, change this too.

Write `check-dedup-helper.mjs` to the scratchpad:

```js
// check-dedup-helper.mjs — fixture check for buildMirrorRegIds logic.
function buildMirrorRegIds(regs, slots) {
  const mirrors = new Set()
  const knownRegIds = new Set(regs.map((r) => r.id))
  for (const r of regs) if (r.registration_slot_id) mirrors.add(r.id)
  for (const s of slots) {
    if (s.event_registration_id && knownRegIds.has(s.event_registration_id)) {
      mirrors.add(s.event_registration_id)
    }
  }
  return mirrors
}

let failures = 0
function eq(label, actual, expected) {
  const a = JSON.stringify([...actual].sort())
  const e = JSON.stringify([...expected].sort())
  if (a !== e) { console.error(`FAIL ${label}: got ${a}, want ${e}`); failures++ }
  else console.log(`ok   ${label}`)
}

// solo reg, no slots -> not a mirror
eq('solo is not a mirror', buildMirrorRegIds([{ id: 'r1', registration_slot_id: null }], []), [])

// forward link only
eq('forward link', buildMirrorRegIds(
  [{ id: 'r1', registration_slot_id: 's1' }], []), ['r1'])

// reverse link only (backfill Phase 1 shape)
eq('reverse link', buildMirrorRegIds(
  [{ id: 'r1', registration_slot_id: null }],
  [{ event_registration_id: 'r1' }]), ['r1'])

// both directions on the same row -> counted once
eq('both directions dedupe', buildMirrorRegIds(
  [{ id: 'r1', registration_slot_id: 's1' }],
  [{ event_registration_id: 'r1' }]), ['r1'])

// dangling reverse link to a reg we did not fetch -> ignored
eq('dangling reverse link ignored', buildMirrorRegIds(
  [{ id: 'r1', registration_slot_id: null }],
  [{ event_registration_id: 'r-missing' }]), [])

// cpa captain reg (has team, no slot link) -> NOT a mirror
eq('cpa captain not a mirror', buildMirrorRegIds(
  [{ id: 'cap', registration_slot_id: null }],
  [{ event_registration_id: null }, { event_registration_id: null }]), [])

process.exit(failures ? 1 : 0)
```

- [ ] **Step 3: Run the fixture check**

Run: `node <scratchpad>/check-dedup-helper.mjs`
Expected: six `ok` lines, exit code 0. If any `FAIL` appears, the logic is wrong — fix `registrationDedup.ts` and rerun.

- [ ] **Step 4: Typecheck**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/registrationDedup.ts
git commit -m "feat: add structural slot/reg mirror detection helper"
```

---

### Task 2: `is_captain` column — migration and gated apply

**Files:**
- Create: `supabase/migrations/20260903000000_admin_roster_moves.sql`
- Modify: `frontend/lib/supabase/types.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `event_registrations.is_captain BOOLEAN NOT NULL DEFAULT false` in the database, and the corresponding field on the `EventRegistration` TypeScript type. Task 3 reads it.

> ⚠️ **This is the only task in the plan that writes to production.** It is additive (one new column plus a backfill of that column) and touches no existing column. Steps 3–5 are a hard stop requiring explicit user approval. Do not proceed past Step 3 without it.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260903000000_admin_roster_moves.sql`:

```sql
-- =============================================================
-- Fendo Golf — Admin roster moves: explicit captain flag
-- =============================================================
--
-- getTournamentRoster previously inferred captaincy as `!!reg.team_id`, which
-- holds only while the sole reg rows carrying a team_id are captain_pays_all
-- captains and slot mirrors. Admin roster moves let a solo registrant acquire
-- a team_id, which would make every moved solo look like a captain.
--
-- Additive only: one new column plus a backfill of that column. No existing
-- column is read-modified-written.
-- =============================================================

ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS is_captain BOOLEAN NOT NULL DEFAULT false;

-- Captains: non-mirror rows that belong to a team.
UPDATE public.event_registrations
   SET is_captain = true
 WHERE team_id IS NOT NULL
   AND registration_slot_id IS NULL;

-- Mirrors (forward link): inherit the slot's own captain flag.
UPDATE public.event_registrations r
   SET is_captain = s.is_captain
  FROM public.registration_slots s
 WHERE s.id = r.registration_slot_id;

-- Mirrors (reverse link, backfill 20260627010000 Phase 1 rows).
UPDATE public.event_registrations r
   SET is_captain = s.is_captain
  FROM public.registration_slots s
 WHERE s.event_registration_id = r.id
   AND r.registration_slot_id IS NULL;
```

- [ ] **Step 2: Add the field to the TypeScript type**

In `frontend/lib/supabase/types.ts`, find the registration interface containing `registration_slot_id: string | null` (around line 140) and add alongside it:

```ts
  is_captain: boolean
```

- [ ] **Step 3: Pre-flight — read-only, then STOP**

Check which migrations are already applied, because `supabase db push` applies **every** pending migration, not just this one. An unrelated pending migration could ship unintentionally.

Run from the repo root: `supabase migration list`

Read the output and write down every migration marked as pending. Then:

**STOP. Report to the user:**
1. The full list of pending migrations that `supabase db push` would apply.
2. That this migration adds one column and backfills it, and modifies no existing column.
3. The rollback statement: `ALTER TABLE public.event_registrations DROP COLUMN is_captain;`

Do not run Step 4 until the user explicitly approves. If any *unrelated* migration is pending, ask the user how to proceed rather than pushing it as a side effect.

- [ ] **Step 4: Apply (only after explicit approval)**

Run from the repo root: `supabase db push`
Expected: reports `20260903000000_admin_roster_moves.sql` applied.

- [ ] **Step 5: Verify the backfill read-only**

Write a scratchpad probe `verify-is-captain.cjs` using the same env-loading and `fetchAll` pattern as the Task 4 script. It must:
- Fetch `event_registrations` (`id, team_id, registration_slot_id, is_captain`) and `registration_slots` (`id, is_captain, event_registration_id`).
- Assert every reg with `team_id IS NOT NULL AND registration_slot_id IS NULL` has `is_captain === true`.
- Assert every forward-linked mirror's `is_captain` equals its slot's `is_captain`.
- Assert every reverse-linked mirror's `is_captain` equals its slot's `is_captain`.
- Assert every solo (`team_id === null`, not a mirror) has `is_captain === false`.
- Print counts for each category and exit non-zero on any mismatch.

Grep it for write calls before running:

```bash
grep -qE "\.(insert|update|upsert|delete|rpc)\(" <scratchpad>/verify-is-captain.cjs && echo ABORT || node <scratchpad>/verify-is-captain.cjs
```

Expected: all assertions pass, exit code 0.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260903000000_admin_roster_moves.sql frontend/lib/supabase/types.ts
git commit -m "feat: add is_captain column to event_registrations"
```

---

### Task 3: Rewire both dedup call sites

**Files:**
- Modify: `frontend/sanity/lib/eventSeats.ts`
- Modify: `frontend/lib/tournamentRoster.ts`

**Interfaces:**
- Consumes: `buildMirrorRegIds` from Task 1; `is_captain` from Task 2.
- Produces: `getEventSeatCounts` and `getTournamentRoster` with unchanged signatures and unchanged output on today's data. `RosterMember.isCaptain` now comes from the column.

- [ ] **Step 1: Rewrite `getEventSeatCounts`**

In `frontend/sanity/lib/eventSeats.ts`, add the import:

```ts
import { buildMirrorRegIds } from '@/lib/registrationDedup'
```

Replace the two queries and the counting loops. The slot query drops its `.not(...)` status filter — **status filtering moves into JS** because the mirror set needs every slot while the seat count needs only active ones:

```ts
  // Fetch ALL slots (not just active). The mirror set below needs every slot;
  // seat counting filters to active ones in JS.
  const { data: slots } = await admin
    .from('registration_slots')
    .select('event_sanity_id, status, event_registration_id')
    .in('event_sanity_id', unique)

  const { data: regs } = await admin
    .from('event_registrations')
    .select('id, event_sanity_id, registration_type, registration_slot_id')
    .in('event_sanity_id', unique)
    .in('status', ['paid', 'pending'])

  // 1. Active slots — one seat each.
  for (const s of slots ?? []) {
    if (s.status === 'expired' || s.status === 'cancelled') continue
    add(s.event_sanity_id)
  }

  // 2. Active registrations, excluding slot mirrors and volunteers.
  const mirrorRegIds = buildMirrorRegIds(regs ?? [], slots ?? [])
  for (const r of regs ?? []) {
    if (r.registration_type === 'volunteer') continue
    if (mirrorRegIds.has(r.id)) continue
    add(r.event_sanity_id)
  }
```

Delete the now-unused `teamIds` / `modeByTeamId` block and the `teams` query in this file. Update the function's doc comment: the dedup rule is now the slot↔reg link, not `team.payment_mode`.

- [ ] **Step 2: Rewrite the dedup in `getTournamentRoster`**

In `frontend/lib/tournamentRoster.ts`:

Add the import:

```ts
import { buildMirrorRegIds } from '@/lib/registrationDedup'
```

Add `is_captain` to the `event_registrations` select string (it already selects `registration_slot_id`):

```ts
        'id, user_id, team_id, registration_type, team_name, player_first_name, player_last_name, player_email, player_phone, metadata, status, amount_paid, is_captain, registration_slot_id, stripe_payment_intent_id',
```

After `const slots = slotsRes.data ?? []`, add:

```ts
  const mirrorRegIds = buildMirrorRegIds(regs, slots)
```

`modeByTeamId` is still used for display, so leave it in place.

In the registration loop (section 2), replace the payment-mode skip:

```ts
    // OLD — delete this line:
    // if (r.team_id && modeByTeamId.get(r.team_id) !== 'captain_pays_all') continue

    // NEW:
    if (mirrorRegIds.has(r.id)) continue
```

And replace the captain inference:

```ts
    // OLD: isCaptain: !!r.team_id,
    isCaptain: r.is_captain,
```

Update the function's doc comment to describe the structural rule.

- [ ] **Step 3: Typecheck and lint**

Run: `npm run type-check && npm run lint`
Expected: no errors. If `modeByTeamId` is now unused in `eventSeats.ts`, delete it — an unused variable will fail lint.

- [ ] **Step 4: Commit**

```bash
git add frontend/sanity/lib/eventSeats.ts frontend/lib/tournamentRoster.ts
git commit -m "refactor: dedup registrations by slot link instead of payment_mode"
```

---

### Task 4: Verify the refactor against the recorded baseline

**Files:**
- Verify with: scratchpad script (uncommitted)

**Interfaces:**
- Consumes: the rewritten `getEventSeatCounts` from Task 3.
- Produces: a pass/fail gate. Phase 2 does not begin until this passes.

- [ ] **Step 1: Write the baseline comparison probe**

Write `verify-seat-baseline.cjs` to the scratchpad. It reimplements the **new** rule directly against the database (not by importing the TS module) and compares to the Global Constraints baseline table:

```js
// READ-ONLY. Recomputes seat counts under the new structural rule and
// compares them to the 2026-09-03 recorded baseline.
const fs = require('fs'), path = require('path')
const F = 'C:/Users/brady/fendo-website-next-sanity/frontend'
const env = {}
for (const l of fs.readFileSync(path.join(F, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const { createClient } = require(path.join(F, 'node_modules/@supabase/supabase-js'))
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
async function all(t, c) {
  const o = []
  for (let f = 0; ; f += 1000) {
    const { data, error } = await db.from(t).select(c).range(f, f + 999)
    if (error) throw new Error(`${t}: ${error.message}`)
    o.push(...data)
    if (data.length < 1000) break
  }
  return o
}
const BASELINE = {
  '5c7db159-08a4-4364-9149-9e7921c989dc': 0,
  '6aa70a3e-f5e4-40c3-a56a-71cbbbb30545': 78,
  'aca3171e-d714-48b7-b172-0b3aff071978': 1,
  'b4aca70e-5f03-4c72-8b39-f9cb39770889': 1,
  'b6b2fc0b-98f3-4a00-8cf6-b09219a25f6b': 0,
  'c268ec9d-af45-4075-8bf6-d7a9a00f1d38': 0,
  'cbe625c5-97e9-4813-82df-9ab2c345bc99': 0,
  'cf488c87-c673-4407-84cc-07e2da9aa12a': 0,
  'cf7491d6-5bd9-4a77-a544-73232ee75fc7': 4,
  'ecbfbfc9-22d0-403b-b639-3048aac8f125': 1,
}
Promise.all([
  all('event_registrations', 'id, event_sanity_id, registration_type, status, registration_slot_id'),
  all('registration_slots', 'event_sanity_id, status, event_registration_id'),
]).then(([regs, slots]) => {
  const regIds = new Set(regs.map((r) => r.id))
  const mirrors = new Set()
  for (const r of regs) if (r.registration_slot_id) mirrors.add(r.id)
  for (const s of slots) {
    if (s.event_registration_id && regIds.has(s.event_registration_id)) mirrors.add(s.event_registration_id)
  }
  const seats = {}
  const bump = (e) => { seats[e] = (seats[e] || 0) + 1 }
  for (const e of Object.keys(BASELINE)) seats[e] = 0
  for (const s of slots) {
    if (s.status === 'expired' || s.status === 'cancelled') continue
    bump(s.event_sanity_id)
  }
  for (const r of regs) {
    if (r.status !== 'paid' && r.status !== 'pending') continue
    if (r.registration_type === 'volunteer') continue
    if (mirrors.has(r.id)) continue
    bump(r.event_sanity_id)
  }
  let bad = 0
  for (const [e, want] of Object.entries(BASELINE)) {
    const got = seats[e] ?? 0
    if (got !== want) { console.error(`DRIFT ${e}: baseline=${want} now=${got}`); bad++ }
    else console.log(`ok    ${e}: ${got}`)
  }
  for (const e of Object.keys(seats)) {
    if (!(e in BASELINE)) console.log(`NEW EVENT (not in baseline) ${e}: ${seats[e]}`)
  }
  console.log(bad === 0 ? '\nBASELINE MATCH' : `\n${bad} EVENT(S) DRIFTED`)
  process.exit(bad ? 1 : 0)
}).catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
```

- [ ] **Step 2: Confirm read-only, then run**

```bash
grep -qE "\.(insert|update|upsert|delete|rpc)\(" <scratchpad>/verify-seat-baseline.cjs && echo ABORT || node <scratchpad>/verify-seat-baseline.cjs
```

Expected: ten `ok` lines and `BASELINE MATCH`, exit code 0.

A `DRIFT` line means either the refactor is wrong or real registrations changed since 2026-09-03. Distinguish them: a drift of exactly the size of a recent signup on a live event is legitimate — confirm against `/admin/registrations`. Any drift you cannot explain by new signups **stops Phase 1**; do not start Phase 2.

- [ ] **Step 3: Cross-check the app agrees**

Run: `npm run dev`, then open `/admin/tournaments/6aa70a3e-f5e4-40c3-a56a-71cbbbb30545/teams`.
Expected: the "Total Players" stat reads **78**, matching the baseline. Confirm the roster still groups teams correctly and no member is duplicated or missing.

Stop the dev server when done.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 5: Commit (verification notes only, if any)**

No code change is expected here. If Step 2 or 3 forced a fix, commit it:

```bash
git add -A
git commit -m "fix: correct dedup refactor to match recorded seat baseline"
```

---

# PHASE 2 — The move primitive (server)

---

### Task 5: Move action scaffolding — types, guards, and shared helpers

**Files:**
- Create: `frontend/app/admin/tournaments/[id]/teams/moveActions.ts`

**Interfaces:**
- Consumes: `getTournamentRoster`, `RosterEntry`, `RosterMember` from `@/lib/tournamentRoster`; `createAdminClient`; `createClient`.
- Produces, for Tasks 6–9 and the UI:
  - `type MoveDestination = { kind: 'existingTeam'; teamId: string } | { kind: 'newTeam'; name: string; teamSize: number } | { kind: 'solo' }`
  - `interface MemberRef { sourceTable: RosterMemberSource; sourceId: string; linkedRegistrationId: string | null }`
  - `interface MoveOptions { newCaptainByTeamId: Record<string, MemberRef>; confirmOverflow: boolean; confirmEmptyTeams: string[] }`
  - `interface MoveResult { error?: string; moved: number; failed: { sourceId: string; reason: string }[]; notes: string[] }`
  - Module-internal (NOT exported — see the `'use server'` constraint): `recalcTeamStatus(db, teamId)`, `findMember(roster, ref)`, `requireAdmin()`, `revalidateRoster(id)`.

- [ ] **Step 1: Create the file with types, auth guard, and status recalculation**

Create `frontend/app/admin/tournaments/[id]/teams/moveActions.ts`:

```ts
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
async function recalcTeamStatus(
  db: ReturnType<typeof createAdminClient>,
  teamId: string,
): Promise<void> {
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
```

- [ ] **Step 2: Typecheck**

Run: `npm run type-check`
Expected: no errors. Unused-export warnings are fine at this stage; Tasks 6–9 consume these.

- [ ] **Step 3: Commit**

```bash
git add "frontend/app/admin/tournaments/[id]/teams/moveActions.ts"
git commit -m "feat: scaffold roster move actions with team status recalculation"
```

---

### Task 6: `movePlayers` — move into an existing team

**Files:**
- Modify: `frontend/app/admin/tournaments/[id]/teams/moveActions.ts`

**Interfaces:**
- Consumes: everything from Task 5.
- Produces: `movePlayers(eventSanityId: string, members: MemberRef[], destination: MoveDestination, options: MoveOptions): Promise<MoveResult>` — Tasks 7 and 8 extend its `destination` branches; the UI calls it.

- [ ] **Step 1: Add the per-member write helper**

Append to `moveActions.ts`:

```ts
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
  db: ReturnType<typeof createAdminClient>,
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
```

- [ ] **Step 2: Add `movePlayers` with the `existingTeam` branch**

Append:

```ts
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
    if (!hit) return { error: 'A selected player is no longer on this roster. Reload and try again.', moved: 0, failed: [], notes: [] }
    resolved.push({ ref, member: hit.member, entry: hit.entry })
  }

  // Volunteers must never be moved — a move rewrites registration_type, which
  // would convert them into a counted player and change spots-filled.
  const { data: volunteerCheck } = await db
    .from('event_registrations')
    .select('id')
    .in(
      'id',
      resolved
        .map((r) => (r.member.sourceTable === 'event_registrations' ? r.member.sourceId : null))
        .filter((id): id is string => !!id),
    )
    .eq('registration_type', 'volunteer')
  if ((volunteerCheck ?? []).length > 0) {
    return { error: 'Volunteers cannot be moved between teams', moved: 0, failed: [], notes: [] }
  }

  const notes: string[] = []
  let dest: DestTeamContext | null = null

  if (destination.kind === 'existingTeam') {
    const { data: team } = await db
      .from('teams')
      .select('id, event_sanity_id, team_name, registration_type, invite_code, max_members, team_status')
      .eq('id', destination.teamId)
      .maybeSingle()

    if (!team) return { error: 'Destination team not found', moved: 0, failed: [], notes: [] }
    if (team.event_sanity_id !== eventSanityId) {
      return { error: 'Destination team belongs to a different tournament', moved: 0, failed: [], notes: [] }
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

  return await executeMoves(db, eventSanityId, roster, resolved, dest, destination, options, check.email, notes)
}

/** auth user id of a team's current captain, for slot ownership rewrites. */
async function resolveCaptainUserId(
  db: ReturnType<typeof createAdminClient>,
  teamId: string,
): Promise<string | null> {
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
```

- [ ] **Step 3: Add the shared execution routine**

Append:

```ts
/**
 * Applies the resolved moves, then repairs every affected team: captain
 * reassignment, status recalculation, and soft-cancelling emptied teams.
 *
 * Not transactional. Because dedup is structural, `team_id` does not affect
 * whether a player is counted, so a partially applied move is cosmetic and
 * re-running repairs it.
 */
async function executeMoves(
  db: ReturnType<typeof createAdminClient>,
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

  // Captain vacancy check: any source team losing its captain while keeping
  // members must have a named replacement.
  for (const teamId of sourceTeamIds) {
    if (dest && teamId === dest.teamId) continue
    const entry = roster.find((e) => e.teamId === teamId)
    if (!entry) continue
    const leaving = new Set(resolved.filter((r) => r.entry.teamId === teamId).map((r) => r.member.sourceId))
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
      destination.kind === 'newTeam' &&
      options.newTeamCaptain?.sourceId === r.member.sourceId
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

/** Sets exactly one captain on a team and repoints slot ownership to them. */
async function promoteCaptain(
  db: ReturnType<typeof createAdminClient>,
  teamId: string,
  ref: MemberRef,
): Promise<void> {
  await db.from('registration_slots').update({ is_captain: false }).eq('team_id', teamId)
  await db.from('event_registrations').update({ is_captain: false }).eq('team_id', teamId)

  if (ref.sourceTable === 'registration_slots') {
    await db.from('registration_slots').update({ is_captain: true }).eq('id', ref.sourceId)
    if (ref.linkedRegistrationId) {
      await db.from('event_registrations').update({ is_captain: true }).eq('id', ref.linkedRegistrationId)
    }
  } else {
    await db.from('event_registrations').update({ is_captain: true }).eq('id', ref.sourceId)
  }

  const captainUserId = await resolveCaptainUserId(db, teamId)
  await db.from('registration_slots').update({ invited_by_user_id: captainUserId }).eq('team_id', teamId)
}
```

- [ ] **Step 4: Typecheck and lint**

Run: `npm run type-check && npm run lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "frontend/app/admin/tournaments/[id]/teams/moveActions.ts"
git commit -m "feat: move players between existing teams with capacity and captain guards"
```

---

### Task 7: `movePlayers` — create a new team as the destination

**Files:**
- Modify: `frontend/app/admin/tournaments/[id]/teams/moveActions.ts`

**Interfaces:**
- Consumes: `movePlayers` and `DestTeamContext` from Task 6.
- Produces: the `newTeam` branch of `MoveDestination`, plus `generateInviteCode()` reused locally.

- [ ] **Step 1: Add invite-code generation**

The checkout route has its own generator. Append a local copy to `moveActions.ts` (the existing one is not exported):

```ts
/** 6-character A–Z/2–9 code, matching the format used by Stripe checkout. */
function generateInviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}
```

Verify the alphabet and length against `generateInviteCode` in `frontend/app/api/stripe/checkout/route.ts` (or wherever it is imported from) and match it exactly. If it is already exported from a shared lib, import that instead of duplicating.

- [ ] **Step 2: Add the `newTeam` branch**

In `movePlayers`, after the `existingTeam` branch, add:

```ts
  if (destination.kind === 'newTeam') {
    const name = destination.name.trim()
    if (!name) return { error: 'Team name is required', moved: 0, failed: [], notes: [] }
    if (!options.newTeamCaptain) {
      return { error: 'Choose which player captains the new team', moved: 0, failed: [], notes: [] }
    }
    if (!resolved.some((r) => r.member.sourceId === options.newTeamCaptain!.sourceId)) {
      return { error: 'The chosen captain is not among the selected players', moved: 0, failed: [], notes: [] }
    }

    const size = Math.max(destination.teamSize, resolved.length)

    // event_slug is a historical snapshot column. Copy it from an existing team
    // on this event so the new team carries the same value as its members.
    const { data: slugRow } = await db
      .from('teams')
      .select('event_slug')
      .eq('event_sanity_id', eventSanityId)
      .limit(1)
      .maybeSingle()

    let created: { id: string; invite_code: string; team_name: string; registration_type: string } | null = null
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await db
        .from('teams')
        .insert({
          event_sanity_id: eventSanityId,
          event_slug: slugRow?.event_slug ?? eventSanityId,
          team_name: name,
          invite_code: generateInviteCode(),
          created_by: null,
          registration_type: size === 2 ? 'duo' : 'team',
          max_members: size,
          payment_mode: 'individual',
          team_status: 'pending',
          expires_at: null,
        })
        .select('id, invite_code, team_name, registration_type')
        .single()

      if (!error && data) { created = data; break }
      if (error && error.code !== '23505') {
        return { error: 'Failed to create the new team', moved: 0, failed: [], notes: [] }
      }
    }
    if (!created) {
      return { error: 'Could not generate a unique invite code', moved: 0, failed: [], notes: [] }
    }

    notes.push(`Created team ${created.team_name} (code ${created.invite_code}).`)
    dest = {
      teamId: created.id,
      teamName: created.team_name,
      registrationType: created.registration_type,
      inviteCode: created.invite_code,
      captainUserId: null, // set below, after the captain's row is moved
    }
  }
```

- [ ] **Step 3: Repoint ownership after the new team's captain lands**

In `executeMoves`, after the move loop and before the replacement-captain loop, add:

```ts
  // A brand-new team has no captain until its members arrive, so ownership is
  // resolved after the moves rather than before.
  if (destination.kind === 'newTeam' && dest && options.newTeamCaptain) {
    await promoteCaptain(db, dest.teamId, options.newTeamCaptain)
    if (options.newTeamCaptain.sourceTable === 'event_registrations') {
      const { data: capReg } = await db
        .from('event_registrations')
        .select('user_id')
        .eq('id', options.newTeamCaptain.sourceId)
        .maybeSingle()
      await db.from('teams').update({ created_by: capReg?.user_id ?? null }).eq('id', dest.teamId)
    } else {
      const { data: capSlot } = await db
        .from('registration_slots')
        .select('app_user_id')
        .eq('id', options.newTeamCaptain.sourceId)
        .maybeSingle()
      await db.from('teams').update({ created_by: capSlot?.app_user_id ?? null }).eq('id', dest.teamId)
    }
  }
```

- [ ] **Step 4: Typecheck and lint**

Run: `npm run type-check && npm run lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "frontend/app/admin/tournaments/[id]/teams/moveActions.ts"
git commit -m "feat: create a new team as a move destination"
```

---

### Task 8: `movePlayers` — detach to solo, with the blocked case

**Files:**
- Modify: `frontend/app/admin/tournaments/[id]/teams/moveActions.ts`

**Interfaces:**
- Consumes: Tasks 5–7.
- Produces: the `solo` branch. Slot members without a mirror reg are refused.

- [ ] **Step 1: Add the guard in `movePlayers`**

After the `newTeam` branch:

```ts
  if (destination.kind === 'solo') {
    if (resolved.length !== 1) {
      return { error: 'Detach to solo one player at a time', moved: 0, failed: [], notes: [] }
    }
    const only = resolved[0].member
    if (only.sourceTable === 'registration_slots' && !only.linkedRegistrationId) {
      return {
        error:
          'This player has no standalone registration record to keep, so they cannot become a solo entry. Create a one-person team for them instead.',
        moved: 0,
        failed: [],
        notes: [],
      }
    }
    dest = null
  }
```

- [ ] **Step 2: Handle the slot-with-mirror detach**

`applyMemberMove` currently refuses every slot member when `dest` is null. Replace that early return with the link-clearing path:

```ts
  if (member.sourceTable === 'registration_slots') {
    if (!dest) {
      // Detach to solo: the mirrored ledger row becomes the player's
      // standalone registration, and the slot is retired.
      //
      // ORDER MATTERS. The reg row is promoted FIRST so that a failure
      // between the two writes double-counts the player briefly rather than
      // making them disappear. Re-running the move repairs it.
      if (!member.linkedRegistrationId) return 'No standalone registration record to keep'

      const { data: mirror } = await db
        .from('event_registrations')
        .select('metadata')
        .eq('id', member.linkedRegistrationId)
        .maybeSingle()

      const meta = mergeHistory(mirror?.metadata) as Record<string, unknown>
      meta.teamId = null
      meta.inviteCode = null

      const { error: regErr } = await db
        .from('event_registrations')
        .update({
          team_id: null,
          team_name: null,
          registration_type: 'individual',
          is_captain: false,
          registration_slot_id: null,
          metadata: meta,
        })
        .eq('id', member.linkedRegistrationId)
      if (regErr) return regErr.message

      const { error: slotErr } = await db
        .from('registration_slots')
        .update({ status: 'cancelled', event_registration_id: null })
        .eq('id', member.sourceId)
      if (slotErr) return slotErr.message

      return null
    }
    // ... existing move-to-team code continues here
```

> This is the one place in the plan that writes a member-level status. It is deliberate and load-bearing: the slot must be retired or the player occupies two seats. The Global Constraint still holds for every other code path.

- [ ] **Step 3: Typecheck and lint**

Run: `npm run type-check && npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "frontend/app/admin/tournaments/[id]/teams/moveActions.ts"
git commit -m "feat: detach a player from their team to a solo entry"
```

---

### Task 9: `setTeamCaptain` standalone action

**Files:**
- Modify: `frontend/app/admin/tournaments/[id]/teams/moveActions.ts`

**Interfaces:**
- Consumes: `promoteCaptain`, `requireAdmin`, `revalidateRoster`, `findMember`.
- Produces: `setTeamCaptain(eventSanityId: string, teamId: string, member: MemberRef): Promise<{ error?: string }>` — the UI calls it.

- [ ] **Step 1: Add the action**

```ts
export async function setTeamCaptain(
  eventSanityId: string,
  teamId: string,
  member: MemberRef,
): Promise<{ error?: string }> {
  const check = await requireAdmin()
  if ('error' in check) return { error: check.error }

  const roster = await getTournamentRoster(eventSanityId)
  const entry = roster.find((e) => e.kind === 'team' && e.teamId === teamId)
  if (!entry) return { error: 'Team not found' }

  const hit = findMember(roster, member)
  if (!hit || hit.entry.teamId !== teamId) {
    return { error: 'That player is not on this team' }
  }

  const db = createAdminClient()
  await promoteCaptain(db, teamId, member)

  revalidateRoster(eventSanityId)
  return {}
}
```

- [ ] **Step 2: Typecheck, lint, build**

Run: `npm run type-check && npm run lint && npm run build`
Expected: all succeed.

- [ ] **Step 3: Commit**

```bash
git add "frontend/app/admin/tournaments/[id]/teams/moveActions.ts"
git commit -m "feat: add standalone team captain reassignment action"
```

---

# PHASE 3 — UI

---

### Task 10: Selection state and the sticky action bar

**Files:**
- Modify: `frontend/app/components/admin/TournamentRosterTable.tsx`

**Interfaces:**
- Consumes: `RosterEntry`, `RosterMember`.
- Produces: a `selected: MemberRef[]` state in the table, a `Move` per-row shortcut, and mount points for the Task 11 and 12 modals.

- [ ] **Step 1: Add selection state to the main component**

In `TournamentRosterTable` (starts line 579), add near the other `useState` calls:

```tsx
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [moveOpen, setMoveOpen] = useState(false)
  const [captainTeamId, setCaptainTeamId] = useState<string | null>(null)

  const keyOf = (m: RosterMember) => `${m.sourceTable}:${m.sourceId}`

  const toggle = (m: RosterMember) =>
    setSelectedIds((prev) => {
      const next = new Set(prev)
      const k = keyOf(m)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })

  const selectedMembers = entries.flatMap((e) =>
    e.members.filter((m) => selectedIds.has(keyOf(m))),
  )
```

- [ ] **Step 2: Add a checkbox and a Move shortcut to `MemberRow`**

`MemberRow` (line 519) gains three props: `selected: boolean`, `onToggle: () => void`, `onMove: () => void`. Render the checkbox as the row's first cell:

```tsx
      <td className="px-3 py-2 w-8">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={`Select ${member.firstName} ${member.lastName}`}
          className="accent-fg w-4 h-4 cursor-pointer"
        />
      </td>
```

And a Move button beside the existing row actions:

```tsx
        <button
          type="button"
          onClick={onMove}
          className="text-xs text-muted hover:text-fg transition-colors"
        >
          Move
        </button>
```

`onMove` selects just this member and opens the modal:

```tsx
  onMove={() => {
    setSelectedIds(new Set([keyOf(member)]))
    setMoveOpen(true)
  }}
```

Add a matching empty `<th className="w-8" />` to each header row so columns stay aligned.

- [ ] **Step 3: Add the sticky action bar**

At the end of the component's returned JSX:

```tsx
      {selectedMembers.length > 0 && (
        <div className="sticky bottom-4 z-40 mx-auto w-fit flex items-center gap-3 rounded-xl border border-border bg-bg px-4 py-2.5 shadow-2xl">
          <span className="text-sm text-muted">
            {selectedMembers.length} player{selectedMembers.length === 1 ? '' : 's'} selected
          </span>
          <button
            type="button"
            onClick={() => setMoveOpen(true)}
            className="text-sm font-medium text-fg hover:opacity-70 transition-opacity"
          >
            Move…
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="text-sm text-muted hover:text-fg transition-colors"
          >
            Clear
          </button>
        </div>
      )}
```

- [ ] **Step 4: Verify**

Run: `npm run type-check && npm run lint`
Expected: no errors.

Run: `npm run dev`, open `/admin/tournaments/6aa70a3e-f5e4-40c3-a56a-71cbbbb30545/teams`.
Expected: checkboxes appear, selecting players shows the bar with the right count, Clear empties it, columns stay aligned. Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/components/admin/TournamentRosterTable.tsx
git commit -m "feat: add player selection and action bar to tournament roster"
```

---

### Task 11: `MovePlayersModal`

**Files:**
- Create: `frontend/app/components/admin/roster/MovePlayersModal.tsx`
- Modify: `frontend/app/components/admin/TournamentRosterTable.tsx`

**Interfaces:**
- Consumes: `movePlayers`, `MoveDestination`, `MemberRef`, `MoveResult` from `moveActions.ts`; `RosterEntry`, `RosterMember`.
- Produces: `<MovePlayersModal eventSanityId entries selected onClose />`.

- [ ] **Step 1: Create the modal**

Create `frontend/app/components/admin/roster/MovePlayersModal.tsx`. It is a client component (it has event handlers — a missing `'use client'` causes an RSC serialization error).

```tsx
'use client'

import { useState } from 'react'
import type { RosterEntry, RosterMember } from '@/lib/tournamentRoster'
import { movePlayers, type MemberRef, type MoveDestination } from '@/app/admin/tournaments/[id]/teams/moveActions'

const OVERLAY = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'
const PANEL = 'bg-bg border border-border rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto'
const FIELD = 'w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-fg focus:outline-none focus:border-fg/40'

const refOf = (m: RosterMember): MemberRef => ({
  sourceTable: m.sourceTable,
  sourceId: m.sourceId,
  linkedRegistrationId: m.linkedRegistrationId,
})

export default function MovePlayersModal({
  eventSanityId,
  entries,
  selected,
  onClose,
}: {
  eventSanityId: string
  entries: RosterEntry[]
  selected: RosterMember[]
  onClose: () => void
}) {
  const [kind, setKind] = useState<MoveDestination['kind']>('existingTeam')
  const [teamId, setTeamId] = useState('')
  const [teamName, setTeamName] = useState('')
  const [teamSize, setTeamSize] = useState(Math.max(selected.length, 2))
  const [newTeamCaptainId, setNewTeamCaptainId] = useState(selected[0]?.sourceId ?? '')
  const [replacements, setReplacements] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedKeys = new Set(selected.map((m) => `${m.sourceTable}:${m.sourceId}`))
  const teams = entries.filter(
    (e) => e.kind === 'team' && e.teamStatus !== 'cancelled' && e.teamStatus !== 'expired',
  )
  const destTeam = teams.find((t) => t.teamId === teamId)

  // Source teams losing their captain while keeping members.
  const vacancies = entries.filter((e) => {
    if (e.kind !== 'team' || !e.teamId || e.teamId === teamId) return false
    const leaving = e.members.filter((m) => selectedKeys.has(`${m.sourceTable}:${m.sourceId}`))
    if (leaving.length === 0) return false
    const remaining = e.members.length - leaving.length
    return remaining > 0 && leaving.some((m) => m.isCaptain)
  })

  // Source teams that will be emptied.
  const emptied = entries.filter((e) => {
    if (e.kind !== 'team' || !e.teamId || e.teamId === teamId) return false
    const leaving = e.members.filter((m) => selectedKeys.has(`${m.sourceTable}:${m.sourceId}`))
    return leaving.length > 0 && leaving.length === e.members.length
  })

  const incoming = selected.filter((m) => {
    const owner = entries.find((e) => e.members.some((x) => x.sourceId === m.sourceId))
    return owner?.teamId !== teamId
  }).length
  const projected = (destTeam?.members.length ?? 0) + incoming

  // The server holds the authoritative max_members and is the real gate. The
  // client warns whenever the destination is gaining players, so the admin sees
  // the projected size before confirming.
  const willOverflow = kind === 'existingTeam' && !!destTeam && incoming > 0

  const soloBlocked =
    selected.length !== 1 ||
    (selected[0].sourceTable === 'registration_slots' && !selected[0].linkedRegistrationId)

  async function submit() {
    setBusy(true)
    setError(null)

    const destination: MoveDestination =
      kind === 'existingTeam'
        ? { kind: 'existingTeam', teamId }
        : kind === 'newTeam'
          ? { kind: 'newTeam', name: teamName, teamSize }
          : { kind: 'solo' }

    const newCaptainByTeamId: Record<string, MemberRef> = {}
    for (const v of vacancies) {
      const chosenId = replacements[v.teamId!]
      const m = v.members.find((x) => x.sourceId === chosenId)
      if (m) newCaptainByTeamId[v.teamId!] = refOf(m)
    }

    const captain = selected.find((m) => m.sourceId === newTeamCaptainId)

    const result = await movePlayers(
      eventSanityId,
      selected.map(refOf),
      destination,
      {
        newCaptainByTeamId,
        confirmOverflow: true,
        confirmEmptyTeams: emptied.map((e) => e.teamId!).filter(Boolean),
        newTeamCaptain: kind === 'newTeam' && captain ? refOf(captain) : undefined,
      },
    )

    setBusy(false)
    if (result.error) { setError(result.error); return }
    onClose()
  }

  const ready =
    (kind === 'existingTeam' && !!teamId) ||
    (kind === 'newTeam' && teamName.trim().length > 0 && !!newTeamCaptainId) ||
    (kind === 'solo' && !soloBlocked)

  const allVacanciesFilled = vacancies.every((v) => replacements[v.teamId!])

  return (
    <div className={OVERLAY} role="dialog" aria-modal="true">
      <div className={PANEL}>
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-fg">
            Move {selected.length} player{selected.length === 1 ? '' : 's'}
          </h3>
          <p className="text-xs text-muted mt-1">
            {selected.map((m) => `${m.firstName} ${m.lastName}`).join(', ')}
          </p>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Destination */}
          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-muted mb-1">Destination</legend>

            <label className="flex items-center gap-2 text-sm text-fg">
              <input type="radio" checked={kind === 'existingTeam'} onChange={() => setKind('existingTeam')} />
              An existing team
            </label>
            {kind === 'existingTeam' && (
              <select className={FIELD} value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                <option value="">Choose a team…</option>
                {teams.map((t) => (
                  <option key={t.teamId} value={t.teamId!}>
                    {t.teamName} — {t.members.length} player{t.members.length === 1 ? '' : 's'}
                  </option>
                ))}
              </select>
            )}

            <label className="flex items-center gap-2 text-sm text-fg">
              <input type="radio" checked={kind === 'newTeam'} onChange={() => setKind('newTeam')} />
              A new team
            </label>
            {kind === 'newTeam' && (
              <div className="space-y-2">
                <input className={FIELD} placeholder="Team name" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
                <label className="block text-xs text-muted">
                  Team size
                  <input
                    type="number"
                    min={selected.length}
                    className={FIELD}
                    value={teamSize}
                    onChange={(e) => setTeamSize(Number(e.target.value))}
                  />
                </label>
                <label className="block text-xs text-muted">
                  Captain
                  <select className={FIELD} value={newTeamCaptainId} onChange={(e) => setNewTeamCaptainId(e.target.value)}>
                    {selected.map((m) => (
                      <option key={m.sourceId} value={m.sourceId}>
                        {m.firstName} {m.lastName}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            <label className="flex items-center gap-2 text-sm text-fg">
              <input type="radio" checked={kind === 'solo'} onChange={() => setKind('solo')} disabled={soloBlocked} />
              <span className={soloBlocked ? 'text-muted' : ''}>No team (solo entry)</span>
            </label>
            {kind === 'solo' && soloBlocked && (
              <p className="text-xs text-muted">
                {selected.length !== 1
                  ? 'Detach one player at a time.'
                  : 'This player has no standalone registration record to keep. Create a one-person team for them instead.'}
              </p>
            )}
          </fieldset>

          {/* Replacement captains */}
          {vacancies.map((v) => (
            <label key={v.teamId} className="block text-xs text-muted">
              New captain for {v.teamName}
              <select
                className={FIELD}
                value={replacements[v.teamId!] ?? ''}
                onChange={(e) => setReplacements((p) => ({ ...p, [v.teamId!]: e.target.value }))}
              >
                <option value="">Choose…</option>
                {v.members
                  .filter((m) => !selectedKeys.has(`${m.sourceTable}:${m.sourceId}`))
                  .map((m) => (
                    <option key={m.sourceId} value={m.sourceId}>
                      {m.firstName} {m.lastName}
                    </option>
                  ))}
              </select>
            </label>
          ))}

          {/* Warnings */}
          <div className="space-y-1.5 text-xs">
            {willOverflow && destTeam && (
              <p className="text-fg">
                {destTeam.teamName} will have {projected} players. Its size will be raised to fit.
              </p>
            )}
            {emptied.map((e) => (
              <p key={e.teamId} className="text-fg">
                {e.teamName} will be left with no players and will be marked cancelled.
              </p>
            ))}
            <p className="text-muted">
              Payment records, refunds, and registration status are not affected.
            </p>
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
          <button type="button" onClick={onClose} className="text-sm text-muted hover:text-fg transition-colors">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !ready || !allVacanciesFilled}
            onClick={submit}
            className="px-4 py-2 bg-fg text-bg text-sm rounded-lg disabled:opacity-40 active:scale-[0.98] transition-transform"
          >
            {busy ? 'Moving…' : 'Confirm move'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Mount it in the roster table**

In `TournamentRosterTable.tsx`:

```tsx
import MovePlayersModal from '@/app/components/admin/roster/MovePlayersModal'
```

and at the end of the JSX:

```tsx
      {moveOpen && (
        <MovePlayersModal
          eventSanityId={eventSanityId}
          entries={entries}
          selected={selectedMembers}
          onClose={() => { setMoveOpen(false); setSelectedIds(new Set()) }}
        />
      )}
```

- [ ] **Step 3: Verify**

Run: `npm run type-check && npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/components/admin/roster/MovePlayersModal.tsx frontend/app/components/admin/TournamentRosterTable.tsx
git commit -m "feat: add move players modal with warnings and captain handling"
```

---

### Task 12: `ChangeCaptainModal`

**Files:**
- Create: `frontend/app/components/admin/roster/ChangeCaptainModal.tsx`
- Modify: `frontend/app/components/admin/TournamentRosterTable.tsx`

**Interfaces:**
- Consumes: `setTeamCaptain`, `MemberRef` from `moveActions.ts`.
- Produces: `<ChangeCaptainModal eventSanityId entry onClose />`.

- [ ] **Step 1: Create the modal**

```tsx
'use client'

import { useState } from 'react'
import type { RosterEntry } from '@/lib/tournamentRoster'
import { setTeamCaptain, type MemberRef } from '@/app/admin/tournaments/[id]/teams/moveActions'

const OVERLAY = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'
const PANEL = 'bg-bg border border-border rounded-2xl w-full max-w-md shadow-2xl'
const FIELD = 'w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-fg focus:outline-none focus:border-fg/40'

export default function ChangeCaptainModal({
  eventSanityId,
  entry,
  onClose,
}: {
  eventSanityId: string
  entry: RosterEntry
  onClose: () => void
}) {
  const current = entry.members.find((m) => m.isCaptain)
  const [choice, setChoice] = useState(current?.sourceId ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    const m = entry.members.find((x) => x.sourceId === choice)
    if (!m || !entry.teamId) return
    setBusy(true)
    setError(null)
    const ref: MemberRef = {
      sourceTable: m.sourceTable,
      sourceId: m.sourceId,
      linkedRegistrationId: m.linkedRegistrationId,
    }
    const result = await setTeamCaptain(eventSanityId, entry.teamId, ref)
    setBusy(false)
    if (result.error) { setError(result.error); return }
    onClose()
  }

  return (
    <div className={OVERLAY} role="dialog" aria-modal="true">
      <div className={PANEL}>
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-fg">Change captain — {entry.teamName}</h3>
        </div>
        <div className="px-5 py-4 space-y-3">
          <select className={FIELD} value={choice} onChange={(e) => setChoice(e.target.value)}>
            {entry.members.map((m) => (
              <option key={m.sourceId} value={m.sourceId}>
                {m.firstName} {m.lastName}{m.isCaptain ? ' (current captain)' : ''}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted">
            The new captain takes over managing this team&apos;s invites and player details.
            Payment records are not affected.
          </p>
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
        <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
          <button type="button" onClick={onClose} className="text-sm text-muted hover:text-fg transition-colors">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !choice || choice === current?.sourceId}
            onClick={submit}
            className="px-4 py-2 bg-fg text-bg text-sm rounded-lg disabled:opacity-40 active:scale-[0.98] transition-transform"
          >
            {busy ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add the team-header trigger and mount**

In the team header row of `TournamentRosterTable.tsx`, beside the existing Reminder buttons:

```tsx
              <button
                type="button"
                onClick={() => setCaptainTeamId(entry.teamId)}
                className="text-xs text-muted hover:text-fg transition-colors"
              >
                Change captain
              </button>
```

And at the end of the JSX:

```tsx
      {captainTeamId && (
        <ChangeCaptainModal
          eventSanityId={eventSanityId}
          entry={entries.find((e) => e.teamId === captainTeamId)!}
          onClose={() => setCaptainTeamId(null)}
        />
      )}
```

- [ ] **Step 3: Verify**

Run: `npm run type-check && npm run lint && npm run build`
Expected: all succeed.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/components/admin/roster/ChangeCaptainModal.tsx frontend/app/components/admin/TournamentRosterTable.tsx
git commit -m "feat: add standalone change captain modal"
```

---

### Task 13: Manual test matrix and the seat-neutrality invariant

**Files:**
- Verify only. No code changes expected.

**Interfaces:**
- Consumes: everything.
- Produces: a signed-off verification record.

> Run this against a **non-production event** if one is available. If you must use production data, record each event's "Total Players" before you begin and confirm it is unchanged after every single case.

- [ ] **Step 1: Record the pre-state**

Run the Task 4 baseline probe and save its output. Note the "Total Players" stat on the roster page for the event you will exercise.

- [ ] **Step 2: Work the matrix**

Start the dev server (`npm run dev`) and perform each case, checking after **every** one that the roster's Total Players stat is unchanged and no payment column moved:

- [ ] Solo → individual-pay team. Player appears under the team, not as captain.
- [ ] Solo → captain-pays-all team. Player appears, existing captain unchanged.
- [ ] Individual-pay member → cpa team. Appears once, not twice.
- [ ] cpa invitee → individual-pay team. Appears once.
- [ ] Move a captain out with a replacement named. Old team shows the new captain; the modal refused to submit before one was chosen.
- [ ] Move that empties a team. Warning shown; team disappears from the roster and reads `cancelled` in `/admin/teams`.
- [ ] Move that overflows `max_members`. Warning names the new size; `/admin/teams` shows the raised denominator.
- [ ] Two players from different teams → one new team, captain chosen. New team has an invite code.
- [ ] Detach-to-solo a player with a mirror reg. They appear in the Solo section.
- [ ] Detach-to-solo a player without one. **Expect refusal** with the one-person-team message.
- [ ] Change captain via the team-header action.

- [ ] **Step 3: Confirm the invariant**

Re-run the Task 4 baseline probe.
Expected: the per-event seat totals are **identical** to Step 1. Moves are seat-neutral; any change is a bug.

Also confirm on the roster page that Total Players equals the event's spots-filled figure.

- [ ] **Step 4: Confirm payment state is untouched**

Write a scratchpad probe that dumps `id, status, amount_paid, stripe_payment_intent_id` for every `event_registrations` row and `id, status, amount_due, stripe_payment_intent_id` for every `registration_slots` row on the test event, and diff it against the same dump taken at Step 1.

Expected: the only differences are the `registration_slots.status` values of players deliberately detached to solo (which become `cancelled`). Every amount and every `stripe_*` value is byte-identical.

- [ ] **Step 5: Stop the dev server and commit any fixes**

```bash
git add -A
git commit -m "fix: corrections from roster move manual verification"
```

---

## Rollback

- **Phase 3 / Phase 2:** revert the commits. No schema or data change is involved.
- **Phase 1 Task 3:** revert the commit; the old `payment_mode` rule returns and the `is_captain` column simply goes unread.
- **Phase 1 Task 2 (schema):** `ALTER TABLE public.event_registrations DROP COLUMN is_captain;` — the column is additive and nothing outside this feature reads it.
- **Data written by moves is not automatically reversible.** A move changes `team_id`, ownership and captaincy. `metadata.adminHistory` records what happened on each row, so a move can be reversed by hand, but there is no undo action. This is why Task 13 prefers a non-production event.
