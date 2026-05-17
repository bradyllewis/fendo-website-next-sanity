-- =============================================================
-- Fendo Golf — Self-Pay Team Registration: slots + payments
-- =============================================================

-- 1. Extend teams table with payment mode and team-level status
ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS payment_mode TEXT NOT NULL DEFAULT 'captain_pays_all'
    CHECK (payment_mode IN ('captain_pays_all', 'individual')),
  ADD COLUMN IF NOT EXISTS team_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (team_status IN ('pending', 'partially_paid', 'complete', 'expired', 'cancelled')),
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- 2. registration_slots — one row per player in an individual-pay team
CREATE TABLE IF NOT EXISTS registration_slots (
  id                         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id                    UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  event_sanity_id            TEXT NOT NULL,
  event_slug                 TEXT NOT NULL,
  is_captain                 BOOLEAN NOT NULL DEFAULT false,
  player_first_name          TEXT NOT NULL,
  player_last_name           TEXT NOT NULL,
  player_email               TEXT NOT NULL,
  player_phone               TEXT,
  app_user_id                UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_by_user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invite_token               TEXT UNIQUE NOT NULL,
  status                     TEXT NOT NULL DEFAULT 'invited'
    CHECK (status IN (
      'captain_pending',
      'invited',
      'payment_started',
      'paid',
      'claimed',
      'expired',
      'cancelled'
    )),
  amount_due                 INTEGER NOT NULL,           -- in cents
  currency                   TEXT NOT NULL DEFAULT 'usd',
  expires_at                 TIMESTAMPTZ NOT NULL,
  stripe_checkout_session_id TEXT UNIQUE,
  stripe_payment_intent_id   TEXT,
  stripe_customer_id         TEXT,
  paid_at                    TIMESTAMPTZ,
  email_sent_at              TIMESTAMPTZ,
  event_registration_id      UUID REFERENCES event_registrations(id) ON DELETE SET NULL,
  metadata                   JSONB DEFAULT '{}',
  created_at                 TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at                 TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_registration_slots_team_id
  ON registration_slots(team_id);
CREATE INDEX IF NOT EXISTS idx_registration_slots_event_sanity_id
  ON registration_slots(event_sanity_id);
CREATE INDEX IF NOT EXISTS idx_registration_slots_invite_token
  ON registration_slots(invite_token);
CREATE INDEX IF NOT EXISTS idx_registration_slots_app_user_id
  ON registration_slots(app_user_id);
CREATE INDEX IF NOT EXISTS idx_registration_slots_invited_by
  ON registration_slots(invited_by_user_id);
CREATE INDEX IF NOT EXISTS idx_registration_slots_status
  ON registration_slots(status);

ALTER TABLE registration_slots ENABLE ROW LEVEL SECURITY;

-- Captain can view all slots they created
CREATE POLICY "Captain can view own team slots"
  ON registration_slots FOR SELECT
  TO authenticated
  USING (invited_by_user_id = auth.uid());

-- Claimed player can view their own slot
CREATE POLICY "Player can view own slot"
  ON registration_slots FOR SELECT
  TO authenticated
  USING (app_user_id = auth.uid());

-- Auto-update updated_at
CREATE TRIGGER registration_slots_updated_at
  BEFORE UPDATE ON registration_slots
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 3. registration_payments — Stripe payment audit trail + idempotency
CREATE TABLE IF NOT EXISTS registration_payments (
  id                         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  registration_slot_id       UUID REFERENCES registration_slots(id) ON DELETE SET NULL,
  team_id                    UUID REFERENCES teams(id) ON DELETE SET NULL,
  event_sanity_id            TEXT NOT NULL,
  stripe_event_id            TEXT NOT NULL UNIQUE,      -- idempotency key
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id   TEXT,
  stripe_customer_id         TEXT,
  amount                     INTEGER NOT NULL,           -- in cents
  currency                   TEXT NOT NULL DEFAULT 'usd',
  status                     TEXT NOT NULL DEFAULT 'succeeded',
  paid_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_payload                JSONB,
  created_at                 TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_registration_payments_slot_id
  ON registration_payments(registration_slot_id);
CREATE INDEX IF NOT EXISTS idx_registration_payments_team_id
  ON registration_payments(team_id);
CREATE INDEX IF NOT EXISTS idx_registration_payments_stripe_event_id
  ON registration_payments(stripe_event_id);

ALTER TABLE registration_payments ENABLE ROW LEVEL SECURITY;
-- registration_payments is service-role only — no end-user policies needed
