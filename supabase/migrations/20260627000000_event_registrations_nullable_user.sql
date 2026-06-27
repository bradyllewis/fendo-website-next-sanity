-- =============================================================
-- Fendo Golf — Support unauthenticated slot-payers in event_registrations
-- =============================================================
--
-- Non-captain teammates on individual-pay teams pay via the public
-- invite link without an app account. Their payment is recorded in
-- registration_slots (status = 'paid'), but event_registrations could
-- never hold a row for them because user_id was NOT NULL.
--
-- This migration:
--   1. Makes user_id nullable.
--   2. Adds PII snapshot columns for slot-mirrored rows.
--   3. Adds a registration_slot_id FK + unique partial index so each
--      slot maps to at most one ledger row (prevents dupes on replay).
--   4. Relaxes the registration_type CHECK to allow 'volunteer'.
-- =============================================================

-- 1. user_id nullable
ALTER TABLE public.event_registrations
  ALTER COLUMN user_id DROP NOT NULL;

-- 2. PII snapshot columns (populated for slot-mirrored rows without an account)
ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS player_first_name TEXT,
  ADD COLUMN IF NOT EXISTS player_last_name TEXT,
  ADD COLUMN IF NOT EXISTS player_email TEXT,
  ADD COLUMN IF NOT EXISTS player_phone TEXT,
  ADD COLUMN IF NOT EXISTS registration_slot_id UUID REFERENCES registration_slots(id) ON DELETE SET NULL;

-- 3. One ledger row per slot (idempotent on insert/replay).
-- NOTE: a plain UNIQUE index (not partial) so that ON CONFLICT (registration_slot_id)
-- can target it. PostgreSQL allows multiple NULLs in a unique index by default,
-- so rows with NULL registration_slot_id are not constrained — exactly what we want.
DROP INDEX IF EXISTS idx_event_registrations_slot_id;
CREATE UNIQUE INDEX idx_event_registrations_slot_id
  ON public.event_registrations(registration_slot_id);

-- 4. registration_type currently allows ('individual', 'duo', 'team').
--    Volunteer rows were being inserted without a type; relax to accept 'volunteer'.
ALTER TABLE public.event_registrations
  DROP CONSTRAINT IF EXISTS event_registrations_registration_type_check;

ALTER TABLE public.event_registrations
  ADD CONSTRAINT event_registrations_registration_type_check
  CHECK (registration_type IS NULL OR registration_type IN ('individual', 'duo', 'team', 'volunteer'));

-- 5. Index the new PII email column for admin lookups by email
CREATE INDEX IF NOT EXISTS idx_event_registrations_player_email
  ON public.event_registrations(player_email);
