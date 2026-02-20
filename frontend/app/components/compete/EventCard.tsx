import Link from 'next/link'
import {format, parseISO} from 'date-fns'

import SanityImage from '@/app/components/SanityImage'
import {IconCalendar, IconMapPin, IconUsersSmall, IconArrow} from '@/app/components/icons'
import type {SanityEvent} from '@/app/compete/types'

// ── Event type badge config ───────────────────────────────────────────────────

const EVENT_TYPE_LABELS: Record<string, string> = {
  tournament:              'Tournament',
  clinic:                  'Clinic',
  community_round:         'Community Round',
  sponsored_championship:  'Championship',
  meetup:                  'Meetup',
}

const EVENT_TYPE_STYLES: Record<string, string> = {
  tournament:              'bg-navy text-bg',
  clinic:                  'bg-green text-bg',
  community_round:         'bg-mustard text-fg',
  sponsored_championship:  'bg-accent text-white',
  meetup:                  'bg-surface text-fg border border-border',
}

// ── Status badge config ───────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  upcoming:           'Upcoming',
  registration_open:  'Open — Register',
  waitlist:           'Waitlist',
  completed:          'Completed',
  cancelled:          'Cancelled',
}

const STATUS_STYLES: Record<string, string> = {
  upcoming:           'text-green bg-green/10',
  registration_open:  'text-accent bg-accent/10',
  waitlist:           'text-fg bg-mustard/40',
  completed:          'text-muted-2 bg-surface',
  cancelled:          'text-danger bg-danger/10',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatEventDate(startDate: string, endDate?: string | null): string {
  const start = parseISO(startDate)
  if (!endDate) return format(start, 'MMM d, yyyy')
  const end = parseISO(endDate)
  if (start.toDateString() === end.toDateString()) {
    return format(start, 'MMM d, yyyy')
  }
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${format(start, 'MMM d')}–${format(end, 'd, yyyy')}`
  }
  return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`
}

function formatLocation(location: SanityEvent['location']): string | null {
  if (!location) return null
  const parts = [location.venueName, location.city, location.state].filter(Boolean)
  return parts.join(', ') || null
}

function formatEntryFee(fee?: number | null): string {
  if (fee == null) return ''
  if (fee === 0) return 'Free'
  return `$${fee} entry`
}

// ── Component ─────────────────────────────────────────────────────────────────

interface EventCardProps {
  event: SanityEvent
}

export default function EventCard({event}: EventCardProps) {
  const {
    _id,
    title,
    eventType,
    status,
    startDate,
    endDate,
    location,
    coverImage,
    shortDescription,
    spotsTotal,
    spotsFilled,
    entryFee,
    registrationUrl,
    slug,
  } = event

  const typeLabel   = eventType ? EVENT_TYPE_LABELS[eventType]  ?? eventType  : null
  const typeStyle   = eventType ? EVENT_TYPE_STYLES[eventType]  ?? ''         : ''
  const statusLabel = status    ? STATUS_LABELS[status]         ?? status     : null
  const statusStyle = status    ? STATUS_STYLES[status]         ?? ''         : ''

  const locationStr = formatLocation(location)
  const spotsLeft   = spotsTotal != null && spotsFilled != null ? spotsTotal - spotsFilled : null
  const spotsRatio  = spotsTotal && spotsFilled != null ? Math.min(spotsFilled / spotsTotal, 1) : null
  const isComplete  = status === 'completed' || status === 'cancelled'

  return (
    <article className="card-base flex flex-col overflow-hidden group">

      {/* Cover image */}
      <div className="relative h-48 bg-surface overflow-hidden shrink-0">
        {coverImage?.asset && '_ref' in coverImage.asset ? (
          <SanityImage
            id={coverImage.asset._ref}
            alt={(coverImage as {alt?: string})?.alt || title || ''}
            width={600}
            height={384}
            mode="cover"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          /* Placeholder gradient */
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(135deg, #040F2C 0%, #31483B 60%, #0C1C23 100%)',
            }}
            aria-hidden="true"
          >
            {/* Subtle grid texture */}
            <div
              className="absolute inset-0 bg-[url(/images/tile-grid-white.png)] opacity-[0.06]"
              style={{backgroundSize: '20px'}}
              aria-hidden="true"
            />
          </div>
        )}

        {/* Top badges row */}
        <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-2 pointer-events-none">
          {typeLabel && (
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-md text-[0.65rem] font-mono font-medium tracking-widest uppercase ${typeStyle}`}
            >
              {typeLabel}
            </span>
          )}
          {statusLabel && (
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-md text-[0.65rem] font-mono font-medium tracking-widest uppercase backdrop-blur-sm ${statusStyle}`}
            >
              {statusLabel}
            </span>
          )}
        </div>

        {/* Opacity overlay for completed/cancelled events */}
        {isComplete && (
          <div className="absolute inset-0 bg-bg/40" aria-hidden="true" />
        )}
      </div>

      {/* Card body */}
      <div className="flex flex-col flex-1 p-6 gap-4">

        {/* Title */}
        <h3 className="text-lg font-semibold tracking-tight text-fg leading-snug">
          {title}
        </h3>

        {/* Short description */}
        {shortDescription && (
          <p className="text-sm text-muted leading-relaxed line-clamp-2 -mt-1">
            {shortDescription}
          </p>
        )}

        {/* Meta: date + location */}
        <div className="flex flex-col gap-1.5 mt-auto">
          {startDate && (
            <div className="flex items-center gap-2 text-xs font-mono text-muted-2">
              <IconCalendar />
              <span>{formatEventDate(startDate, endDate)}</span>
            </div>
          )}
          {locationStr && (
            <div className="flex items-center gap-2 text-xs font-mono text-muted-2">
              <IconMapPin />
              <span className="truncate">{locationStr}</span>
            </div>
          )}
        </div>

        {/* Spots progress bar */}
        {spotsTotal != null && spotsRatio != null && !isComplete && (
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="flex items-center gap-1.5 text-xs font-mono text-muted-2">
                <IconUsersSmall />
                {spotsLeft != null && spotsLeft > 0
                  ? `${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} left`
                  : 'No spots left'}
              </span>
              <span className="text-xs font-mono text-muted-2">
                {spotsFilled ?? 0}/{spotsTotal}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-surface overflow-hidden">
              <div
                className="h-full rounded-full bg-accent transition-all duration-500"
                style={{width: `${Math.round(spotsRatio * 100)}%`}}
                aria-label={`${Math.round(spotsRatio * 100)}% full`}
              />
            </div>
          </div>
        )}

        {/* Footer: fee + CTA */}
        <div className="flex items-center justify-between pt-4 border-t border-border mt-auto gap-3">
          <span className="text-sm font-mono font-medium text-fg">
            {formatEntryFee(entryFee)}
          </span>

          {registrationUrl && !isComplete ? (
            <a
              href={registrationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-accent text-xs px-4 py-2.5 rounded-lg shrink-0"
              aria-label={`Register for ${title}`}
            >
              Register
            </a>
          ) : isComplete ? (
            <span className="text-xs font-mono text-muted-2 italic">
              Event ended
            </span>
          ) : (
            <span className="text-xs font-mono text-muted-2 italic">
              Details coming soon
            </span>
          )}
        </div>
      </div>
    </article>
  )
}
