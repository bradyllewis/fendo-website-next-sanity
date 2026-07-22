import { stripe } from '@/lib/stripe/client'

/**
 * Issue a full Stripe refund for a payment intent.
 *
 * Idempotent: a `charge_already_refunded` error is treated as success so
 * repeated cancellation attempts don't surface spurious failures. This mirrors
 * the inline refund handling in `/api/admin/delete-tournament`.
 */
export async function refundPaymentIntent(
  paymentIntentId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await stripe.refunds.create({ payment_intent: paymentIntentId })
    return { ok: true }
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string }
    if (e.code === 'charge_already_refunded') return { ok: true }
    return { ok: false, error: e.message ?? 'Unknown refund error' }
  }
}
