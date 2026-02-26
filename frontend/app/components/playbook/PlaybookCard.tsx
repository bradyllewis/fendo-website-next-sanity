import Link from 'next/link'
import {format, parseISO} from 'date-fns'

import SanityImage from '@/app/components/SanityImage'
import {IconVideo, IconClock} from '@/app/components/icons'
import type {SanityPlaybook} from '@/app/playbook/types'
import {CONTENT_TYPE_LABELS, CATEGORY_LABELS, DIFFICULTY_LABELS} from '@/app/playbook/types'

// ── Helpers ────────────────────────────────────────────────────────────────────

function contentTypeBadgeClass(type: string | null): string {
  switch (type) {
    case 'video':    return 'bg-accent text-bg'
    case 'guide':    return 'bg-green text-bg'
    case 'drill':    return 'bg-mustard text-fg'
    case 'tutorial': return 'bg-navy text-bg'
    default:         return 'bg-fg text-bg' // article + fallback
  }
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function PlaybookCard({item}: {item: SanityPlaybook}) {
  const href = `/playbook/${item.slug}`
  const authorName =
    item.author?.firstName && item.author?.lastName
      ? `${item.author.firstName} ${item.author.lastName}`
      : null
  const dateLabel = item.publishedAt
    ? format(parseISO(item.publishedAt), 'MMM d, yyyy')
    : null
  const typeLabel = item.contentType ? (CONTENT_TYPE_LABELS[item.contentType] ?? item.contentType) : null
  const categoryLabel = item.category ? (CATEGORY_LABELS[item.category] ?? item.category) : null
  const difficultyLabel = item.difficulty ? (DIFFICULTY_LABELS[item.difficulty] ?? item.difficulty) : null

  return (
    <article className="card-base overflow-hidden flex flex-col group">
      {/* Cover image */}
      <Link href={href} className="block relative aspect-[16/9] overflow-hidden bg-fg shrink-0">
        {item.coverImage?.asset ? (
          <div className="absolute inset-0 overflow-hidden group-hover:scale-[1.02] transition-transform duration-300">
            <SanityImage
              id={item.coverImage.asset._ref}
              alt={item.coverImage.alt ?? item.title ?? 'Playbook cover'}
              hotspot={item.coverImage.hotspot ?? undefined}
              crop={item.coverImage.crop ?? undefined}
              mode="cover"
              width={640}
              height={360}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="absolute inset-0 bg-fg/80 flex items-center justify-center">
            <span className="text-bg/20">
              <IconVideo className="w-12 h-12" />
            </span>
          </div>
        )}

        {/* Content type badge */}
        {typeLabel && (
          <div className="absolute top-3 left-3">
            <span className={`label-mono text-xs px-2.5 py-1 rounded-full ${contentTypeBadgeClass(item.contentType)}`}>
              {typeLabel}
            </span>
          </div>
        )}

        {/* Premium badge */}
        {item.isPremium && (
          <div className="absolute top-3 right-3">
            <span className="label-mono text-xs px-2.5 py-1 rounded-full bg-mustard text-fg">
              Members
            </span>
          </div>
        )}
      </Link>

      {/* Content */}
      <div className="p-6 flex flex-col flex-1">
        {/* Category + Difficulty row */}
        {(categoryLabel || difficultyLabel) && (
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {categoryLabel && (
              <span className="label-mono text-xs">{categoryLabel}</span>
            )}
            {categoryLabel && difficultyLabel && (
              <span className="text-border" aria-hidden="true">·</span>
            )}
            {difficultyLabel && difficultyLabel !== 'All Levels' && (
              <span className="label-mono text-xs text-muted">{difficultyLabel}</span>
            )}
          </div>
        )}

        {/* Title */}
        <h2 className="text-base font-semibold tracking-tight text-fg mb-2 leading-snug">
          <Link href={href} className="hover:text-accent transition-colors duration-160">
            {item.title}
          </Link>
        </h2>

        {/* Excerpt */}
        {item.excerpt && (
          <p className="text-sm text-muted leading-relaxed mb-4 flex-1 line-clamp-3">
            {item.excerpt}
          </p>
        )}

        {/* Footer: author + date */}
        <div className="flex items-center justify-between gap-3 pt-4 border-t border-border mt-auto">
          <div className="flex items-center gap-2 min-w-0">
            {item.author?.picture?.asset && (
              <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 bg-fg/10">
                <SanityImage
                  id={item.author.picture.asset._ref}
                  alt={authorName ?? 'Author'}
                  mode="cover"
                  width={24}
                  height={24}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            {authorName && (
              <span className="text-xs font-medium text-muted truncate">{authorName}</span>
            )}
          </div>
          {dateLabel && (
            <div className="flex items-center gap-1 text-xs text-muted shrink-0">
              <IconClock className="w-3 h-3" />
              <span className="font-mono">{dateLabel}</span>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
