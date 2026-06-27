export const SHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'] as const

export type ShirtSize = (typeof SHIRT_SIZES)[number]

export function isShirtSize(value: unknown): value is ShirtSize {
  return typeof value === 'string' && (SHIRT_SIZES as readonly string[]).includes(value)
}
