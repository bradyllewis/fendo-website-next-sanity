/**
 * Types for the /compete page, matching the allEventsQuery GROQ shape.
 * Manually typed to match the GROQ projection until `sanity typegen` is run.
 */

export type EventStatus =
  | 'upcoming'
  | 'registration_open'
  | 'waitlist'
  | 'completed'
  | 'cancelled'

export interface SanityEvent {
  _id: string
  docStatus: 'draft' | 'published'
  title: string | null
  slug: string | null
  eventType: string | null
  status: EventStatus | string | null
  startDate: string | null
  endDate: string | null
  location: {
    venueName?: string | null
    city?: string | null
    state?: string | null
    addressLine?: string | null
  } | null
  coverImage: {
    asset?: {_ref: string; _type: string} | null
    alt?: string | null
    hotspot?: {x: number; y: number} | null
    crop?: {top: number; bottom: number; left: number; right: number} | null
  } | null
  shortDescription: string | null
  spotsTotal: number | null
  spotsFilled: number | null
  entryFee: number | null
  registrationUrl: string | null
  requiresRegistration: boolean | null
  isFeatured: boolean | null
  tags: string[] | null
}

/** Full event detail — extends card shape with description + sponsors. */
export interface SanityEventFull extends SanityEvent {
  description: unknown[] | null
  sponsors: {
    name?: string | null
    logo?: {asset?: {_ref: string; _type: string} | null} | null
    url?: string | null
  }[] | null
}

export const EVENT_TYPE_LABELS: Record<string, string> = {
  tournament:              'Tournament',
  clinic:                  'Clinic',
  community_round:         'Community Round',
  sponsored_championship:  'Championship',
  meetup:                  'Meetup',
}

export const STATUS_LABELS: Record<string, string> = {
  upcoming:           'Upcoming',
  registration_open:  'Registration Open',
  waitlist:           'Waitlist',
  completed:          'Completed',
  cancelled:          'Cancelled',
}
