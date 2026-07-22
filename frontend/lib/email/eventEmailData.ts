import { client } from '@/sanity/lib/client'
import { eventByIdQuery } from '@/sanity/lib/queries'
import { formatEventDateLong } from '@/lib/eventDates'
import { getBaseUrl } from '@/lib/email/resend'

export interface EventEmailData {
  title: string
  /** Long, timezone-correct date string (e.g. "Saturday, August 15, 2026"), or null. */
  dateLong: string | null
  /** Composed venue string (e.g. "Pine Valley — Clementon, NJ"), or null. */
  location: string | null
  siteUrl: string
}

/** Compose the Sanity `location` object into a single display line. */
function composeLocation(loc: {
  venueName?: string | null
  city?: string | null
  state?: string | null
} | null): string | null {
  if (!loc) return null
  const cityState = [loc.city, loc.state].filter(Boolean).join(', ')
  const parts = [loc.venueName, cityState].filter((p) => p && p.trim())
  return parts.length > 0 ? parts.join(' — ') : null
}

/**
 * Resolves an event's current, display-ready details for reminder emails.
 * Reads live from Sanity (title/date can change), formats the date in the
 * event's own timezone, and flattens the location object to one line.
 */
export async function getEventEmailData(eventSanityId: string): Promise<EventEmailData> {
  const event = await client.fetch(eventByIdQuery, { id: eventSanityId })

  return {
    title: event?.title ?? 'Your tournament',
    dateLong: event?.startDate
      ? formatEventDateLong(event.startDate, event.timezone)
      : null,
    location: composeLocation(event?.location ?? null),
    siteUrl: getBaseUrl(),
  }
}
