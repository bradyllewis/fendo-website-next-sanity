import Link from 'next/link'
import {Suspense} from 'react'

import {sanityFetch} from '@/sanity/lib/live'
import {allPlaybooksQuery} from '@/sanity/lib/queries'
import {IconArrow, IconBook} from '@/app/components/icons'
import PlaybookCard from '@/app/components/playbook/PlaybookCard'
import type {SanityPlaybook} from '@/app/playbook/types'

// ── Types ──────────────────────────────────────────────────────────────────────

interface PlaybookShowcaseProps {
  /** Number of playbook cards to display. Defaults to 3. */
  count?: number
  /** When true, featured playbooks are sorted to the top before slicing. */
  featured?: boolean
  /** Mono label rendered above the heading. */
  label?: string
  /** Section heading text. */
  title?: string
  /** Destination for the "View all" link. */
  viewAllHref?: string
  /** Label for the "View all" link. */
  viewAllLabel?: string
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function PlaybookSkeleton({count}: {count: number}) {
  return (
    <div
      className={`grid grid-cols-1 gap-6 ${
        count >= 3
          ? 'md:grid-cols-2 lg:grid-cols-3'
          : count === 2
            ? 'md:grid-cols-2'
            : 'max-w-md'
      }`}
    >
      {Array.from({length: count}).map((_, i) => (
        <div key={i} className="h-72 rounded-xl bg-surface animate-pulse" />
      ))}
    </div>
  )
}

// ── Inner async fetcher ────────────────────────────────────────────────────────

async function PlaybookItems({
  count,
  featured,
  viewAllHref,
  viewAllLabel,
}: Pick<PlaybookShowcaseProps, 'count' | 'featured' | 'viewAllHref' | 'viewAllLabel'> & {
  count: number
  viewAllHref: string
  viewAllLabel: string
}) {
  const {data} = await sanityFetch({query: allPlaybooksQuery})
  let playbooks = (data ?? []) as SanityPlaybook[]

  if (featured) {
    playbooks = [
      ...playbooks.filter((p) => p.isFeatured),
      ...playbooks.filter((p) => !p.isFeatured),
    ]
  }

  playbooks = playbooks.slice(0, count)

  if (playbooks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-14 h-14 rounded-2xl bg-surface flex items-center justify-center mb-5">
          <IconBook className="w-6 h-6 text-muted" />
        </div>
        <h3 className="text-lg font-semibold text-fg mb-2">Nothing published yet</h3>
        <p className="text-sm text-muted leading-relaxed max-w-[36ch] mb-6">
          Guides, drills, and articles are added regularly. Check back soon.
        </p>
        <Link href={viewAllHref} className="btn-outline">
          {viewAllLabel}
        </Link>
      </div>
    )
  }

  return (
    <div
      className={`grid grid-cols-1 gap-6 ${
        count >= 3
          ? 'md:grid-cols-2 lg:grid-cols-3'
          : count === 2
            ? 'md:grid-cols-2'
            : 'max-w-md'
      }`}
    >
      {playbooks.map((item) => (
        <PlaybookCard key={item._id} item={item} />
      ))}
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function PlaybookShowcase({
  count = 3,
  featured = false,
  label = 'The Playbook',
  title = 'Latest Articles.',
  viewAllHref = '/playbook',
  viewAllLabel = 'Browse the playbook',
}: PlaybookShowcaseProps) {
  return (
    <section className="section-padding" aria-labelledby="playbook-showcase-heading">
      <div className="container">

        {/* Section header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12">
          <div>
            <p className="label-mono mb-4">{label}</p>
            <h2 id="playbook-showcase-heading" className="display-md text-fg">
              {title}
            </h2>
          </div>
          <Link href={viewAllHref} className="btn-ghost group shrink-0">
            {viewAllLabel}
            <span className="arrow"><IconArrow className="w-4 h-4" /></span>
          </Link>
        </div>

        {/* Cards */}
        <Suspense fallback={<PlaybookSkeleton count={count} />}>
          <PlaybookItems
            count={count}
            featured={featured}
            viewAllHref={viewAllHref}
            viewAllLabel={viewAllLabel}
          />
        </Suspense>

      </div>
    </section>
  )
}
