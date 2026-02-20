'use client'

import {useState} from 'react'
import EventCard from './EventCard'
import type {SanityEvent} from '@/app/compete/types'

type FilterKey = 'all' | 'upcoming' | 'past'

const FILTERS: {key: FilterKey; label: string}[] = [
  {key: 'all',      label: 'All Events'},
  {key: 'upcoming', label: 'Upcoming'},
  {key: 'past',     label: 'Past'},
]

const UPCOMING_STATUSES = new Set(['upcoming', 'registration_open', 'waitlist'])
const PAST_STATUSES     = new Set(['completed', 'cancelled'])

interface EventsGridProps {
  events: SanityEvent[]
  studioUrl: string
}

export default function EventsGrid({events, studioUrl}: EventsGridProps) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>('upcoming')

  const filtered = events.filter((e) => {
    if (activeFilter === 'all')      return true
    if (activeFilter === 'upcoming') return e.status ? UPCOMING_STATUSES.has(e.status) : true
    if (activeFilter === 'past')     return e.status ? PAST_STATUSES.has(e.status)     : false
    return true
  })

  const isEmpty = filtered.length === 0

  return (
    <div>
      {/* Filter strip */}
      <div className="flex items-center gap-1 mb-10 border border-border rounded-xl p-1 w-fit">
        {FILTERS.map(({key, label}) => {
          const isActive = activeFilter === key
          return (
            <button
              key={key}
              onClick={() => setActiveFilter(key)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-160 cursor-pointer ${
                isActive
                  ? 'bg-fg text-bg shadow-sm'
                  : 'text-muted hover:text-fg'
              }`}
              aria-pressed={isActive}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Grid */}
      {isEmpty ? (
        <div className="py-20 text-center border border-dashed border-border rounded-2xl">
          <p className="label-mono mb-3">No events</p>
          <p className="text-muted text-sm max-w-xs mx-auto leading-relaxed">
            {activeFilter === 'upcoming'
              ? 'No upcoming events scheduled yet. Check back soon.'
              : activeFilter === 'past'
              ? 'No past events on record yet.'
              : 'No events have been created yet.'}
          </p>
          {studioUrl && (
            <a
              href={`${studioUrl}/structure/event`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline mt-6 text-sm px-5 py-2.5 rounded-xl inline-flex"
            >
              Add an event in Studio
            </a>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((event) => (
            <EventCard key={event._id} event={event} />
          ))}
        </div>
      )}
    </div>
  )
}
