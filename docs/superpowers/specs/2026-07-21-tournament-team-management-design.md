# Tournament Team Management — Design Spec

**Date:** 2026-07-21
**Status:** Approved

## Problem

Admins currently manage tournament registrations via two disconnected, ungrouped surfaces (`/admin/registrations`, `/admin/teams`), neither scoped to a specific tournament. There is no way to see a tournament's full roster (solo + duo + team registrations) grouped together, edit a team member's name/email/shirt size, rename a team, or cancel a team/member with a safety confirmation. There is also no CSV/XLSX export of tournament roster data.

## Goals

- View the complete roster (solo, duo, team) for a single tournament in one place, grouped by team.
- Edit team name and member details (first name, last name, email, shirt size).
- Cancel an entire team or a single member, each behind a confirmation step, with an optional Stripe refund for paid records.
- Export a tournament's roster as CSV or XLSX.

## Non-goals

- No automated test suite (manual verification, consistent with existing admin features).
- No changes to the public-facing registration/checkout flow.
- No hard-deletion of registration rows — all deletions are soft-cancels (`status = 'cancelled'`), matching the existing `unregisterUser` pattern.
- No global (cross-tournament) export in this iteration — export is scoped per-tournament only.

## Background: existing data model

- `event_registrations`: one row per solo registrant or per captain-pays-all captain. Columns include `player_first_name`, `player_last_name`, `player_email`, `metadata` (JSONB, holds `shirtSize`), `registration_type` (`individual|duo|team|volunteer`), `team_name`, `team_id`, `status` (`pending|paid|cancelled|refunded|waitlisted`), `stripe_payment_intent_id`.
- `teams`: one row per duo/team registration. Columns include `team_name`, `invite_code`, `registration_type` (`duo|team`), `payment_mode` (`captain_pays_all|individual`), `team_status` (`pending|partially_paid|complete|expired|cancelled`).
- `registration_slots`: one row per team member when `payment_mode = 'individual'` (self-pay), or per invitee when `payment_mode = 'captain_pays_all'`. Columns include `player_first_name`, `player_last_name`, `player_email`, `metadata` (JSONB, holds `shirtSize`), `status`, `amount_due`, `stripe_payment_intent_id` (via `registration_payments`), `event_registration_id`.
- Team member data is split across two tables depending on `payment_mode` and role (captain vs invitee) — this is the core complexity the design must hide from the admin UI.

## Design

### 1. Routing & data unification

- New route: `frontend/app/admin/tournaments/[id]/teams/page.tsx` where `[id]` is `event_sanity_id`.
- Linked from a new "Teams" action added to each row in `frontend/app/components/admin/TournamentsClient.tsx` (alongside the existing Delete action).
- New shared utility: `frontend/lib/tournamentRoster.ts` exporting `getTournamentRoster(eventSanityId: string)`, which queries `teams`, `event_registrations`, and `registration_slots` for the given event and returns a normalized array:

```ts
type RosterMember = {
  sourceTable: 'event_registrations' | 'registration_slots'
  sourceId: string
  firstName: string
  lastName: string
  email: string
  shirtSize: string | null
  status: string
  amountPaid: number | null
  isCaptain: boolean
}

type RosterEntry = {
  kind: 'team' | 'solo'
  teamId: string | null
  teamName: string | null
  registrationType: 'individual' | 'duo' | 'team'
  paymentMode: 'captain_pays_all' | 'individual' | null
  members: RosterMember[]
}
```

- `getTournamentRoster` is the single source of truth for grouping logic, reused by both the page (render) and the export route.

### 2. UI components

- `TournamentRosterTable` (client component, `frontend/app/components/admin/TournamentRosterTable.tsx`): renders roster entries grouped by team — each team as a card/section with a header (team name, type, payment mode, status) and its members listed beneath; solo entries render as single-row cards. Follows the visual pattern of `RegistrationsTable`/`TeamsTable`.
- `EditMemberModal`: form with first name, last name, email, shirt size. Submits `sourceTable` + `sourceId` (already resolved by `getTournamentRoster`) to a server action — the modal itself is agnostic to which table backs the record.
- `EditTeamNameModal`: single field, submits `teamId` + new name.
- `ConfirmDeleteModal` (adapted from the existing `DeleteModal` in `/admin/tournaments`): shown for both "Remove member" (per member row) and "Cancel team" (per team group) actions. Displays affected name(s)/amount(s) and an optional "Process Stripe refund" checkbox, shown only when the affected record(s) are `paid`.
- Two export buttons ("Export CSV" / "Export XLSX") at the top of the page, scoped to the current tournament.

### 3. Server actions

New file: `frontend/app/admin/tournaments/[id]/teams/actions.ts`, guarded by the existing admin-role check pattern from `frontend/app/admin/actions.ts`, revalidating the roster page path after each mutation.

- `updateTeamName(teamId, newName)` — updates `teams.team_name`, and also updates the denormalized `team_name` on all matching `event_registrations` rows for that team (keeps `/admin/registrations` display consistent).
- `updateMember(sourceTable, sourceId, { firstName, lastName, email, shirtSize })` — updates `player_first_name`, `player_last_name`, `player_email`, and `metadata.shirtSize` on whichever table `sourceTable` names (`event_registrations` or `registration_slots`).
- `cancelMember(sourceTable, sourceId, { refund: boolean })` — soft-cancels (`status = 'cancelled'`) the given record; if `refund` is true and the record has a Stripe payment intent, issues a refund first (reusing the refund helper already built for `/api/admin/delete-tournament`).
- `cancelTeam(teamId, { refund: boolean })` — iterates all non-cancelled members of the team across both source tables, soft-cancels each (with per-member refund if requested and paid), and sets `teams.team_status = 'cancelled'`.

### 4. CSV/XLSX export

- New route: `frontend/app/api/admin/export-tournament-roster/route.ts` — `GET` with query params `eventId` and `format` (`csv` | `xlsx`), protected by the same admin-role guard as other `/api/admin/*` routes.
- Calls `getTournamentRoster(eventId)` (same function the page uses) and flattens to rows: Team Name, Registration Type, Payment Mode, Team Status, First Name, Last Name, Email, Shirt Size, Role (Captain/Member), Status, Amount Paid. Solo entries have a blank Team Name.
- **CSV**: generated with a small internal formatter (proper quoting/escaping) — no new dependency.
- **XLSX**: new dependency `exceljs` (actively maintained, avoids the prototype-pollution history of older `xlsx`/SheetJS builds). One worksheet, styled header row, auto-sized columns.
- Response streamed with `Content-Disposition: attachment`, filename `<event-slug>-roster.csv` / `.xlsx`.

### 5. Verification

Manual verification via the dev server, consistent with how prior admin features (registrations, tournaments) were shipped:
- Seed a mix of solo, duo (captain-pays-all), and individual-pay team registrations for one test event.
- Walk through the roster page: edit a member, edit a team name, cancel a member with and without refund, cancel a whole team, download both CSV and XLSX and confirm the data matches the on-screen roster.

## Open questions / risks

- None outstanding — all scope decisions were resolved during brainstorming (see options selected: drill-down navigation, unified member editing across source tables, per-tournament-only export, both team- and member-level deletion, unified solo+team roster, soft-cancel semantics, optional refund checkbox, CSV+XLSX both).
