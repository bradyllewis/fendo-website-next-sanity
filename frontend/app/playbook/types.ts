/**
 * Types for the /playbook pages, matching the playbook GROQ query shapes.
 * Manually typed to match the GROQ projection until `sanity typegen` is run.
 */

export type PlaybookContentType = 'article' | 'video' | 'guide' | 'drill' | 'tutorial'

export type PlaybookCategory =
  | 'short-game'
  | 'putting'
  | 'chipping'
  | 'bunker-play'
  | 'full-swing'
  | 'course-management'
  | 'mental-game'
  | 'fitness'
  | 'equipment'
  | 'rules'
  | 'general'

export type PlaybookDifficulty = 'all-levels' | 'beginner' | 'intermediate' | 'advanced'

export interface SanityPlaybook {
  _id: string
  title: string | null
  slug: string | null
  contentType: PlaybookContentType | string | null
  category: PlaybookCategory | string | null
  difficulty: PlaybookDifficulty | string | null
  tags: string[] | null
  coverImage: {
    asset?: {_ref: string; _type: string} | null
    alt?: string | null
    hotspot?: {x: number; y: number} | null
    crop?: {top: number; bottom: number; left: number; right: number} | null
  } | null
  excerpt: string | null
  publishedAt: string | null
  author: {
    firstName: string | null
    lastName: string | null
    picture?: {
      asset?: {_ref: string; _type: string} | null
      alt?: string | null
    } | null
  } | null
  isFeatured: boolean | null
  isPremium: boolean | null
  displayOrder: number | null
}

/** Extended type for the detail page — includes body, video, attachments, related. */
export interface SanityPlaybookFull extends SanityPlaybook {
  body: unknown[] | null
  contributors: Array<{
    firstName: string | null
    lastName: string | null
    picture?: {
      asset?: {_ref: string; _type: string} | null
      alt?: string | null
    } | null
  }> | null
  video: {
    platform: 'youtube' | 'vimeo' | 'uploaded' | string | null
    embedId: string | null
    url: string | null
    fileUrl: string | null
    duration: string | null
  } | null
  attachments: Array<{
    _key: string
    title: string | null
    description: string | null
    fileType: string | null
    fileUrl: string | null
  }> | null
  relatedPlaybooks: SanityPlaybook[] | null
}

// ── Helpers ────────────────────────────────────────────────────────────────────

export const CONTENT_TYPE_LABELS: Record<string, string> = {
  article: 'Article',
  video: 'Video',
  guide: 'Guide',
  drill: 'Drill',
  tutorial: 'Tutorial',
}

export const CATEGORY_LABELS: Record<string, string> = {
  'short-game': 'Short Game',
  'putting': 'Putting',
  'chipping': 'Chipping & Pitching',
  'bunker-play': 'Bunker Play',
  'full-swing': 'Full Swing',
  'course-management': 'Course Management',
  'mental-game': 'Mental Game',
  'fitness': 'Fitness',
  'equipment': 'Equipment',
  'rules': 'Rules',
  'general': 'General Golf',
}

export const DIFFICULTY_LABELS: Record<string, string> = {
  'all-levels': 'All Levels',
  'beginner': 'Beginner',
  'intermediate': 'Intermediate',
  'advanced': 'Advanced',
}
