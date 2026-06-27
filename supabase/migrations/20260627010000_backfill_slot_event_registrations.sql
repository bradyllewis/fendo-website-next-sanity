-- =============================================================
-- Fendo Golf — Backfill event_registrations for paid slots missing a ledger row
-- =============================================================
--
-- One-time backfill. Run AFTER 20260627000000_event_registrations_nullable_user.sql
-- has been applied. Repairs any registration_slots that are paid/claimed but have
-- no linked event_registrations row (the "disappearing non-captain" bug).
--
-- Affected example: player_email = 'stewartdylan0694@gmail.com'
--
-- Only backfills individual-payment-mode slots; captain_pays_all invitee slots
-- are intentionally not mirrored to event_registrations (the captain's single
-- row is the ledger entry for the whole team in that mode).
--
-- Two phases:
--   Phase 1: For slots whose player already has a paid event_registrations row
--            (matched by app_user_id + event_sanity_id), just link the slot to
--            that existing row. This happens when the captain's checkout created
--            the reg row but the slot link was never set.
--   Phase 2: For remaining slots with no existing reg row, insert a new one.
--            This covers non-captain unauthenticated payers (the core bug).
-- =============================================================

-- Phase 1: Link slots to existing paid event_registrations rows by (user_id, event)
UPDATE registration_slots s
SET event_registration_id = r.id
FROM event_registrations r
WHERE r.event_sanity_id = s.event_sanity_id
  AND r.user_id = s.app_user_id
  AND r.status = 'paid'
  AND s.status IN ('paid', 'claimed')
  AND s.event_registration_id IS NULL
  AND s.app_user_id IS NOT NULL;

-- Phase 2: Insert missing ledger rows for slots that still have no linked reg.
-- This is the core fix for non-captain unauthenticated payers (user_id = null).
INSERT INTO event_registrations (
  user_id, event_sanity_id, event_slug, event_title, event_date,
  stripe_checkout_session_id, stripe_payment_intent_id,
  amount_paid, currency, status, registration_type, team_name, team_id,
  player_first_name, player_last_name, player_email, player_phone,
  registration_slot_id, metadata, created_at, updated_at
)
SELECT
  s.app_user_id,                       -- null if the player never claimed
  s.event_sanity_id,
  s.event_slug,
  s.event_slug,                         -- best-effort title; admin UI overrides with live Sanity data
  NULL,                                 -- event_date not known at backfill time
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

-- Phase 3: Link any remaining slots to their newly-created ledger rows
UPDATE registration_slots s
SET event_registration_id = r.id
FROM event_registrations r
WHERE r.registration_slot_id = s.id
  AND s.event_registration_id IS NULL;
