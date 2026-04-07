-- =============================================================
-- Fendo Golf — Event registrations table + Stripe customer ID
-- =============================================================

-- 1. Add Stripe customer ID to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- 2. Event registrations table
CREATE TABLE public.event_registrations (
  id                         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_sanity_id            TEXT NOT NULL,
  event_slug                 TEXT NOT NULL,
  event_title                TEXT NOT NULL,
  event_date                 TIMESTAMPTZ,
  stripe_checkout_session_id TEXT UNIQUE,
  stripe_payment_intent_id   TEXT,
  amount_paid                INTEGER,          -- in cents
  currency                   TEXT DEFAULT 'usd',
  status                     TEXT NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'paid', 'cancelled', 'refunded', 'waitlisted')),
  notes                      TEXT,
  metadata                   JSONB DEFAULT '{}',
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_event_registrations_user_id    ON public.event_registrations(user_id);
CREATE INDEX idx_event_registrations_event_id   ON public.event_registrations(event_sanity_id);
CREATE INDEX idx_event_registrations_status     ON public.event_registrations(status);
CREATE INDEX idx_event_registrations_session    ON public.event_registrations(stripe_checkout_session_id);
CREATE INDEX idx_event_registrations_user_event ON public.event_registrations(user_id, event_sanity_id);

-- 3. Row Level Security
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own registrations"
  ON public.event_registrations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own registrations"
  ON public.event_registrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role (used by Stripe webhook) bypasses RLS automatically

-- 4. Auto-update updated_at (reuses existing handle_updated_at function)
CREATE TRIGGER event_registrations_updated_at
  BEFORE UPDATE ON public.event_registrations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
