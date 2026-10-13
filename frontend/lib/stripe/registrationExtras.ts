import type Stripe from 'stripe'

/**
 * A charge on top of the entry fee — a priced add-on or a donation. Stored as a
 * snapshot on individual-pay captain slots (`metadata.extraCharges`) so a
 * retried payment charges exactly what the captain agreed to at registration.
 */
export interface ExtraCharge {
  name: string
  description?: string
  amountCents: number
}

interface PricedAddOn {
  _id: string
  name: string | null
  price?: number | null
}

/**
 * Selected priced add-ons (in event order), then the donation. An add-on counts
 * as selected when its value is `true` or a non-empty string, and is charged
 * only when its price is above zero.
 */
export function buildExtraCharges(
  eventAddOns: PricedAddOn[] | null | undefined,
  selectedAddOns: Record<string, string | boolean> | null | undefined,
  donationAmountCents: number,
): ExtraCharge[] {
  const selectedIds = Object.entries(selectedAddOns ?? {})
    .filter(([, v]) => v === true || (typeof v === 'string' && v.trim() !== ''))
    .map(([id]) => id)

  const charges: ExtraCharge[] = (eventAddOns ?? [])
    .filter((a) => selectedIds.includes(a._id) && (a.price ?? 0) > 0)
    .map((a) => ({ name: a.name ?? 'Add-on', amountCents: Math.round((a.price ?? 0) * 100) }))

  if (donationAmountCents > 0) {
    charges.push({
      name: 'Donation',
      description: 'Charitable donation to support the event',
      amountCents: donationAmountCents,
    })
  }
  return charges
}

export function extraChargesTotal(charges: ExtraCharge[]): number {
  return charges.reduce((sum, c) => sum + c.amountCents, 0)
}

export function extraChargeLineItems(
  charges: ExtraCharge[],
  currency: string,
): Stripe.Checkout.SessionCreateParams.LineItem[] {
  return charges.map((c) => ({
    price_data: {
      currency,
      unit_amount: c.amountCents,
      product_data: c.description ? { name: c.name, description: c.description } : { name: c.name },
    },
    quantity: 1,
  }))
}

/** Reads a stored `extraCharges` snapshot; null if absent or malformed. */
export function readExtraCharges(metadata: unknown): ExtraCharge[] | null {
  if (!metadata || typeof metadata !== 'object') return null
  const raw = (metadata as { extraCharges?: unknown }).extraCharges
  if (!Array.isArray(raw) || raw.length === 0) return null
  const valid = raw.every(
    (c) =>
      c &&
      typeof c === 'object' &&
      typeof (c as ExtraCharge).name === 'string' &&
      Number.isInteger((c as ExtraCharge).amountCents) &&
      (c as ExtraCharge).amountCents > 0,
  )
  return valid ? (raw as ExtraCharge[]) : null
}
