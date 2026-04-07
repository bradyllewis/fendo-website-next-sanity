-- =========================================================
-- Fendo Golf — Event registration improvements
-- 2026-03-31
-- =========================================================

-- Partial unique index: enforce at the DB level that a user
-- can only hold one paid registration per event.
-- Prevents race conditions that code-level checks cannot catch.
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_reg_one_paid_per_user_event
  ON public.event_registrations(user_id, event_sanity_id)
  WHERE (status = 'paid');
