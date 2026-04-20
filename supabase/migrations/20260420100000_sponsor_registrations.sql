-- Create sponsor_registrations table
CREATE TABLE sponsor_registrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_sanity_id TEXT NOT NULL,
  event_slug TEXT NOT NULL,
  event_title TEXT NOT NULL,
  event_date TIMESTAMPTZ,
  company_name TEXT NOT NULL,
  primary_contact TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  sponsorship_level TEXT NOT NULL,
  sponsorship_level_price INTEGER,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('stripe', 'invoice')),
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  amount_paid INTEGER,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'invoiced', 'cancelled', 'refunded')),
  logo_url TEXT,
  activation_notes TEXT,
  marketing_requests TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX idx_sponsor_registrations_event_sanity_id ON sponsor_registrations(event_sanity_id);
CREATE INDEX idx_sponsor_registrations_user_id ON sponsor_registrations(user_id);
CREATE INDEX idx_sponsor_registrations_status ON sponsor_registrations(status);
CREATE INDEX idx_sponsor_registrations_stripe_session ON sponsor_registrations(stripe_checkout_session_id) WHERE stripe_checkout_session_id IS NOT NULL;

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_sponsor_registrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER sponsor_registrations_updated_at
  BEFORE UPDATE ON sponsor_registrations
  FOR EACH ROW
  EXECUTE FUNCTION update_sponsor_registrations_updated_at();

-- Enable RLS
ALTER TABLE sponsor_registrations ENABLE ROW LEVEL SECURITY;

-- Users can view their own sponsorships
CREATE POLICY "Users can view own sponsor registrations"
  ON sponsor_registrations FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Users can insert their own sponsorships
CREATE POLICY "Users can insert own sponsor registrations"
  ON sponsor_registrations FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Storage bucket for sponsor assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('sponsor-assets', 'sponsor-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: authenticated users upload to own folder
CREATE POLICY "Authenticated users can upload sponsor assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'sponsor-assets' AND
    (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- Storage policy: public read
CREATE POLICY "Public can view sponsor assets"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'sponsor-assets');

-- Storage policy: users can delete their own files
CREATE POLICY "Users can delete own sponsor assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'sponsor-assets' AND
    (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );
