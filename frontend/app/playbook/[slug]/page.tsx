import type {Metadata, ResolvingMetadata} from 'next'
import {notFound} from 'next/navigation'
import {type PortableTextBlock} from 'next-sanity'
import Link from 'next/link'
import {format, parseISO} from 'date-fns'

import PortableText from '@/app/components/PortableText'
import SanityImage from '@/app/components/SanityImage'
import {sanityFetch} from '@/sanity/lib/live'
import {playbookQuery, playbookSlugQuery} from '@/sanity/lib/queries'
import {resolveOpenGraphImage} from '@/sanity/lib/utils'
import {IconArrow, IconDownload, IconClock, IconVideo, IconPlay} from '@/app/components/icons'
import PlaybookCard from '@/app/components/playbook/PlaybookCard'
import PlaybookProgressBar from '@/app/components/playbook/PlaybookProgressBar'
import type {SanityPlaybookFull, SanityPlaybook} from '../types'
import {CONTENT_TYPE_LABELS, CATEGORY_LABELS, DIFFICULTY_LABELS} from '../types'

type Props = {params: Promise<{slug: string}>}

// ── Static generation ──────────────────────────────────────────────────────────

export async function generateStaticParams() {
  const {data} = await sanityFetch({
    query: playbookSlugQuery,
    perspective: 'published',
    stega: false,
  })
  return data ?? []
}

// ── Metadata ───────────────────────────────────────────────────────────────────

export async function generateMetadata(props: Props, parent: ResolvingMetadata): Promise<Metadata> {
  const params = await props.params
  const {data: entry} = await sanityFetch({
    query: playbookQuery,
    params,
    stega: false,
  })
  const previousImages = (await parent).openGraph?.images || []
  const ogImage = resolveOpenGraphImage(entry?.coverImage)

  return {
    title: entry?.title ?? 'Playbook',
    description: entry?.excerpt ?? undefined,
    authors:
      entry?.author?.firstName && entry?.author?.lastName
        ? [{name: `${entry.author.firstName} ${entry.author.lastName}`}]
        : [],
    openGraph: {
      images: ogImage ? [ogImage, ...previousImages] : previousImages,
    },
  } satisfies Metadata
}

// ── Video embed ────────────────────────────────────────────────────────────────

function PlaybookVideo({video}: {video: SanityPlaybookFull['video']}) {
  if (!video?.platform) return null

  const {platform, embedId, url, fileUrl, duration} = video

  if ((platform === 'youtube' || platform === 'vimeo') && embedId) {
    const src =
      platform === 'youtube'
        ? `https://www.youtube.com/embed/${embedId}?rel=0&modestbranding=1`
        : `https://player.vimeo.com/video/${embedId}?byline=0&portrait=0`

    return (
      <div className="mb-12">
        <div className="relative aspect-video rounded-xl overflow-hidden bg-fg shadow-xl">
          <iframe
            src={src}
            title="Playbook video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
          />
        </div>
        {duration && (
          <p className="flex items-center gap-1.5 mt-3 text-sm text-muted font-mono">
            <IconClock className="w-3.5 h-3.5" />
            {duration}
          </p>
        )}
      </div>
    )
  }

  if (platform === 'uploaded' && fileUrl) {
    return (
      <div className="mb-12">
        <div className="relative aspect-video rounded-xl overflow-hidden bg-fg shadow-xl">
          <video
            src={fileUrl}
            controls
            className="absolute inset-0 w-full h-full"
          />
        </div>
        {duration && (
          <p className="flex items-center gap-1.5 mt-3 text-sm text-muted font-mono">
            <IconClock className="w-3.5 h-3.5" />
            {duration}
          </p>
        )}
      </div>
    )
  }

  if (url) {
    return (
      <div className="mb-12">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-5 rounded-xl border border-border bg-surface hover:border-accent transition-colors duration-160 group"
        >
          <span className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center shrink-0">
            <IconPlay className="w-4 h-4 text-bg" />
          </span>
          <div>
            <p className="font-semibold text-fg text-sm">Watch Video</p>
            <p className="text-xs text-muted font-mono truncate max-w-xs">{url}</p>
          </div>
          <IconArrow className="w-4 h-4 text-muted group-hover:text-accent transition-colors ml-auto" />
        </a>
      </div>
    )
  }

  return null
}

// ── Attachments ────────────────────────────────────────────────────────────────

function Attachments({attachments}: {attachments: SanityPlaybookFull['attachments']}) {
  if (!attachments?.length) return null

  return (
    <div className="mt-14 pt-10 border-t border-border">
      <p className="label-mono mb-2 text-accent">Resources</p>
      <h3 className="text-lg font-semibold text-fg mb-6 tracking-tight">Downloads &amp; Attachments</h3>
      <ul className="space-y-3">
        {attachments.map((att) =>
          att.fileUrl ? (
            <li key={att._key}>
              <a
                href={att.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="flex items-center gap-4 p-4 rounded-xl border border-border bg-surface hover:border-accent hover:bg-accent/5 transition-all duration-160 group"
              >
                <span className="w-9 h-9 rounded-lg bg-fg/5 border border-border flex items-center justify-center shrink-0 group-hover:bg-accent/10 group-hover:border-accent/30 transition-all duration-160">
                  <IconDownload className="w-4 h-4 text-fg/60 group-hover:text-accent transition-colors duration-160" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-fg">{att.title}</p>
                  {att.description && (
                    <p className="text-xs text-muted mt-0.5 line-clamp-1">{att.description}</p>
                  )}
                </div>
                {att.fileType && (
                  <span className="label-mono text-xs text-muted shrink-0">
                    {att.fileType.toUpperCase()}
                  </span>
                )}
              </a>
            </li>
          ) : null
        )}
      </ul>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PlaybookEntryPage(props: Props) {
  const params = await props.params
  const {data: entry} = await sanityFetch({query: playbookQuery, params})
  const post = entry as SanityPlaybookFull | null

  if (!post?._id) return notFound()

  const authorName =
    post.author?.firstName && post.author?.lastName
      ? `${post.author.firstName} ${post.author.lastName}`
      : null
  const dateLabel = post.publishedAt
    ? format(parseISO(post.publishedAt), 'MMMM d, yyyy')
    : null
  const typeLabel = post.contentType ? (CONTENT_TYPE_LABELS[post.contentType] ?? post.contentType) : null
  const categoryLabel = post.category ? (CATEGORY_LABELS[post.category] ?? post.category) : null
  const difficultyLabel =
    post.difficulty && post.difficulty !== 'all-levels'
      ? (DIFFICULTY_LABELS[post.difficulty] ?? post.difficulty)
      : null

  const allContributors = [
    ...(post.author ? [post.author] : []),
    ...(post.contributors ?? []),
  ]

  const hasImage = Boolean(post.coverImage?.asset) && post.contentType !== 'video'

  return (
    <>
      {/* Reading progress */}
      <PlaybookProgressBar />

      {/* ── Back link ───────────────────────────────────────────────────── */}
      <div className="border-b border-border bg-bg">
        <div className="container py-3.5">
          <Link
            href="/playbook"
            className="inline-flex items-center gap-2 text-sm text-muted hover:text-fg transition-colors duration-160 group w-fit"
          >
            <svg
              className="w-4 h-4 rotate-180 group-hover:-translate-x-0.5 transition-transform duration-160"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
            <span className="font-mono text-xs tracking-wide uppercase">Playbook</span>
          </Link>
        </div>
      </div>

      {/* ── Entry header ────────────────────────────────────────────────── */}
      <article>
        <header className="relative overflow-hidden bg-fg">
          {/* Cover image used as atmospheric header background */}
          {hasImage && (
            <>
              <div className="absolute inset-0 overflow-hidden">
                <SanityImage
                  id={post.coverImage!.asset!._ref}
                  alt=""
                  mode="cover"
                  width={1400}
                  height={700}
                  className="w-full h-full object-cover"
                />
              </div>
              {/* Gradient: opaque dark left → transparent right (desktop), opaque dark top → semi on mobile */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(to bottom, rgba(12,28,35,0.92) 0%, rgba(12,28,35,0.88) 60%, rgba(12,28,35,0.96) 100%)',
                }}
                aria-hidden="true"
              />
              <div
                className="absolute inset-0 hidden lg:block"
                style={{
                  background:
                    'linear-gradient(to right, rgba(12,28,35,0.98) 0%, rgba(12,28,35,0.92) 40%, rgba(12,28,35,0.55) 65%, rgba(12,28,35,0.15) 100%)',
                }}
                aria-hidden="true"
              />
            </>
          )}

          <div className="container relative py-16 lg:py-24 max-w-4xl">
            {/* Badges */}
            <div className="flex items-center gap-2 mb-7 flex-wrap">
              {typeLabel && (
                <span className="label-mono text-xs bg-accent text-bg px-2.5 py-1 rounded-full">
                  {typeLabel}
                </span>
              )}
              {categoryLabel && (
                <span className="label-mono text-xs border border-bg/20 text-bg/60 px-2.5 py-1 rounded-full">
                  {categoryLabel}
                </span>
              )}
              {difficultyLabel && (
                <span className="label-mono text-xs border border-bg/20 text-bg/40 px-2.5 py-1 rounded-full">
                  {difficultyLabel}
                </span>
              )}
              {post.isPremium && (
                <span className="label-mono text-xs bg-mustard text-fg px-2.5 py-1 rounded-full">
                  Members Only
                </span>
              )}
            </div>

            {/* Title */}
            <h1 className="display-md lg:display-lg text-bg mb-5 max-w-[22ch] leading-tight">
              {post.title}
            </h1>

            {/* Excerpt */}
            {post.excerpt && (
              <p className="text-lg text-bg/60 leading-relaxed max-w-[48ch] mb-10">
                {post.excerpt}
              </p>
            )}

            {/* Author + meta row */}
            <div className="flex items-center gap-5 flex-wrap pt-8 border-t border-bg/10">
              {/* Author avatars */}
              {allContributors.length > 0 && (
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {allContributors.slice(0, 3).map((person, i) =>
                      person.picture?.asset ? (
                        <div
                          key={i}
                          className="w-8 h-8 rounded-full overflow-hidden border-2 border-fg/60 bg-fg/10"
                        >
                          <SanityImage
                            id={person.picture.asset._ref}
                            alt={
                              person.firstName && person.lastName
                                ? `${person.firstName} ${person.lastName}`
                                : 'Contributor'
                            }
                            mode="cover"
                            width={32}
                            height={32}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div
                          key={i}
                          className="w-8 h-8 rounded-full border-2 border-fg/60 bg-bg/20 flex items-center justify-center text-xs font-semibold text-bg/70"
                        >
                          {person.firstName?.[0] ?? '?'}
                        </div>
                      )
                    )}
                  </div>
                  <div className="text-sm text-bg/70 font-medium">
                    {allContributors
                      .slice(0, 2)
                      .map((p) =>
                        p.firstName && p.lastName ? `${p.firstName} ${p.lastName}` : null,
                      )
                      .filter(Boolean)
                      .join(', ')}
                    {allContributors.length > 2 && ` +${allContributors.length - 2}`}
                  </div>
                </div>
              )}

              {/* Date */}
              {dateLabel && (
                <div className="flex items-center gap-1.5 text-sm text-bg/50 font-mono">
                  <IconClock className="w-3.5 h-3.5" />
                  {dateLabel}
                </div>
              )}

              {/* Video duration */}
              {post.video?.duration && post.contentType === 'video' && (
                <div className="flex items-center gap-1.5 text-sm text-bg/50 font-mono">
                  <IconVideo className="w-3.5 h-3.5" />
                  {post.video.duration}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ── Body ─────────────────────────────────────────────────────── */}
        <div className="container max-w-3xl py-12 lg:py-16">
          {/* Video embed (shown before body for video content) */}
          {post.video && <PlaybookVideo video={post.video} />}

          {/* Cover image — shown after header for non-video content that has an image */}
          {hasImage && (
            <div className="mb-12 -mt-4">
              <div className="relative aspect-[16/9] overflow-hidden rounded-xl shadow-lg border border-border/50">
                <SanityImage
                  id={post.coverImage!.asset!._ref}
                  alt={post.coverImage!.alt ?? post.title ?? 'Cover image'}
                  hotspot={post.coverImage!.hotspot ?? undefined}
                  crop={post.coverImage!.crop ?? undefined}
                  mode="cover"
                  width={896}
                  height={504}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}

          {/* Rich text body */}
          {post.body && Array.isArray(post.body) && post.body.length > 0 && (
            <div className="relative">
              {/* Decorative left rule for long-form content */}
              <div className="absolute -left-6 top-0 bottom-0 w-px bg-border hidden xl:block" aria-hidden="true" />
              <PortableText
                className="prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-fg"
                value={post.body as PortableTextBlock[]}
              />
            </div>
          )}

          {/* Attachments */}
          <Attachments attachments={post.attachments} />

          {/* Author card — inline at bottom of content */}
          {allContributors.length > 0 && (
            <div className="mt-14 pt-10 border-t border-border">
              <p className="label-mono mb-5 text-muted">Written by</p>
              <div className="flex flex-col gap-4">
                {allContributors.map((person, i) => (
                  <div key={i} className="flex items-center gap-4">
                    {person.picture?.asset ? (
                      <div className="w-11 h-11 rounded-full overflow-hidden shrink-0 bg-fg/10">
                        <SanityImage
                          id={person.picture.asset._ref}
                          alt={
                            person.firstName && person.lastName
                              ? `${person.firstName} ${person.lastName}`
                              : 'Contributor'
                          }
                          mode="cover"
                          width={44}
                          height={44}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-fg/10 border border-border flex items-center justify-center text-sm font-semibold text-fg/50 shrink-0">
                        {person.firstName?.[0] ?? '?'}
                      </div>
                    )}
                    <div>
                      {person.firstName && person.lastName && (
                        <p className="font-semibold text-sm text-fg">
                          {person.firstName} {person.lastName}
                        </p>
                      )}
                      {i === 0 && dateLabel && (
                        <p className="text-xs text-muted font-mono mt-0.5">{dateLabel}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </article>

      {/* ── Related entries ──────────────────────────────────────────────── */}
      {post.relatedPlaybooks && post.relatedPlaybooks.length > 0 && (
        <section className="border-t border-border section-padding" aria-labelledby="related-heading">
          <div className="container">
            <div className="mb-10">
              <p className="label-mono mb-3">Keep Learning</p>
              <h2 id="related-heading" className="display-md text-fg">
                Related Entries.
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(post.relatedPlaybooks as SanityPlaybook[]).map((related) => (
                <PlaybookCard key={related._id} item={related} />
              ))}
            </div>
          </div>
        </section>
      )}

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
            Want more content like this?
          </h2>
          <p className="text-bg/60 text-base leading-relaxed mb-10">
            Join the Fendo Collective for member-only guides, early access to new content,
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
