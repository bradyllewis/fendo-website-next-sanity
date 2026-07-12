import {TZDate} from '@date-fns/tz'
import {format} from 'date-fns'

// Sanity `datetime` fields store an absolute UTC instant. To show the venue's
// wall-clock time consistently — regardless of the server's timezone (UTC on
// Vercel) or the viewer's — every event date/time must be formatted in the
// event's own timezone. Legacy records without one fall back to Eastern.
export const DEFAULT_EVENT_TZ = 'America/New_York'

/** Anchor a UTC datetime string to the event's timezone for display. */
export function zonedDate(dateStr: string, tz?: string | null): TZDate {
  return new TZDate(dateStr, tz || DEFAULT_EVENT_TZ)
}

/** Format an event start/end time in the event's timezone, e.g. "8:00 AM". */
export function formatEventTime(dateStr: string, tz?: string | null): string {
  return format(zonedDate(dateStr, tz), 'h:mm a')
}

/** Long single-date form used in emails, e.g. "Saturday, August 15, 2026". */
export function formatEventDateLong(dateStr: string, tz?: string | null): string {
  return format(zonedDate(dateStr, tz), 'EEEE, MMMM d, yyyy')
}

/**
 * Format an event's date (or date range) in the event's timezone.
 * `long` uses full weekday/month names; otherwise the compact card form.
 */
export function formatEventDateRange(
  startDate: string,
  endDate: string | null | undefined,
  tz: string | null | undefined,
  {long = false}: {long?: boolean} = {},
): string {
  const start = zonedDate(startDate, tz)
  const dayFmt = long ? 'EEEE, MMMM d, yyyy' : 'MMM d, yyyy'
  const monthTok = long ? 'MMMM' : 'MMM'

  if (!endDate) return format(start, dayFmt)
  const end = zonedDate(endDate, tz)
  if (start.toDateString() === end.toDateString()) return format(start, dayFmt)
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${format(start, monthTok + ' d')}–${format(end, 'd, yyyy')}`
  }
  return `${format(start, monthTok + ' d')} – ${format(end, monthTok + ' d, yyyy')}`
}
