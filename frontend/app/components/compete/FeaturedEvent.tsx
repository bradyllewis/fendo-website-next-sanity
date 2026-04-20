'use client'

import {useState, useEffect, useCallback} from 'react'
import Link from 'next/link'
import {format, parseISO} from 'date-fns'

import SanityImage from '@/app/components/SanityImage'
import {IconCalendar, IconMapPin, IconArrow} from '@/app/components/icons'
import type {SanityEvent} from '@/app/compete/types'

const INTERVAL_MS = 5500

type FeaturedEventItem = SanityEvent & {
  sponsors?: Array<{name?: string; logo?: {asset?: unknown}; url?: string}> | null
}

interface FeaturedEventProps {
  events: FeaturedEventItem[]
  registeredIds?: string[]
}

function getDateStr(startDate: string | null, endDate: string | null) {
  if (!startDate) return null
  if (endDate && startDate.slice(0, 10) !== endDate.slice(0, 10)) {
    return `${format(parseISO(startDate), 'MMM d')} – ${format(parseISO(endDate), 'MMM d, yyyy')}`
  }
  return format(parseISO(startDate), 'EEEE, MMMM d, yyyy')
}

function getLocationStr(location: SanityEvent['location']) {
  return [location?.venueName, location?.city, location?.state].filter(Boolean).join(', ') || null
}

export default function FeaturedEvent({events, registeredIds = []}: FeaturedEventProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [progressKey, setProgressKey] = useState(0)

  const isSlider = events.length > 1
  const reducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const advance = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % events.length)
    setProgressKey((prev) => prev + 1)
  }, [events.length])

  const goTo = (idx: number) => {
    setActiveIndex(idx)
    setProgressKey((prev) => prev + 1)
  }

  const goPrev = () => {
    setActiveIndex((prev) => (prev - 1 + events.length) % events.length)
    setProgressKey((prev) => prev + 1)
  }

  useEffect(() => {
    if (!isSlider || isPaused || reducedMotion) return
    const timer = setInterval(advance, INTERVAL_MS)
    return () => clearInterval(timer)
  }, [isSlider, isPaused, reducedMotion, advance])

  return (
    <section
      className="relative overflow-hidden rounded-2xl mb-16 min-h-[500px] lg:min-h-[540px] flex flex-col justify-end"
      aria-label="Featured events"
      onMouseEnter={() => isSlider && setIsPaused(true)}
      onMouseLeave={() => isSlider && setIsPaused(false)}
      onFocus={() => isSlider && setIsPaused(true)}
      onBlur={() => isSlider && setIsPaused(false)}
    >
      {/* Background images — stacked, opacity-crossfade */}
      {events.map((event, idx) => {
        const {coverImage, title} = event
        return (
          <div
            key={event._id}
            className="absolute inset-0 transition-opacity duration-1000 ease-in-out"
            style={{opacity: idx === activeIndex ? 1 : 0}}
            aria-hidden="true"
          >
            {coverImage?.asset && '_ref' in (coverImage.asset as object) ? (
              <SanityImage
                id={(coverImage.asset as {_ref: string})._ref}
                alt={(coverImage as {alt?: string})?.alt || title || ''}
                width={1200}
                height={600}
                mode="cover"
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="absolute inset-0"
                style={{background: 'linear-gradient(135deg, #040F2C 0%, #31483B 60%, #0C1C23 100%)'}}
              >
                <div
                  className="absolute inset-0 bg-[url(/images/tile-grid-white.png)] opacity-[0.06]"
                  style={{backgroundSize: '20px'}}
                  aria-hidden="true"
                />
              </div>
            )}
          </div>
        )
      })}

      {/* Dark gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to top, rgba(4,15,44,0.97) 0%, rgba(4,15,44,0.72) 55%, rgba(4,15,44,0.25) 100%)',
        }}
        aria-hidden="true"
      />

      {/* Slide contents — stacked, opacity-crossfade */}
      {events.map((event, idx) => {
        const isActive = idx === activeIndex
        const {title, eventType, startDate, endDate, location, shortDescription, registrationUrl, slug, _id} = event
        const isRegistered = registeredIds.includes(_id)
        const locationStr = getLocationStr(location)
        const dateStr = getDateStr(startDate, endDate)

        return (
          <div
            key={event._id}
            className="absolute inset-0 flex flex-col justify-end transition-opacity duration-700 ease-in-out"
            style={{opacity: isActive ? 1 : 0, pointerEvents: isActive ? 'auto' : 'none'}}
            aria-hidden={!isActive}
          >
            <div className="relative container py-12 lg:py-16">
              <div className="max-w-2xl">
                {/* Labels */}
                <div className="flex items-center gap-3 mb-6 flex-wrap">
                  <span className="label-mono text-bg/70">Featured Event</span>
                  {eventType && (
                    <>
                      <span className="text-bg/40 text-xs">·</span>
                      <span className="label-mono text-bg/70">{eventType.replace(/_/g, ' ')}</span>
                    </>
                  )}
                  {isRegistered && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[0.65rem] font-mono font-medium tracking-widest uppercase bg-green/15 text-bg border border-bg/20">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                        <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Registered
                    </span>
                  )}
                </div>

                {/* Title */}
                <h2 className="display-md text-bg mb-5 leading-tight">{title}</h2>

                {/* Description */}
                {shortDescription && (
                  <p className="text-bg/90 text-base md:text-lg leading-relaxed max-w-[50ch] mb-6">
                    {shortDescription}
                  </p>
                )}

                {/* Meta */}
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

                {/* CTAs */}
                <div className="flex items-center gap-4 flex-wrap">
                  {slug && (
                    <Link href={`/compete/${slug}`} className="btn-accent">
                      Details
                      <IconArrow />
                    </Link>
                  )}
                  {!slug && registrationUrl && (
                    <a href={registrationUrl} target="_blank" rel="noopener noreferrer" className="btn-accent">
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
          </div>
        )
      })}

      {/* Slider controls */}
      {isSlider && (
        <>
          {/* Prev arrow */}
          <button
            type="button"
            onClick={goPrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-bg/10 hover:bg-bg/20 text-bg/60 hover:text-bg transition-all duration-200 backdrop-blur-sm border border-bg/10 hover:border-bg/20"
            aria-label="Previous featured event"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          {/* Next arrow */}
          <button
            type="button"
            onClick={advance}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-bg/10 hover:bg-bg/20 text-bg/60 hover:text-bg transition-all duration-200 backdrop-blur-sm border border-bg/10 hover:border-bg/20"
            aria-label="Next featured event"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>

          {/* Dot indicators with progress bar on active */}
          <div className="absolute bottom-6 right-6 flex items-center gap-2" role="tablist" aria-label="Featured event slides">
            {events.map((event, idx) => {
              const isActive = idx === activeIndex
              return (
                <button
                  key={event._id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-label={`Slide ${idx + 1}${event.title ? `: ${event.title}` : ''}`}
                  onClick={() => goTo(idx)}
                  className="relative h-[3px] rounded-full overflow-hidden transition-all duration-300 ease-out"
                  style={{
                    width: isActive ? '36px' : '12px',
                    background: 'rgba(255,255,255,0.2)',
                  }}
                >
                  {isActive && (
                    <div
                      key={progressKey}
                      className="absolute inset-y-0 left-0 rounded-full bg-accent"
                      style={{
                        animation: reducedMotion ? 'none' : `featured-progress ${INTERVAL_MS}ms linear forwards`,
                        animationPlayState: isPaused ? 'paused' : 'running',
                        width: reducedMotion ? '100%' : undefined,
                      }}
                    />
                  )}
                </button>
              )
            })}
          </div>

          <style>{`
            @keyframes featured-progress {
              from { width: 0%; }
              to   { width: 100%; }
            }
          `}</style>
        </>
      )}
    </section>
  )
}
