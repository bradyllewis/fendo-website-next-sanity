-- Teams table for invite-code-based team registration
CREATE TABLE IF NOT EXISTS teams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_sanity_id TEXT NOT NULL,
  event_slug TEXT NOT NULL,
  team_name TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  registration_type TEXT NOT NULL CHECK (registration_type IN ('duo', 'team')),
  max_members INTEGER NOT NULL,
  walk_up_song TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_teams_invite_code ON teams(invite_code);
CREATE INDEX idx_teams_event_sanity_id ON teams(event_sanity_id);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read teams (for invite code lookup)
CREATE POLICY "Authenticated users can read teams"
  ON teams FOR SELECT TO authenticated USING (true);

-- Add team_id FK to event_registrations
ALTER TABLE event_registrations
  ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_event_registrations_team_id ON event_registrations(team_id);
