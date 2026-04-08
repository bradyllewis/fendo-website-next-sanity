-- =============================================================
-- Fendo Golf — Add admin role to profiles
-- =============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
  CHECK (role IN ('user', 'admin'));

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Admins can update any profile's role (via service role — no RLS policy needed).
-- Regular users can only update their own profile (existing policy covers this).
-- The role column is intentionally NOT updatable via the existing user self-update
-- policy because the WHERE CHECK clause uses auth.uid() = id (own record only),
-- and any attempt to escalate one's own role would need the service role key.
