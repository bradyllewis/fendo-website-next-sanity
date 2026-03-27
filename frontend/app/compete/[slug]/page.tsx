import type {Metadata, ResolvingMetadata} from 'next'
import {notFound} from 'next/navigation'
import {type PortableTextBlock} from 'next-sanity'
import Link from 'next/link'
import {format, parseISO} from 'date-fns'

import PortableText from '@/app/components/PortableText'
import SanityImage from '@/app/components/SanityImage'
import {sanityFetch} from '@/sanity/lib/live'
import {eventQuery, eventSlugQuery} from '@/sanity/lib/queries'
import {resolveOpenGraphImage} from '@/sanity/lib/utils'
import {IconCalendar, IconMapPin, IconUsersSmall, IconDollar} from '@/app/components/icons'
import type {SanityEventFull} from '../types'
import {EVENT_TYPE_LABELS, STATUS_LABELS} from '../types'

type Props = {params: Promise<{slug: string}>}

// ── Static generation ──────────────────────────────────────────────────────────

export async function generateStaticParams() {
  const {data} = await sanityFetch({
    query: eventSlugQuery,
    perspective: 'published',
    stega: false,
  })
  return data ?? []
}

// ── Metadata ───────────────────────────────────────────────────────────────────

export async function generateMetadata(props: Props, parent: ResolvingMetadata): Promise<Metadata> {
  const params = await props.params
  const {data: event} = await sanityFetch({
    query: eventQuery,
    params,
    stega: false,
  })
  const previousImages = (await parent).openGraph?.images || []
  const ogImage = resolveOpenGraphImage(event?.coverImage)

  return {
    title: event?.title ?? 'Event',
    description: event?.shortDescription ?? undefined,
    openGraph: {
      images: ogImage ? [ogImage, ...previousImages] : previousImages,
    },
  } satisfies Metadata
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const EVENT_TYPE_STYLES: Record<string, string> = {
  tournament:              'bg-navy text-bg',
  clinic:                  'bg-green text-bg',
  community_round:         'bg-mustard text-fg',
  sponsored_championship:  'bg-accent text-white',
  meetup:                  'bg-surface text-fg border border-border',
}

const STATUS_STYLES: Record<string, string> = {
  upcoming:           'text-green bg-green/10',
  registration_open:  'text-accent bg-accent/10',
  waitlist:           'text-fg bg-mustard/40',
  completed:          'text-muted-2 bg-surface',
  cancelled:          'text-danger bg-danger/10',
}

function formatEventDate(startDate: string, endDate?: string | null): string {
  const start = parseISO(startDate)
  if (!endDate) return format(start, 'EEEE, MMMM d, yyyy')
  const end = parseISO(endDate)
  if (start.toDateString() === end.toDateString()) {
    return format(start, 'EEEE, MMMM d, yyyy')
  }
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${format(start, 'MMMM d')}–${format(end, 'd, yyyy')}`
  }
  return `${format(start, 'MMMM d')} – ${format(end, 'MMMM d, yyyy')}`
}

function formatTime(dateStr: string): string {
  return format(parseISO(dateStr), 'h:mm a')
}

function formatLocation(location: SanityEventFull['location']): string | null {
  if (!location) return null
  const parts = [location.venueName, location.city, location.state].filter(Boolean)
  return parts.join(', ') || null
}

function formatFullAddress(location: SanityEventFull['location']): string | null {
  if (!location) return null
  const parts = [location.addressLine, location.city, location.state].filter(Boolean)
  return parts.join(', ') || null
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function EventDetailPage(props: Props) {
  const params = await props.params
  const {data: event} = await sanityFetch({query: eventQuery, params})
  const entry = event as SanityEventFull | null

  if (!entry?._id) return notFound()

  const typeLabel   = entry.eventType ? EVENT_TYPE_LABELS[entry.eventType] ?? entry.eventType : null
  const typeStyle   = entry.eventType ? EVENT_TYPE_STYLES[entry.eventType] ?? '' : ''
  const statusLabel = entry.status    ? STATUS_LABELS[entry.status]        ?? entry.status    : null
  const statusStyle = entry.status    ? STATUS_STYLES[entry.status]        ?? '' : ''
  const locationStr = formatLocation(entry.location)
  const fullAddress = formatFullAddress(entry.location)
  const spotsLeft   = entry.spotsTotal != null && entry.spotsFilled != null ? entry.spotsTotal - entry.spotsFilled : null
  const spotsRatio  = entry.spotsTotal && entry.spotsFilled != null ? Math.min(entry.spotsFilled / entry.spotsTotal, 1) : null
  const isComplete  = entry.status === 'completed' || entry.status === 'cancelled'
  const entryFeeStr = entry.entryFee == null ? null : entry.entryFee === 0 ? 'Free' : `$${entry.entryFee}`

  return (
    <>
      {/* ── Back link ───────────────────────────────────────────────────── */}
      <div className="border-b border-border">
        <div className="container py-4">
          <Link
            href="/compete"
            className="inline-flex items-center gap-2 text-sm text-muted hover:text-fg transition-colors duration-160 group"
          >
            <span className="group-hover:-translate-x-0.5 transition-transform duration-160">
              <svg className="w-4 h-4 rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </span>
            Back to Events
          </Link>
        </div>
      </div>

      {/* ── Hero header ──────────────────────────────────────────────────── */}
      <header className="border-b border-border bg-surface/40">
        <div className="container py-14 lg:py-20">
          <div className="max-w-3xl">
            {/* Badges */}
            <div className="flex items-center gap-2 mb-6 flex-wrap">
              {typeLabel && (
                <span className={`inline-flex items-center px-3 py-1.5 rounded-md text-[0.65rem] font-mono font-medium tracking-widest uppercase ${typeStyle}`}>
                  {typeLabel}
                </span>
              )}
              {statusLabel && (
                <span className={`inline-flex items-center px-3 py-1.5 rounded-md text-[0.65rem] font-mono font-medium tracking-widest uppercase ${statusStyle}`}>
                  {statusLabel}
                </span>
              )}
            </div>

            {/* Title */}
            <h1 className="display-md lg:display-lg text-fg mb-5 leading-tight">
              {entry.title}
            </h1>

            {/* Short description */}
            {entry.shortDescription && (
              <p className="text-lg text-muted leading-relaxed max-w-[48ch] mb-8">
                {entry.shortDescription}
              </p>
            )}

            {/* Meta row */}
            <div className="flex items-center gap-5 flex-wrap text-sm text-muted font-mono">
              {entry.startDate && (
                <div className="flex items-center gap-2">
                  <IconCalendar className="w-4 h-4" />
                  <span>{formatEventDate(entry.startDate, entry.endDate)}</span>
                </div>
              )}
              {entry.startDate && (
                <div className="flex items-center gap-2">
                  <span>{formatTime(entry.startDate)}</span>
                  {entry.endDate && (
                    <>
                      <span className="text-muted-2">–</span>
                      <span>{formatTime(entry.endDate)}</span>
                    </>
                  )}
                </div>
              )}
              {locationStr && (
                <div className="flex items-center gap-2">
                  <IconMapPin className="w-4 h-4" />
                  <span>{locationStr}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Cover image ──────────────────────────────────────────────────── */}
      {entry.coverImage?.asset && '_ref' in entry.coverImage.asset && (
        <div className="container mt-10">
          <div className="relative aspect-[21/9] overflow-hidden rounded-xl">
            <SanityImage
              id={entry.coverImage.asset._ref}
              alt={(entry.coverImage as {alt?: string})?.alt ?? entry.title ?? 'Event image'}
              hotspot={entry.coverImage.hotspot ?? undefined}
              crop={entry.coverImage.crop ?? undefined}
              mode="cover"
              width={1200}
              height={514}
              className="w-full h-full object-cover"
            />
            {isComplete && (
              <div className="absolute inset-0 bg-bg/30" aria-hidden="true" />
            )}
          </div>
        </div>
      )}

      {/* ── Content body ─────────────────────────────────────────────────── */}
      <div className="container py-12 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-16">

          {/* Main content */}
          <div className="lg:col-span-2">
            {entry.description && Array.isArray(entry.description) && entry.description.length > 0 && (
              <div>
                <h2 className="label-mono mb-5">About This Event</h2>
                <PortableText
                  className="prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-fg"
                  value={entry.description as PortableTextBlock[]}
                />
              </div>
            )}

            {/* Tags */}
            {entry.tags && entry.tags.length > 0 && (
              <div className="mt-10 pt-8 border-t border-border">
                <h3 className="label-mono mb-4">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {entry.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1.5 rounded-full text-xs font-mono text-muted border border-border bg-surface/50"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <aside className="lg:col-span-1">
            <div className="card-base p-6 space-y-6 sticky top-24">
              <h3 className="font-semibold text-fg tracking-tight">Event Details</h3>

              <div className="space-y-4">
                {/* Date */}
                {entry.startDate && (
                  <div className="flex items-start gap-3">
                    <IconCalendar className="w-4 h-4 text-muted-2 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-fg">
                        {formatEventDate(entry.startDate, entry.endDate)}
                      </p>
                      <p className="text-xs text-muted-2 font-mono mt-0.5">
                        {formatTime(entry.startDate)}
                        {entry.endDate && ` – ${formatTime(entry.endDate)}`}
                      </p>
                    </div>
                  </div>
                )}

                {/* Location */}
                {(entry.location?.venueName || entry.location?.city) && (
                  <div className="flex items-start gap-3">
                    <IconMapPin className="w-4 h-4 text-muted-2 mt-0.5 shrink-0" />
                    <div>
                      {entry.location.venueName && (
                        <p className="text-sm font-medium text-fg">{entry.location.venueName}</p>
                      )}
                      {fullAddress && (
                        <p className="text-xs text-muted-2 font-mono mt-0.5">{fullAddress}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Entry fee */}
                {entryFeeStr && (
                  <div className="flex items-start gap-3">
                    <IconDollar className="w-4 h-4 text-muted-2 mt-0.5 shrink-0" />
                    <p className="text-sm font-medium text-fg">{entryFeeStr}</p>
                  </div>
                )}

                {/* Spots */}
                {entry.spotsTotal != null && !isComplete && (
                  <div className="flex items-start gap-3">
                    <IconUsersSmall className="w-4 h-4 text-muted-2 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1.5">
                        <p className="text-sm font-medium text-fg">
                          {spotsLeft != null && spotsLeft > 0
                            ? `${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} remaining`
                            : 'No spots remaining'}
                        </p>
                        <span className="text-xs font-mono text-muted-2">
                          {entry.spotsFilled ?? 0}/{entry.spotsTotal}
                        </span>
                      </div>
                      {spotsRatio != null && (
                        <div className="h-1.5 rounded-full bg-surface overflow-hidden">
                          <div
                            className="h-full rounded-full bg-accent transition-all duration-500"
                            style={{width: `${Math.round(spotsRatio * 100)}%`}}
                            aria-label={`${Math.round(spotsRatio * 100)}% full`}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* CTA */}
              {registrationCTA(entry)}
            </div>

            {/* Sponsors */}
            {entry.sponsors && entry.sponsors.length > 0 && (
              <div className="mt-8">
                <h3 className="label-mono mb-4">Sponsors</h3>
                <div className="flex flex-wrap gap-4">
                  {entry.sponsors.map((sponsor) =>
                    sponsor.name ? (
                      <div key={sponsor.name} className="flex items-center gap-3">
                        {sponsor.logo?.asset && '_ref' in sponsor.logo.asset && (
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-surface border border-border flex items-center justify-center">
                            <SanityImage
                              id={sponsor.logo.asset._ref}
                              alt={sponsor.name}
                              width={40}
                              height={40}
                              mode="cover"
                              className="w-full h-full object-contain"
                            />
                          </div>
                        )}
                        {sponsor.url ? (
                          <a
                            href={sponsor.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-fg hover:text-accent transition-colors duration-160"
                          >
                            {sponsor.name}
                          </a>
                        ) : (
                          <span className="text-sm font-medium text-fg">{sponsor.name}</span>
                        )}
                      </div>
                    ) : null,
                  )}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* ── Bottom CTA ──────────────────────────────────────────────────── */}
      <section className="relative bg-fg border-t border-bg/10 section-padding" aria-label="Join the Collective">
        <div
          className="absolute inset-0 bg-[url(/images/tile-grid-white.png)] opacity-[0.03]"
          style={{backgroundSize: '24px'}}
          aria-hidden="true"
        />
        <div className="container relative text-center max-w-xl mx-auto">
          <p className="label-mono text-bg/30 mb-6">The Collective</p>
          <h2 className="display-md text-bg mb-5">
            Ready to compete?
          </h2>
          <p className="text-bg/60 text-base leading-relaxed mb-10">
            Join the Fendo Collective for early access to events, member-only tournaments,
            and a community that pushes each other to improve.
          </p>
          <Link href="/collective" className="btn-accent">
            Get First Access
          </Link>
        </div>
      </section>
    </>
  )
}

// ── Registration CTA helper ────────────────────────────────────────────────────

function registrationCTA(entry: SanityEventFull) {
  const isComplete = entry.status === 'completed' || entry.status === 'cancelled'

  if (isComplete) {
    return (
      <div className="pt-4 border-t border-border">
        <p className="text-sm text-muted-2 font-mono italic text-center">
          This event has ended
        </p>
      </div>
    )
  }

  if (entry.registrationUrl) {
    return (
      <a
        href={entry.registrationUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-accent w-full justify-center"
        aria-label={`Register for ${entry.title}`}
      >
        {entry.status === 'waitlist' ? 'Join Waitlist' : 'Register Now'}
      </a>
    )
  }

  return (
    <div className="pt-4 border-t border-border">
      <p className="text-sm text-muted-2 font-mono italic text-center">
        Registration details coming soon
      </p>
    </div>
  )
}
