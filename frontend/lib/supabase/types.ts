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
  created_at: string
  updated_at: string
}
