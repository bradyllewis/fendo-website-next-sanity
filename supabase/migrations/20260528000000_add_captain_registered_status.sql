-- Add 'captain_registered' as a valid status for registration_slots.
-- This status is used when a captain registers teammates in "captain pays all" mode,
-- meaning the teammate does not need to take any payment action themselves.

ALTER TABLE registration_slots
  DROP CONSTRAINT IF EXISTS registration_slots_status_check;

ALTER TABLE registration_slots
  ADD CONSTRAINT registration_slots_status_check CHECK (
    status IN (
      'captain_pending',
      'invited',
      'payment_started',
      'paid',
      'claimed',
      'expired',
      'cancelled',
      'captain_registered'
    )
  );
