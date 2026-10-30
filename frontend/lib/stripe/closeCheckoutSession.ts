import { stripe } from '@/lib/stripe/client'

/**
 * Makes sure a Checkout Session can no longer be paid, so a registration can be
 * cancelled without a late payment bringing it back.
 *
 * Fails when the session already completed or Stripe can't be reached. Callers
 * must then leave the registration untouched.
 */
export async function closeCheckoutSession(
  sessionId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    if (session.status === 'expired') return { ok: true }
    if (session.status === 'complete') return { ok: false, error: 'their payment already went through' }
    await stripe.checkout.sessions.expire(sessionId)
    return { ok: true }
  } catch (err: unknown) {
    const e = err as { message?: string }
    return { ok: false, error: e.message ?? 'Unknown Stripe error' }
  }
}
