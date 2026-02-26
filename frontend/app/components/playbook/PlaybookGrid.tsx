'use client'

import {useState} from 'react'
import Link from 'next/link'
import PlaybookCard from './PlaybookCard'
import type {SanityPlaybook, PlaybookContentType} from '@/app/playbook/types'

type FilterKey = 'all' | PlaybookContentType

const FILTERS: {key: FilterKey; label: string}[] = [
  {key: 'all',      label: 'All'},
  {key: 'article',  label: 'Articles'},
  {key: 'video',    label: 'Videos'},
  {key: 'guide',    label: 'Guides'},
  {key: 'drill',    label: 'Drills'},
  {key: 'tutorial', label: 'Tutorials'},
]

interface PlaybookGridProps {
  items: SanityPlaybook[]
}

export default function PlaybookGrid({items}: PlaybookGridProps) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all')

  // Only show filter tabs that have at least one matching item
  const activeTypes = new Set(items.map((i) => i.contentType).filter(Boolean))
  const visibleFilters = FILTERS.filter(
    (f) => f.key === 'all' || activeTypes.has(f.key),
  )

  const filtered =
    activeFilter === 'all'
      ? items
      : items.filter((i) => i.contentType === activeFilter)

  return (
    <div>
      {/* Filter strip */}
      {visibleFilters.length > 2 && (
        <div className="flex items-center gap-1 mb-10 border border-border rounded-xl p-1 w-fit flex-wrap">
          {visibleFilters.map(({key, label}) => {
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
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="py-20 text-center border border-dashed border-border rounded-2xl">
          <p className="label-mono mb-3">Nothing here yet</p>
          <p className="text-muted text-sm max-w-xs mx-auto leading-relaxed">
            {activeFilter === 'all'
              ? 'New content is being added soon. Check back shortly.'
              : `No ${activeFilter}s have been published yet.`}
          </p>
          <Link href="/collective" className="btn-outline mt-6 inline-flex text-sm px-5 py-2.5 rounded-xl">
            Join the Collective for early access
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((item) => (
            <PlaybookCard key={item._id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
