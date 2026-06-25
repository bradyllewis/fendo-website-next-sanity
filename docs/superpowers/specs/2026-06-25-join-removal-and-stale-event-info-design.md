# Design: Remove orphaned Join-via-Code & live-resolve stale event info

**Date:** 2026-06-25
**Status:** Approved (decisions confirmed by user)

## Context

Two follow-ups flagged out-of-scope by the spots-filled spec (`2026-06-25-derive-spots-filled-design.md`):

1. **"Join Existing Team" (join-via-code)** — a registration option that conflicts with the slot-based team model.
2. **Stale event attributes** (`event_date`, etc.) — registration/sponsor rows store a point-in-time snapshot that goes stale when the event is edited in Sanity. `event_title` is already live-resolved in most views; `event_date` is not.

## Task 1 — Remove Join-via-Code

### Why removal (not a counting fix or a feature)

- **Never used:** 0 registrations in Supabase have `metadata.isJoiner === true` across all 19 reg rows / 13 teams.
- **Cannot succeed:** Captains pre-create a slot for *every* teammate at checkout (both payment modes). A team is fully occupied the instant the captain pays — captain_pays_all(4) = 1 reg + 3 `captain_registered` slots; individual(4) = 4 slots. Correct seat-counting would therefore *permanently reject* any code-joiner.
- **The real teammate-join path already exists and works:** the per-slot invite-token email link (`/compete/invite/[token]`), reached from the captain's invitee list.

Building "open-seat teams" (captains leaving seats unfilled for code-joining) would be a new feature, explicitly declined by the user.

### Removal surface (3 files)

1. **`app/compete/[slug]/register/RegistrationForm.tsx`**
   - Remove `'join'` from `RegistrationType`.
   - Remove `joinCode` / `joinedTeam` from `Step`, `FormState`, `STEP_LABELS`, initial state, and the type-reset on selection.
   - Remove the `getActiveSteps` `'join'` branch.
   - Remove the `joinCode` validation case and the `joinCode` step render block.
   - Remove the `JoinedTeam` type, the `lookupTeam` handler and its loading state.
   - Remove the "Join Existing Team" option from the type selector.
   - Remove the `registrationType === 'join'` branch that sets `registrationData.joinTeamCode`.

2. **`app/api/stripe/checkout/route.ts`**
   - Remove the `formRegistrationType === 'join'` branch (the team-lookup / captain-paid / capacity / membership validation block, ~lines 414–477).

3. **`app/api/teams/lookup/route.ts`** — **delete.** Its only consumer is the form's `joinCode` step (line 235).

No DB migration: the `teams` table and `event_registrations.team_id` remain in use by the surviving captain/invite-token flows. `metadata.isJoiner` is simply never written again.

## Task 2 — Live-resolve stale event info

### Field classification

- **Descriptive → live-resolve:** `event_title`, `event_date` (from Sanity `startDate`), and `location` where rendered. The event genuinely moved; show current.
- **Transactional → keep snapshot:** `sponsorship_level_price` (what the sponsor was quoted/charged; `amount_paid` is authoritative). `sponsorship_level` (tier label) left as snapshot too — not requested.
- **Emails:** keep point-in-time snapshots (standing rule).
- **Success pages** (`register-success`, `sponsor-success`): render the just-stored snapshot, which is fresh by definition (page shown seconds after purchase). Left unchanged.

### Change

Generalize the existing helper in `sanity/lib/events.ts`:

```ts
// Replaces getCurrentEventTitles
export interface CurrentEventInfo { title: string; startDate: string | null }
export async function getCurrentEventInfo(
  ids: (string | null | undefined)[],
): Promise<Map<string, CurrentEventInfo>>
```

- Rename `eventTitlesByIdsQuery` → `eventInfoByIdsQuery`, adding `startDate`. (`location` was *not* added — no caller renders it from this map; the invite page resolves its own location. YAGNI.)
- Map entry keyed by `_id`; only events that still exist in Sanity get an entry (callers fall back to the stored snapshot otherwise — confirmed against live data: deleted test events fall back, the surviving event resolves live).
- `getCurrentEventTitles` is removed (all callers migrated) to avoid two near-identical helpers.

### Caller updates (override-before-render, matching the existing title pattern)

Render sites showing a stale **date** (now fixed to live):

| File | Today | Change |
|---|---|---|
| `components/account/MyRegistrations.tsx` | title live, date stale | title + date from info map, `?? reg.*` fallback |
| `account/events/page.tsx` → `RegistrationsList` | title + date stale | override both on rows; table unchanged |
| `admin/users/[id]/page.tsx` | title live, date stale | title + date from info map |
| `admin/registrations/page.tsx` | overrides `event_title` on rows | also override `event_date`; `RegistrationsTable` unchanged |
| `admin/sponsorships/page.tsx` | overrides `event_title` on rows | also override `event_date`; **leave** `sponsorship_level*`; `SponsorshipsTable` unchanged |

Title-only callers (no date rendered — migrated to keep one helper):
`admin/page.tsx` (dashboard), `admin/teams/page.tsx`, `components/account/MyTeams.tsx`.

Client tables (`RegistrationsTable`, `SponsorshipsTable`) need no change — they render `event_title` / `event_date`, which now carry live values.

## Verification

- `npx tsc --noEmit` clean in `frontend/`.
- Grep confirms no remaining references to `joinCode`, `joinedTeam`, `joinTeamCode`, `getCurrentEventTitles`, or `api/teams/lookup`.
- Manual: captain (duo/team, both payment modes), individual, and volunteer registration paths still build; invite-token claim still works.

## Out of scope

- Open-seat team feature (declined).
- Live sponsor price (declined — snapshot kept).
- Email snapshot values (intentional).
