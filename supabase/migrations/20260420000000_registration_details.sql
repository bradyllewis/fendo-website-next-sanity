-- Add registration detail columns to event_registrations
ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS registration_type TEXT
    CHECK (registration_type IN ('individual', 'duo', 'team')),
  ADD COLUMN IF NOT EXISTS team_name TEXT;

CREATE INDEX IF NOT EXISTS idx_event_registrations_reg_type
  ON public.event_registrations(registration_type);
