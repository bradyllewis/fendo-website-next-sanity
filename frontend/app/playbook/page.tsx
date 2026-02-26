import type {Metadata} from 'next'
import Link from 'next/link'

import {sanityFetch} from '@/sanity/lib/live'
import {allPlaybooksQuery, featuredPlaybookQuery} from '@/sanity/lib/queries'
import {IconArrow, IconBook, IconVideo, IconClock} from '@/app/components/icons'
import SanityImage from '@/app/components/SanityImage'
import PlaybookGrid from '@/app/components/playbook/PlaybookGrid'
import type {SanityPlaybook} from './types'
import {CONTENT_TYPE_LABELS, CATEGORY_LABELS} from './types'
import {format, parseISO} from 'date-fns'

export const metadata: Metadata = {
  title: 'Playbook',
  description:
    'Expert guides, drills, videos, and articles to sharpen every part of your game. Learn from Fendo coaches and top contributors in the community.',
}

// ── Featured Playbook Hero ─────────────────────────────────────────────────────

function FeaturedPlaybook({item}: {item: SanityPlaybook}) {
  const href = `/playbook/${item.slug}`
  const typeLabel = item.contentType ? (CONTENT_TYPE_LABELS[item.contentType] ?? item.contentType) : null
  const categoryLabel = item.category ? (CATEGORY_LABELS[item.category] ?? item.category) : null
  const authorName =
    item.author?.firstName && item.author?.lastName
      ? `${item.author.firstName} ${item.author.lastName}`
      : null
  const dateLabel = item.publishedAt
    ? format(parseISO(item.publishedAt), 'MMMM d, yyyy')
    : null

  return (
    <div className="mb-16">
      <Link
        href={href}
        className="group relative flex flex-col lg:flex-row overflow-hidden rounded-2xl border border-border bg-fg hover:-translate-y-px transition-transform duration-160"
      >
        {/* Image */}
        <div className="relative lg:w-1/2 aspect-[16/9] lg:aspect-auto overflow-hidden shrink-0">
          {item.coverImage?.asset ? (
            <div className="absolute inset-0 overflow-hidden group-hover:scale-[1.02] transition-transform duration-300">
              <SanityImage
                id={item.coverImage.asset._ref}
                alt={item.coverImage.alt ?? item.title ?? 'Featured playbook'}
                hotspot={item.coverImage.hotspot ?? undefined}
                crop={item.coverImage.crop ?? undefined}
                mode="cover"
                width={800}
                height={520}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="absolute inset-0 bg-fg/80 flex items-center justify-center">
              <IconBook className="w-16 h-16 text-bg/20" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="lg:w-1/2 p-8 lg:p-10 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="label-mono text-xs bg-accent text-bg px-2.5 py-1 rounded-full">
              Featured
            </span>
            {typeLabel && (
              <span className="label-mono text-xs text-bg/50">{typeLabel}</span>
            )}
            {categoryLabel && (
              <>
                <span className="text-bg/20" aria-hidden="true">·</span>
                <span className="label-mono text-xs text-bg/50">{categoryLabel}</span>
              </>
            )}
          </div>

          <h2 className="display-md text-bg mb-4 leading-tight">
            {item.title}
          </h2>

          {item.excerpt && (
            <p className="text-bg/60 text-base leading-relaxed mb-6 max-w-[40ch]">
              {item.excerpt}
            </p>
          )}

          <div className="flex items-center gap-3 text-sm text-bg/40 mb-8 font-mono">
            {authorName && <span>{authorName}</span>}
            {authorName && dateLabel && <span>·</span>}
            {dateLabel && <span>{dateLabel}</span>}
          </div>

          <div className="flex items-center gap-2 text-accent font-semibold text-sm group-hover:gap-3 transition-all duration-200">
            {item.contentType === 'video' ? (
              <IconVideo className="w-4 h-4" />
            ) : (
              <IconBook className="w-4 h-4" />
            )}
            <span>
              {item.contentType === 'video' ? 'Watch Now' : 'Read Now'}
            </span>
            <IconArrow className="w-4 h-4" />
          </div>
        </div>
      </Link>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PlaybookPage() {
  const [{data: allPlaybooks}, {data: featuredPlaybook}] = await Promise.all([
    sanityFetch({query: allPlaybooksQuery}),
    sanityFetch({query: featuredPlaybookQuery}),
  ])

  const items = (allPlaybooks ?? []) as SanityPlaybook[]

  // Exclude the featured item from the grid to avoid duplication
  const featuredId = (featuredPlaybook as SanityPlaybook | null)?._id
  const gridItems = featuredId ? items.filter((i) => i._id !== featuredId) : items

  return (
    <>
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative border-b border-border overflow-hidden">
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
              Education &amp; Resources
            </p>
            <h1
              className="display-lg text-fg mb-6"
              style={{animation: 'hero-fade-up 0.7s cubic-bezier(0.16,1,0.3,1) 0.2s both'}}
            >
              Playbook.
            </h1>
            <p
              className="text-lg md:text-xl text-muted leading-relaxed max-w-[44ch] mb-10"
              style={{animation: 'hero-fade-up 0.7s cubic-bezier(0.16,1,0.3,1) 0.35s both'}}
            >
              Expert guides, drills, and resources for golfers who want to understand the game
              deeply — not just play it.
            </p>
            <div
              className="flex items-center gap-4 flex-wrap"
              style={{animation: 'hero-fade-up 0.7s cubic-bezier(0.16,1,0.3,1) 0.5s both'}}
            >
              <a href="#content" className="btn-primary">
                Browse All
              </a>
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

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <section className="section-padding" id="content" aria-labelledby="playbook-heading">
        <div className="container">

          {/* Featured entry */}
          {featuredPlaybook && (
            <FeaturedPlaybook item={featuredPlaybook as SanityPlaybook} />
          )}

          {/* Section header */}
          <div className="flex items-end justify-between mb-10 gap-4">
            <div>
              <p className="label-mono mb-4">The Full Library</p>
              <h2 id="playbook-heading" className="display-md text-fg">
                {featuredPlaybook ? 'All Entries.' : 'Browse the Playbook.'}
              </h2>
            </div>
            <span className="text-muted" aria-hidden="true">
              <IconBook className="w-8 h-8" />
            </span>
          </div>

          {/* Grid with client-side content type filters */}
          {items.length > 0 ? (
            <PlaybookGrid items={gridItems} />
          ) : (
            <div className="text-center py-24 border border-dashed border-border rounded-2xl">
              <p className="label-mono mb-4 text-muted">Coming Soon</p>
              <p className="text-muted text-base max-w-[36ch] mx-auto leading-relaxed">
                The Playbook is being built. Join the Collective to get notified when new content drops.
              </p>
              <Link href="/collective" className="btn-accent mt-8 inline-flex">
                Get Early Access
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ── Bottom CTA ──────────────────────────────────────────────────── */}
      <section className="relative bg-fg border-t border-bg/10 section-padding" aria-label="Join the Collective">
        <div
          className="absolute inset-0 bg-[url(/images/tile-grid-white.png)] opacity-[0.03]"
          style={{backgroundSize: '24px'}}
          aria-hidden="true"
        />
        <div className="container relative text-center max-w-2xl mx-auto py-28">
          <p className="label-mono text-accent mb-6">The Collective</p>
          <h2 className="display-md text-bg mb-5">
            Better golfers read between the lines.
          </h2>
          <p className="text-bg/60 text-base md:text-lg leading-relaxed mb-10">
            Join the Fendo Collective for member-only content, early access to new guides,
            and a community that takes improvement seriously.
          </p>
          <Link href="/collective" className="btn-accent">
            Get First Access
          </Link>
        </div>
      </section>
    </>
  )
}
