-- Teams from an abandoned captain-pays-all checkout were left 'pending' with
-- nobody on them: the Stripe session-expired webhook cancelled the captain and
-- teammates but never updated the team. The webhook does that now; this corrects
-- the rows it missed.
--
-- "Active" matches recalcTeamStatus in frontend/lib/rosterMoves.ts. A ledger row
-- that mirrors a slot isn't a member in its own right, in either link direction.
UPDATE public.teams t
SET team_status = 'expired'
WHERE t.team_status = 'pending'
  AND NOT EXISTS (
    SELECT 1
    FROM public.registration_slots s
    WHERE s.team_id = t.id
      AND s.status NOT IN ('expired', 'cancelled')
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.event_registrations r
    WHERE r.team_id = t.id
      AND r.status IN ('paid', 'pending')
      AND r.registration_slot_id IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.registration_slots m
        WHERE m.event_registration_id = r.id
      )
  );
