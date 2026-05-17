export type Profile = {
  id: string
  email: string
  full_name: string | null
  display_name: string | null
  avatar_url: string | null
  handicap: number | null
  home_course: string | null
  bio: string | null
  stripe_customer_id: string | null
  role: 'user' | 'admin'
  created_at: string
  updated_at: string
}

export type EventRegistrationStatus = 'pending' | 'paid' | 'cancelled' | 'refunded' | 'waitlisted'

export type SponsorRegistrationStatus = 'pending' | 'paid' | 'invoiced' | 'cancelled' | 'refunded'

export type SponsorRegistration = {
  id: string
  user_id: string | null
  event_sanity_id: string
  event_slug: string
  event_title: string
  event_date: string | null
  company_name: string
  primary_contact: string
  email: string
  phone: string | null
  sponsorship_level: string
  sponsorship_level_price: number | null
  payment_method: 'stripe' | 'invoice'
  stripe_checkout_session_id: string | null
  stripe_payment_intent_id: string | null
  amount_paid: number | null
  currency: string
  status: SponsorRegistrationStatus
  logo_url: string | null
  activation_notes: string | null
  marketing_requests: string | null
  metadata: Record<string, unknown>
  notes: string | null
  created_at: string
  updated_at: string
}

export type TeamRecord = {
  id: string
  event_sanity_id: string
  event_slug: string
  team_name: string
  invite_code: string
  created_by: string | null
  registration_type: 'duo' | 'team'
  max_members: number
  walk_up_song: string | null
  payment_mode: 'captain_pays_all' | 'individual'
  team_status: 'pending' | 'partially_paid' | 'complete' | 'expired' | 'cancelled'
  expires_at: string | null
  created_at: string
}

export type RegistrationSlotStatus =
  | 'captain_pending'
  | 'invited'
  | 'payment_started'
  | 'paid'
  | 'claimed'
  | 'expired'
  | 'cancelled'

export type RegistrationSlot = {
  id: string
  team_id: string
  event_sanity_id: string
  event_slug: string
  is_captain: boolean
  player_first_name: string
  player_last_name: string
  player_email: string
  player_phone: string | null
  app_user_id: string | null
  invited_by_user_id: string | null
  invite_token: string
  status: RegistrationSlotStatus
  amount_due: number
  currency: string
  expires_at: string
  stripe_checkout_session_id: string | null
  stripe_payment_intent_id: string | null
  stripe_customer_id: string | null
  paid_at: string | null
  email_sent_at: string | null
  event_registration_id: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type RegistrationPayment = {
  id: string
  registration_slot_id: string | null
  team_id: string | null
  event_sanity_id: string
  stripe_event_id: string
  stripe_checkout_session_id: string | null
  stripe_payment_intent_id: string | null
  stripe_customer_id: string | null
  amount: number
  currency: string
  status: string
  paid_at: string
  raw_payload: Record<string, unknown> | null
  created_at: string
}

export type EventRegistration = {
  id: string
  user_id: string
  event_sanity_id: string
  event_slug: string
  event_title: string
  event_date: string | null
  stripe_checkout_session_id: string | null
  stripe_payment_intent_id: string | null
  amount_paid: number | null
  currency: string
  status: EventRegistrationStatus
  notes: string | null
  metadata: Record<string, unknown>
  registration_type: 'individual' | 'duo' | 'team' | null
  team_name: string | null
  team_id: string | null
  created_at: string
  updated_at: string
}
