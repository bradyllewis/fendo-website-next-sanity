import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/client'
import { createAdminClient } from '@/lib/supabase/admin'
import type Stripe from 'stripe'

// Stripe requires the raw request body for signature verification
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    )
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 })
  }

  const supabase = createAdminClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        if (session.payment_status !== 'paid') break

        const { userId, eventSanityId, eventSlug, eventTitle, eventDate } =
          session.metadata as Record<string, string>

        // Idempotency: skip if already paid
        const { data: existing } = await supabase
          .from('event_registrations')
          .select('id, status')
          .eq('stripe_checkout_session_id', session.id)
          .maybeSingle()

        if (existing?.status === 'paid') {
          console.log(`[webhook] Session ${session.id} already paid — skipping`)
          break
        }

        // Try to UPDATE the pending row created at checkout time
        const { data: updatedRows, error: updateError } = await supabase
          .from('event_registrations')
          .update({
            status: 'paid',
            stripe_payment_intent_id: (session.payment_intent as string) ?? null,
            amount_paid: session.amount_total,
            currency: session.currency ?? 'usd',
          })
          .eq('stripe_checkout_session_id', session.id)
          .eq('status', 'pending')
          .select('id')
        const updatedCount = updatedRows?.length ?? 0

        if (updateError) {
          console.error('[webhook] Failed to update pending registration:', updateError)
          return NextResponse.json({ error: 'Failed to update registration' }, { status: 500 })
        }

        // Defensive fallback: INSERT if no pending row existed
        if ((updatedCount ?? 0) === 0) {
          console.warn(`[webhook] No pending row found for session ${session.id} — inserting directly`)
          const { error: insertError } = await supabase
            .from('event_registrations')
            .insert({
              user_id: userId,
              event_sanity_id: eventSanityId,
              event_slug: eventSlug,
              event_title: eventTitle,
              event_date: eventDate || null,
              stripe_checkout_session_id: session.id,
              stripe_payment_intent_id: (session.payment_intent as string) ?? null,
              amount_paid: session.amount_total,
              currency: session.currency ?? 'usd',
              status: 'paid',
            })

          if (insertError) {
            console.error('[webhook] Failed to insert registration:', insertError)
            return NextResponse.json({ error: 'Failed to create registration' }, { status: 500 })
          }
        }

        console.log(`[webhook] Confirmed paid registration for user ${userId} / event ${eventSlug}`)
        break
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session

        await supabase
          .from('event_registrations')
          .update({ status: 'cancelled' })
          .eq('stripe_checkout_session_id', session.id)
          .eq('status', 'pending')

        break
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge

        if (charge.payment_intent) {
          await supabase
            .from('event_registrations')
            .update({ status: 'refunded' })
            .eq('stripe_payment_intent_id', charge.payment_intent as string)
        }

        break
      }

      default:
        break
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[webhook] Handler error:', error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
