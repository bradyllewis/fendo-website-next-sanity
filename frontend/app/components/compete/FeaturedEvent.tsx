import Link from 'next/link'
import {format, parseISO} from 'date-fns'

import SanityImage from '@/app/components/SanityImage'
import {IconCalendar, IconMapPin, IconArrow} from '@/app/components/icons'
import type {SanityEvent} from '@/app/compete/types'

interface FeaturedEventProps {
  event: SanityEvent & {
    sponsors?: Array<{name?: string; logo?: {asset?: unknown}; url?: string}> | null
  }
  isRegistered?: boolean
}

export default function FeaturedEvent({event, isRegistered = false}: FeaturedEventProps) {
  const {title, eventType, startDate, endDate, location, coverImage, shortDescription, registrationUrl, slug} = event

  const locationStr = [location?.venueName, location?.city, location?.state]
    .filter(Boolean)
    .join(', ') || null

  const dateStr = startDate
    ? endDate && startDate.slice(0, 10) !== endDate.slice(0, 10)
      ? `${format(parseISO(startDate), 'MMM d')} – ${format(parseISO(endDate), 'MMM d, yyyy')}`
      : format(parseISO(startDate), 'EEEE, MMMM d, yyyy')
    : null

  return (
    <section
      className="relative overflow-hidden rounded-2xl mb-16 min-h-[400px] flex flex-col justify-end"
      aria-label="Featured event"
    >
      {/* Background image */}
      {coverImage?.asset && '_ref' in (coverImage.asset as object) ? (
        <div className="absolute inset-0">
          <SanityImage
            id={(coverImage.asset as {_ref: string})._ref}
            alt={(coverImage as {alt?: string})?.alt || title || ''}
            width={1200}
            height={600}
            mode="cover"
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div
          className="absolute inset-0"
          style={{background: 'linear-gradient(135deg, #040F2C 0%, #31483B 60%, #0C1C23 100%)'}}
          aria-hidden="true"
        >
          <div
            className="absolute inset-0 bg-[url(/images/tile-grid-white.png)] opacity-[0.06]"
            style={{backgroundSize: '20px'}}
            aria-hidden="true"
          />
        </div>
      )}

      {/* Dark gradient overlay */}
      <div
        className="absolute inset-0"
        style={{background: 'linear-gradient(to top, rgba(4,15,44,0.97) 0%, rgba(4,15,44,0.72) 55%, rgba(4,15,44,0.25) 100%)'}}
        aria-hidden="true"
      />

      {/* Content */}
      <div className="relative container py-12 lg:py-16">
        <div className="max-w-2xl">
          {/* Labels row */}
          <div className="flex items-center gap-3 mb-6 flex-wrap">
            <span className="label-mono text-bg/70">Featured Event</span>
            {eventType && (
              <>
                <span className="text-bg/40 text-xs">·</span>
                <span className="label-mono text-bg/70">
                  {eventType.replace(/_/g, ' ')}
                </span>
              </>
            )}
            {isRegistered && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[0.65rem] font-mono font-medium tracking-widest uppercase bg-green/15 text-bg border border-bg/20">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                  <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Registered
              </span>
            )}
          </div>

          {/* Title */}
          <h2 className="display-md text-bg mb-5 leading-tight">
            {title}
          </h2>

          {/* Description */}
          {shortDescription && (
            <p className="text-bg/90 text-base md:text-lg leading-relaxed max-w-[50ch] mb-6">
              {shortDescription}
            </p>
          )}

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-8">
            {dateStr && (
              <div className="flex items-center gap-2 text-sm font-mono text-bg/80">
                <IconCalendar className="w-4 h-4" />
                <span>{dateStr}</span>
              </div>
            )}
            {locationStr && (
              <div className="flex items-center gap-2 text-sm font-mono text-bg/80">
                <IconMapPin className="w-4 h-4" />
                <span>{locationStr}</span>
              </div>
            )}
          </div>

          {/* CTA row */}
          <div className="flex items-center gap-4 flex-wrap">
            {slug && (
              <Link href={`/compete/${slug}`} className="btn-accent">
                Details
                <IconArrow />
              </Link>
            )}
            {!slug && registrationUrl && (
              <a
                href={registrationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-accent"
              >
                Register Now
              </a>
            )}
            <Link href="#events" className="btn-ghost group text-bg hover:text-bg/70">
              View all events
              <span className="group-hover:translate-x-1 transition-transform duration-200">
                <IconArrow />
              </span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
