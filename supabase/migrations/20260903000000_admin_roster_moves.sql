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
--
-- Rollback: ALTER TABLE public.event_registrations DROP COLUMN is_captain;
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
