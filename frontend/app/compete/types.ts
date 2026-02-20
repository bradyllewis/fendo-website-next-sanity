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
  isFeatured: boolean | null
  tags: string[] | null
}
