/**
 * Types for the /gear page, matching the allGearQuery / featuredGearQuery GROQ shape.
 * Manually typed to match the GROQ projection until `sanity typegen` is run.
 */

export interface SanityGear {
  _id: string
  name: string | null
  slug: string | null
  tagline: string | null
  category: string | null
  badge: string | null
  shortDescription: string | null
  features: string[] | null
  price: number | null
  shopUrl: string | null
  image: {
    asset?: {_ref: string; _type: string} | null
    alt?: string | null
    hotspot?: {x: number; y: number} | null
    crop?: {top: number; bottom: number; left: number; right: number} | null
  } | null
  isFeatured: boolean | null
  displayOrder: number | null
}
