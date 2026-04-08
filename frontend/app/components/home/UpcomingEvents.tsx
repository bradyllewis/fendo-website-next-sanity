import Link from 'next/link'

import {sanityFetch} from '@/sanity/lib/live'
import {upcomingEventsQuery} from '@/sanity/lib/queries'
import {IconArrow, IconCalendar} from '@/app/components/icons'
import EventCard from '@/app/components/compete/EventCard'
import type {SanityEvent} from '@/app/compete/types'
import {createClient} from '@/lib/supabase/server'

interface UpcomingEventsProps {
  /** Maximum number of events to display. Defaults to 3. */
  count?: number
}

export default async function UpcomingEvents({count = 3}: UpcomingEventsProps) {
  const {data: allUpcoming} = await sanityFetch({query: upcomingEventsQuery})
  const events = (allUpcoming as SanityEvent[]).slice(0, count)

  // Fetch the current user's registrations so EventCards can show "Registered"
  let registeredEventIds: Set<string> = new Set()
  const supabase = await createClient()
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
    <section className="section-padding" aria-labelledby="upcoming-events-heading">
      <div className="container">

        {/* Section header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12">
          <div>
            <p className="label-mono mb-4">Compete</p>
            <h2 id="upcoming-events-heading" className="display-md text-fg">
              Upcoming Events.
            </h2>
          </div>
          <Link href="/compete" className="btn-ghost group shrink-0">
            View all events
            <span className="arrow"><IconArrow className="w-4 h-4" /></span>
          </Link>
        </div>

        {/* Event cards or empty state */}
        {events.length > 0 ? (
          <div
            className={`grid grid-cols-1 gap-6 ${
              count === 1
                ? 'max-w-md'
                : count === 2
                  ? 'md:grid-cols-2 max-w-4xl'
                  : 'md:grid-cols-2 lg:grid-cols-3'
            }`}
          >
            {events.map((event) => (
              <EventCard key={event._id} event={event} isRegistered={registeredEventIds.has(event._id)} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-surface flex items-center justify-center mb-5">
              <IconCalendar className="w-6 h-6 text-muted" />
            </div>
            <h3 className="text-lg font-semibold text-fg mb-2">No upcoming events</h3>
            <p className="text-sm text-muted leading-relaxed max-w-[36ch] mb-6">
              New tournaments, clinics, and community rounds are added regularly. Check back soon.
            </p>
            <Link href="/compete" className="btn-outline">
              Browse past events
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}
