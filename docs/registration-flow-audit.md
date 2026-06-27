# Registration Flow Audit & Remediation Plan

**Date:** 2026-06-27
**Tournament traced:** `sanity_event_id` = `6aa70a3e-f5e4-40c3-a56a-71cbbbb30545`
**Affected record example:** `player_email` = `stewartdylan0694@gmail.com` (in `registration_slots`, marked `paid`, no matching `event_registrations` row)
**Scope:** Diagnosis only — no code changes made in this session.

---

## 1. Executive Summary

The registration flow has **one critical, reproducible data-integrity bug** that explains the
"disappearing non-captain player" symptom, plus **two secondary defects** that compound the problem
and make it intermittent.

The critical bug: **For `paymentMode: 'individual'` teams, the Stripe webhook only writes an
`event_registrations` row when the paying user has an `app_user_id` (i.e. an authenticated app
account).** A non-captain teammate who pays via the public invite link never logs in, so
`app_user_id` stays `NULL`, the webhook's `mirrorUserId` guard is falsy, and **no
`event_registrations` row is ever created for them** — even though their `registration_slots` row is
correctly marked `paid`. The player "disappears" from every UI/admin view that sources from
`event_registrations`.

This is **not** a Stripe/webhook race condition. It is deterministic: any non-captain who pays
without first creating an app account will be missing their `event_registrations` row. The fact that
it has only surfaced for 1–2 of ~20 records means most non-captains on this tournament either (a)
created an account and claimed their slot, or (b) were on `captain_pays_all` teams where the captain's
single `event_registrations` row is the only one written by design.

---

## 2. The Two Registration Modes (Context)

The codebase supports two team-payment modes, set on the `teams` row at creation:

| Mode | Set in | Captain checkout | Non-captain checkout | `event_registrations` rows expected |
|---|---|---|---|---|
| `captain_pays_all` | `checkout/route.ts:437` | Captain pays for all N seats in one Stripe session | None — invitees never pay | **1** (captain only) |
| `individual` | `checkout/route.ts:163` | Captain pays for 1 seat (own slot) | Each invitee pays own slot via `/compete/invite/[token]` | **N** (one per paid player) |

The bug lives exclusively in the **`individual`** path, in the slot-payment webhook handler.

---

## 3. Critical Bug: Non-Captain `event_registrations` Row Never Written

### 3.1 Where the slot is correctly created

`frontend/app/api/stripe/checkout/route.ts:215-232` — captain checkout creates one
`registration_slots` row per invitee with:
- `is_captain: false`
- `app_user_id: null`  ← **key field**
- `status: 'invited'`
- `player_email`, `player_first_name`, `player_last_name`, `player_phone` from the form
- `metadata: { shirtSize }`

This insert is correct. The slot exists with all PII captured.

### 3.2 Where the invitee pays (public, unauthenticated)

`frontend/app/api/stripe/slot-checkout/route.ts` — the invitee clicks the email link, lands on
`/compete/invite/[token]`, and hits "Pay". This route:

- Loads the slot by `invite_token` (no auth required — correct).
- Creates a Stripe Checkout Session with `customer_email: slot.player_email` (line 71) — **no
  Supabase auth account is involved**.
- Sets session `metadata` (lines 87-94):
  ```js
  metadata: {
    type: 'slot',
    registrationSlotId: slot.id,
    teamId: slot.team_id,
    eventSanityId: slot.event_sanity_id,
    eventSlug: slot.event_slug,
    inviteToken: token,
  }
  ```
  **Note: there is no `userId` field here.** This is the root cause.

### 3.3 Where the webhook fails the non-captain

`frontend/app/api/stripe/webhook/route.ts:117-247` handles `meta.type === 'slot'`. After marking
the slot `paid` (lines 151-160, which works correctly), it attempts to mirror the payment into
`event_registrations`:

```js
// webhook/route.ts:184-247
const mirrorUserId = userId ?? null     // line 185
if (mirrorUserId) {                     // line 186  ← THE GATE
  // ... upsert event_registrations row ...
}
```

`userId` is destructured from `meta` on line 119:
```js
const { registrationSlotId, teamId, userId, eventSanityId, eventSlug, teamName, inviteCode } = meta
```

For a **captain** slot payment, `userId` is present (set in `checkout/route.ts:351` Stripe metadata).
For a **non-captain** slot payment created by `slot-checkout/route.ts`, **`userId` is never set in
the metadata** (see §3.2 above). So `mirrorUserId` is `undefined`, the `if (mirrorUserId)` guard is
false, and the entire `event_registrations` mirroring block is skipped.

**Result:** the slot row is `paid`, but no `event_registrations` row exists for the non-captain.
This matches the symptom for `stewartdylan0694@gmail.com` exactly.

### 3.4 Why the claim page doesn't always fix it

The claim page (`frontend/app/account/claim/[token]/page.tsx`) is the **only** other place an
`event_registrations` row is created for an individual-pay slot. It requires:

1. The user to be authenticated (`page.tsx:17` redirects to sign-in if not).
2. The slot's `player_email` to match `user.email` (`page.tsx:34`).
3. The slot status to be `paid` (`page.tsx:44`).

If the non-captain never creates an app account, the claim page is never visited, and the
`event_registrations` row is never created. **This is the gap.** Account creation is framed as
optional in the UI (`invite/[token]/success/page.tsx:164-184` presents it as "Create Your Player
Profile" — a nice-to-have), but it is in fact the *only* path that writes the missing row.

This contradicts the stated product requirement: **non-captain teammates must not be required to
create an app account.**

### 3.5 Why it's intermittent

- `captain_pays_all` teams: only 1 `event_registrations` row is expected (captain's). Invitees are
  tracked purely via `registration_slots` with `status: 'paid'`. No bug here — by design.
- `individual`-mode teams where the non-captain *did* create an account and visit `/account/claim/[token]`:
  the claim page writes the row. No visible bug.
- `individual`-mode teams where the non-captain *did not* create an account: **bug triggers**. This
  is the `stewartdylan0694@gmail.com` case.

So the bug only surfaces for the subset of individual-mode non-captains who skip account creation.
That matches "1–2 out of ~20."

---

## 4. Secondary Defect #1: Inline Fulfillment on Success Page Doesn't Mirror Either

`frontend/app/compete/invite/[token]/success/page.tsx:32-63` — when the webhook is slow, this page
does inline fulfillment: it marks the slot `paid` directly. But unlike the webhook, it **does not
attempt to create an `event_registrations` row at all** — not even a gated attempt.

This means even if we fix the webhook, a non-captain whose webhook is delayed/skipped and who lands
on the success page will still end up with a `paid` slot and no `event_registrations` row. The two
write paths are inconsistent.

### 4.1 Tertiary note: `event_title` snapshot is wrong on claim

`claim/[token]/page.tsx:76` writes `event_title: slot.event_slug` (the slug, not the title) because
the claim page doesn't fetch the Sanity event. Cosmetic, but worth fixing alongside.

---

## 5. Secondary Defect #2: `event_registrations.user_id` is `NOT NULL`

`supabase/migrations/20260330000000_event_registrations.sql:11`:
```sql
user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
```

This constraint means we **cannot** simply write an `event_registrations` row for a non-captain who
has no app account — there's no `user_id` to put in. Any fix for the critical bug must address this
schema constraint, either by:

- **(A) Making `user_id` nullable** and keying `event_registrations` off `(event_sanity_id,
  player_email)` for unauthenticated slot-payers, or
- **(B) Creating a lightweight `auth.users` / `profiles` stub** for every non-captain at invite time
  (heavier; changes account semantics), or
- **(C) Storing the non-captain's `event_registrations`-equivalent data entirely inside
  `registration_slots`** and updating all read paths (admin, account, compete, eventSeats) to union
  both tables.

Option **(A)** is the least invasive and keeps `event_registrations` as the single registration
ledger. Option **(C)** is what `eventSeats.ts` already does for seat counting, but every other read
site (admin pages, `MyRegistrations`, `compete/[slug]`, `register-success`) queries
`event_registrations` only and would need rewriting.

The recommended path is **(A): nullable `user_id` + a `player_email`/`player_phone` snapshot on
`event_registrations`**, with a unique partial index to prevent dupes. This keeps every existing read
path working and makes non-captain rows first-class.

---

## 6. Data-Attribute Gaps for Non-Captain Registrants

Beyond the missing `event_registrations` row, the data captured for non-captains is incomplete
relative to captains and solo registrants:

| Attribute | Captain (individual mode) | Non-captain (individual mode) | Solo |
|---|---|---|---|
| `event_registrations.user_id` | ✅ | ❌ never written | ✅ |
| `event_registrations.registration_type` | ✅ (`duo`/`team`) | ❌ never written | ✅ (`individual`) |
| `event_registrations.team_id` | ✅ | ❌ never written | n/a |
| `event_registrations.team_name` | ✅ | ❌ never written | n/a |
| `event_registrations.metadata` | ✅ (`isTeamCaptain`, `paymentMode`, `inviteCode`) | ❌ never written | ✅ |
| `registration_slots.player_phone` | ✅ (captain sets `null` — see §6.1) | ✅ from form | ✅ via `registrationData` |
| `registration_slots.metadata.shirtSize` | ❌ captain slot has no `metadata` (line 214) | ✅ | n/a |
| `profiles.full_name` / `display_name` | ✅ (account exists) | ❌ no account | ✅ |

### 6.1 Captain's own slot is missing phone & shirt size

`checkout/route.ts:206` hard-codes the captain's `player_phone: null`, and the captain's slot object
(lines 198-214) has no `metadata` field at all — so `shirtSize` for the captain is never persisted,
even though the form collects it. The captain's slot relies on `profiles` for name/phone, but shirt
size is silently dropped.

### 6.2 Non-captain PII lives only in `registration_slots.metadata`

Shirt size for non-captains is stored in `registration_slots.metadata.shirtSize` (line 231). Phone is
a top-level column. This is fine for storage, but if we adopt fix option **(A)** above, these should
be mirrored onto the new `event_registrations` row so admin views have one place to look.

---

## 7. End-to-End Flow Trace (Individual Mode, Non-Captain)

Annotated with file:line references for the `stewartdylan0694@gmail.com` scenario:

1. **Captain registers duo/team (individual mode)**
   - `checkout/route.ts:101-389` — creates `teams` row (`payment_mode: 'individual'`), creates
     captain slot + N-1 invitee slots in `registration_slots`, sends invite emails.
   - Invitee slot state: `status: 'invited'`, `app_user_id: null`.

2. **Invitee receives email, opens `/compete/invite/[token]`**
   - `compete/invite/[token]/page.tsx` — public, no auth. Shows event details + Pay button.

3. **Invitee pays — `POST /api/stripe/slot-checkout`**
   - `slot-checkout/route.ts:67-95` — creates Stripe Checkout Session with `customer_email` (no
     Supabase user). **Metadata omits `userId`.** Slot → `payment_started`.

4. **Stripe redirects to `/compete/invite/[token]/success?session_id=...`**
   - `invite/[token]/success/page.tsx:32-63` — inline fulfillment marks slot `paid`. **Does not
     write `event_registrations`.**
   - Page renders "You're In!" and shows optional "Create Your Player Profile" CTA.

5. **Stripe fires `checkout.session.completed` webhook**
   - `webhook/route.ts:118` — `meta.type === 'slot'` branch.
   - Lines 151-160: slot updated to `paid` (idempotent — already done in step 4, no-op).
   - Line 185: `mirrorUserId = userId ?? null` → **`null`** (no `userId` in metadata).
   - Line 186: `if (mirrorUserId)` → **false** → skip `event_registrations` insert entirely.
   - Lines 249-388: team status recalculated, confirmation/teammate-paid/team-complete emails sent.
     All correct, but the `event_registrations` ledger is still missing a row.

6. **If the invitee never creates an account**
   - `/account/claim/[token]` is never visited.
   - `event_registrations` row is **never created**. ← **This is the bug state for
     `stewartdylan0694@gmail.com`.**

7. **If the invitee *does* create an account and visits the claim link**
   - `claim/[token]/page.tsx:49-90` — slot → `claimed`, `app_user_id` set, `event_registrations`
     row inserted. Bug avoided — but only because the user took a voluntary action that the product
     does not require.

---

## 8. Affected Read Paths (Why the Player "Disappears")

Every read site below queries `event_registrations` and will therefore miss a non-captain who paid
without claiming:

| File | What it shows | Impact |
|---|---|---|
| `app/admin/registrations/page.tsx:13` | Admin registrations list | Non-captain invisible to admin |
| `app/admin/teams/page.tsx:19` | Admin team roster (joins slots↔regs) | Non-captain's slot shows but no reg link |
| `app/admin/tournaments/page.tsx:26` | Per-tournament registration counts | Undercount |
| `app/admin/users/[id]/page.tsx:33` | User's registrations | n/a (no user) |
| `app/admin/page.tsx:30-36` | Dashboard totals/revenue | Undercount |
| `app/account/events/page.tsx:25` | "My Registrations" | n/a (no user to log in) |
| `app/components/account/MyRegistrations.tsx:17` | Account registrations widget | n/a |
| `app/compete/[slug]/page.tsx:124` | Event page "registered" count | Undercount |
| `app/compete/page.tsx:62` | Compete hub upcoming events | Undercount |
| `app/components/home/UpcomingEvents.tsx:31` | Homepage upcoming events | Undercount |
| `sanity/lib/eventSeats.ts` | Seat counting | ✅ **Correct** — counts slots, not just regs |

Only `eventSeats.ts` handles this correctly today (it counts active `registration_slots` plus
non-mirror `event_registrations`). Everything else undercounts.

---

## 9. Recommended Remediation (For Execution Session)

### 9.1 Critical fix — make the webhook write `event_registrations` for unauthenticated slot-payers

**Schema change (new migration):**

```sql
-- Make user_id nullable so unauthenticated slot-payers can have a ledger row
ALTER TABLE public.event_registrations
  ALTER COLUMN user_id DROP NOT NULL;

-- Add player identity snapshot columns for slot-mirrored rows
ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS player_first_name TEXT,
  ADD COLUMN IF NOT EXISTS player_last_name TEXT,
  ADD COLUMN IF NOT EXISTS player_email TEXT,
  ADD COLUMN IF NOT EXISTS player_phone TEXT,
  ADD COLUMN IF NOT EXISTS registration_slot_id UUID REFERENCES registration_slots(id) ON DELETE SET NULL;

-- Prevent duplicate ledger rows per slot
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_registrations_slot_id
  ON public.event_registrations(registration_slot_id)
  WHERE registration_slot_id IS NOT NULL;
```

**Webhook change (`webhook/route.ts:184-247`):**

Replace the `if (mirrorUserId)` gate with logic that always writes a row, using `mirrorUserId`
when present and falling back to the slot's PII when not:

```js
// Pseudocode for the mirror block
const { data: existingEventReg } = await supabase
  .from('event_registrations')
  .select('id, status')
  .eq('stripe_checkout_session_id', session.id)
  .maybeSingle()

if (!existingEventReg) {
  // Fetch slot PII + team info (slotCheck already loaded earlier in the handler)
  const { data: slotPii } = await supabase
    .from('registration_slots')
    .select('player_first_name, player_last_name, player_email, player_phone, is_captain, metadata')
    .eq('id', registrationSlotId)
    .maybeSingle()

  const { data: slotTeamRow } = await supabase
    .from('teams')
    .select('registration_type, team_name')
    .eq('id', slotCheck.team_id)
    .maybeSingle()

  const { data: insertedReg } = await supabase
    .from('event_registrations')
    .insert({
      user_id: mirrorUserId,              // null for non-captain unauthenticated payer
      event_sanity_id: eventSanityId,
      event_slug: eventSlug,
      event_title: meta.eventTitle ?? eventSlug,
      event_date: meta.eventDate || null,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: (session.payment_intent as string) ?? null,
      amount_paid: session.amount_total,
      currency: session.currency ?? 'usd',
      status: 'paid',
      registration_type: slotTeamRow?.registration_type ?? (slotCheck.is_captain ? 'duo' : 'team'),
      team_name: slotTeamRow?.team_name ?? teamName ?? null,
      team_id: slotCheck.team_id,
      player_first_name: slotPii?.player_first_name ?? null,
      player_last_name: slotPii?.player_last_name ?? null,
      player_email: slotPii?.player_email ?? null,
      player_phone: slotPii?.player_phone ?? null,
      registration_slot_id: registrationSlotId,
      metadata: {
        isTeamCaptain: slotCheck.is_captain,
        paymentMode: 'individual',
        inviteCode: inviteCode ?? null,
        registrationSlotId,
        teamId: slotCheck.team_id,
        shirtSize: slotPii?.metadata?.shirtSize ?? null,
      },
    })
    .select('id')
    .maybeSingle()

  if (insertedReg) {
    await supabase
      .from('registration_slots')
      .update({ event_registration_id: insertedReg.id })
      .eq('id', registrationSlotId)
  }
}
```

**Also update `slot-checkout/route.ts` metadata** to include `eventTitle`, `eventDate`, and
`teamName` so the webhook has everything it needs without extra fetches (currently these are absent
from slot-checkout metadata but present in captain checkout metadata).

### 9.2 Secondary fix — make the success-page inline fulfillment mirror the row too

`invite/[token]/success/page.tsx:32-63` should, after marking the slot `paid`, perform the same
`event_registrations` upsert as the webhook (idempotent via the `registration_slot_id` unique
index). This closes the race where the webhook is delayed.

### 9.3 Tertiary fixes

- **Captain slot PII:** `checkout/route.ts:198-214` — populate `player_phone` and
  `metadata.shirtSize` from `registrationData` for the captain's own slot, not just invitees.
- **Claim page `event_title`:** `claim/[token]/page.tsx:76` — fetch the Sanity event (or accept it
  via the slot's `event_sanity_id` using `eventByIdQuery`) instead of writing the slug as the title.
- **Slot-confirmation email `claimUrl`:** `webhook/route.ts:287-290` builds the claim URL with a
  nested awaited query inside a template literal — works but is fragile; refactor to fetch the
  token once into a variable before the email call.
- **`eventSeats.ts` dedup:** already correct, but after the fix it should continue to skip
  individual-pay mirror rows. The existing logic (`modeByTeamId.get(r.team_id) !== 'captain_pays_all'
  → skip`) still holds because individual-mode mirror rows have a `team_id` pointing to an
  `individual`-mode team. ✅ No change needed, but add a regression test.

### 9.4 Backfill for existing affected records

Run a one-time backfill to create `event_registrations` rows for any `registration_slots` that are
`paid`/`claimed` but have no linked `event_registrations` row. This will repair
`stewartdylan0694@gmail.com` and any other silent victims:

```sql
-- Backfill (run once, after the schema migration lands)
INSERT INTO event_registrations (
  user_id, event_sanity_id, event_slug, event_title, event_date,
  stripe_checkout_session_id, stripe_payment_intent_id,
  amount_paid, currency, status, registration_type, team_name, team_id,
  player_first_name, player_last_name, player_email, player_phone,
  registration_slot_id, metadata, created_at, updated_at
)
SELECT
  s.app_user_id,                       -- null if never claimed
  s.event_sanity_id,
  s.event_slug,
  s.event_slug,                         -- best-effort title; admin can correct
  NULL,                                 -- event_date unknown at backfill time
  s.stripe_checkout_session_id,
  s.stripe_payment_intent_id,
  s.amount_due,
  s.currency,
  'paid',
  t.registration_type,
  t.team_name,
  s.team_id,
  s.player_first_name,
  s.player_last_name,
  s.player_email,
  s.player_phone,
  s.id,
  jsonb_build_object(
    'isTeamCaptain', s.is_captain,
    'paymentMode', 'individual',
    'inviteCode', t.invite_code,
    'registrationSlotId', s.id,
    'teamId', s.team_id,
    'shirtSize', s.metadata->'shirtSize'
  ),
  COALESCE(s.paid_at, now()),
  now()
FROM registration_slots s
JOIN teams t ON t.id = s.team_id
WHERE s.status IN ('paid', 'claimed')
  AND s.event_registration_id IS NULL
  AND t.payment_mode = 'individual'
ON CONFLICT (registration_slot_id) DO NOTHING;
```

After backfill, link the slots back:

```sql
UPDATE registration_slots s
SET event_registration_id = r.id
FROM event_registrations r
WHERE r.registration_slot_id = s.id
  AND s.event_registration_id IS NULL;
```

---

## 10. Verification Checklist (Post-Fix)

- [ ] A non-captain on an `individual`-mode duo/team can pay via the invite link **without creating
      an app account**, and an `event_registrations` row exists afterward with `user_id = NULL`,
      `player_email` populated, and `registration_slot_id` linked.
- [ ] The same non-captain appears in `/admin/registrations`, `/admin/teams`, and the tournament
      counts on `/admin/tournaments`.
- [ ] `eventSeats.ts` still counts the seat exactly once (no double count from slot + mirror row).
- [ ] If the non-captain *later* creates an account and visits `/account/claim/[token]`, the
      existing `event_registrations` row is updated in place (`user_id` set, slot → `claimed`)
      rather than duplicated.
- [ ] Captain's own slot now persists `player_phone` and `shirtSize`.
- [ ] Webhook idempotency holds: replaying the same Stripe event does not create a duplicate
      `event_registrations` row (guarded by `stripe_checkout_session_id` UNIQUE and
      `registration_slot_id` unique partial index).
- [ ] Backfill script creates rows for all pre-existing `paid`/`claimed` slots missing an
      `event_registrations` row, including `stewartdylan0694@gmail.com`.
- [ ] Refund path (`webhook/route.ts:579-625`) still cancels the slot; confirm it also marks the
      mirrored `event_registrations` row `refunded` (currently it updates by
      `stripe_payment_intent_id` — verify this still matches after the mirror changes).

---

## 11. File Index (Quick Reference for Execution Session)

| File | Role |
|---|---|
| `frontend/app/api/stripe/checkout/route.ts` | Captain checkout — creates team + slots, captain Stripe session |
| `frontend/app/api/stripe/slot-checkout/route.ts` | Non-captain invitee checkout — creates Stripe session (metadata missing `userId`) |
| `frontend/app/api/stripe/webhook/route.ts` | Webhook — marks slot paid, mirrors to `event_registrations` (gated on `userId` — **bug**) |
| `frontend/app/compete/invite/[token]/page.tsx` | Public invite landing page |
| `frontend/app/compete/invite/[token]/success/page.tsx` | Post-pay success page — inline fulfillment (no mirror — **bug**) |
| `frontend/app/account/claim/[token]/page.tsx` | Account-claim page — only place that writes the missing row today |
| `frontend/sanity/lib/eventSeats.ts` | Seat counting — correctly unions slots + regs |
| `supabase/migrations/20260330000000_event_registrations.sql` | `event_registrations` schema (`user_id NOT NULL` — **blocker**) |
| `supabase/migrations/20260517000000_registration_slots.sql` | `registration_slots` + `registration_payments` schema |
| `supabase/migrations/20260420000000_registration_details.sql` | Adds `registration_type`, `team_name` to `event_registrations` |
| `supabase/migrations/20260421000000_teams.sql` | `teams` table + `event_registrations.team_id` FK |
| `supabase/migrations/20260528000000_add_captain_registered_status.sql` | Adds `captain_registered` slot status |
