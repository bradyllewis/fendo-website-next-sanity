import type {Metadata} from 'next'
import Link from 'next/link'

import {sanityFetch} from '@/sanity/lib/live'
import {allEventsQuery, featuredEventQuery} from '@/sanity/lib/queries'
import {studioUrl} from '@/sanity/lib/api'

import FeaturedEvent from '@/app/components/compete/FeaturedEvent'
import EventsGrid from '@/app/components/compete/EventsGrid'
import {IconArrow, IconTicket} from '@/app/components/icons'
import type {SanityEvent} from './types'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Compete',
  description:
    'Tournaments, clinics, and community rounds for golfers obsessed with precision and measurable improvement. Real people. Real stakes. Real growth.',
}

// ── Compete stats ─────────────────────────────────────────────────────────────

const COMPETE_STATS = [
  {value: '12+', label: 'Events per year'},
  {value: '4',   label: 'Event formats'},
  {value: '150', label: 'Rounds played'},
  {value: '32',  label: 'Active members'},
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function CompetePage() {
  const [{data: allEvents}, {data: featuredEvent}] = await Promise.all([
    sanityFetch({query: allEventsQuery}),
    sanityFetch({query: featuredEventQuery}),
  ])

  const events = (allEvents ?? []) as SanityEvent[]

  // Batch-query real paid counts from Supabase for in-app-registration events.
  // This ensures EventCard spots bars show live DB counts, not stale Sanity values.
  const registrationEventIds = events
    .filter((e) => e.requiresRegistration === true && e._id)
    .map((e) => e._id)

  let paidCountMap: Record<string, number> = {}
  let registeredEventIds: Set<string> = new Set()

  const supabase = await createClient()

  // Batch-query paid counts for spot bars
  if (registrationEventIds.length > 0) {
    const { data: countRows } = await supabase
      .from('event_registrations')
      .select('event_sanity_id')
      .in('event_sanity_id', registrationEventIds)
      .eq('status', 'paid')

    if (countRows) {
      for (const row of countRows) {
        paidCountMap[row.event_sanity_id] = (paidCountMap[row.event_sanity_id] ?? 0) + 1
      }
    }
  }

  // Fetch the current user's registrations so EventCards can show "Registered"
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: myRows } = await supabase
      .from('event_registrations')
      .select('event_sanity_id')
      .eq('user_id', user.id)
      .eq('status', 'paid')
    if (myRows) {
      for (const row of myRows) registeredEventIds.add(row.event_sanity_id)
    }
  }

  return (
    <>
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative border-b border-border overflow-hidden">
        {/* Background texture */}
        <div
          className="absolute inset-0 bg-[url(/images/tile-grid-black.png)] opacity-[0.025]"
          style={{backgroundSize: '24px'}}
          aria-hidden="true"
        />

        <div className="container relative py-24 lg:py-32">
          <div className="max-w-2xl">
            <p
              className="label-mono mb-6"
              style={{animation: 'hero-fade-up 0.6s cubic-bezier(0.16,1,0.3,1) 0.1s both'}}
            >
              Events &amp; Competition
            </p>
            <h1
              className="display-lg text-fg mb-6"
              style={{animation: 'hero-fade-up 0.7s cubic-bezier(0.16,1,0.3,1) 0.2s both'}}
            >
              Compete.
            </h1>
            <p
              className="text-lg md:text-xl text-muted leading-relaxed max-w-[44ch] mb-10"
              style={{animation: 'hero-fade-up 0.7s cubic-bezier(0.16,1,0.3,1) 0.35s both'}}
            >
              Tournaments, clinics, and community rounds for golfers obsessed with precision.
              Real people. Real stakes. Real growth.
            </p>
            <div
              className="flex items-center gap-4 flex-wrap"
              style={{animation: 'hero-fade-up 0.7s cubic-bezier(0.16,1,0.3,1) 0.5s both'}}
            >
              <Link href="#events" className="btn-primary">
                Browse Events
              </Link>
              <Link href="/collective" className="btn-ghost group">
                Join the Collective
                <span className="group-hover:translate-x-1 transition-transform duration-200">
                  <IconArrow />
                </span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats strip ────────────────────────────────────────────────── */}
      <section className="border-b border-border" aria-label="Event statistics">
        <div className="container">
          <dl className="grid grid-cols-2 md:grid-cols-4 divide-x divide-border">
            {COMPETE_STATS.map(({value, label}) => (
              <div key={label} className="py-8 px-6 first:pl-0 last:pr-0 text-center md:text-left">
                <dt className="label-mono mb-2">{label}</dt>
                <dd className="display-md text-fg">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── Featured event + All events ────────────────────────────────── */}
      <section className="section-padding" id="events" aria-labelledby="events-heading">
        <div className="container">

          {/* Featured event — only shown if flagged in Sanity */}
          {featuredEvent && (
            <FeaturedEvent
              event={featuredEvent as any}
              isRegistered={!!(featuredEvent as any)?._id && registeredEventIds.has((featuredEvent as any)._id)}
            />
          )}

          {/* Section header */}
          <div className="flex items-end justify-between mb-10 gap-4">
            <div>
              <p className="label-mono mb-4">All Events</p>
              <h2 id="events-heading" className="display-md text-fg">
                Find Your Round.
              </h2>
            </div>
            <span className="text-muted" aria-hidden="true">
              <IconTicket className="w-8 h-8" />
            </span>
          </div>

          {/* Events grid with client-side filter tabs */}
          <EventsGrid events={events} studioUrl={studioUrl} paidCountMap={paidCountMap} registeredEventIds={registeredEventIds} />
        </div>
      </section>

      {/* ── Bottom CTA ─────────────────────────────────────────────────── */}
      <section className="relative bg-fg border-t border-bg/10 section-padding" aria-label={user ? 'Keep Competing' : 'Join the Collective'}>
        {/* Texture */}
        <div
          className="absolute inset-0 bg-[url(/images/tile-grid-white.png)] opacity-[0.03]"
          style={{backgroundSize: '24px'}}
          aria-hidden="true"
        />
        {user ? (
          <div className="container relative text-center max-w-2xl mx-auto py-28">
            <p className="label-mono text-accent mb-6">The Collective</p>
            <h2 className="display-md text-bg mb-5">
              Sharpen your game.
            </h2>
            <p className="text-bg/60 text-base md:text-lg leading-relaxed mb-10">
              Between events, stay sharp with expert guides, drills, and resources in the Fendo Playbook.
            </p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <Link href="/playbook" className="btn-accent">
                Browse Playbook
              </Link>
              <Link href="/account" className="btn-ghost">
                My Registrations
              </Link>
            </div>
          </div>
        ) : (
          <div className="container relative text-center max-w-2xl mx-auto py-28">
            <p className="label-mono text-accent mb-6">The Collective</p>
            <h2 className="display-md text-bg mb-5">
              Competition is better together.
            </h2>
            <p className="text-bg/60 text-base md:text-lg leading-relaxed mb-10">
              Join the Fendo Collective for early access to events, member-only rounds,
              and a community that holds you to a higher standard.
            </p>
            <Link href="/collective" className="btn-accent">
              Get First Access
            </Link>
          </div>
        )}
      </section>
    </>
  )
}
