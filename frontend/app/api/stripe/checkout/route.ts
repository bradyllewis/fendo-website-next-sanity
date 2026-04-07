import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/client'
import { getOrCreateStripeCustomer } from '@/lib/stripe/customer'
import { client } from '@/sanity/lib/client'
import { eventQuery } from '@/sanity/lib/queries'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { eventSlug } = await request.json()

    if (!eventSlug) {
      return NextResponse.json({ error: 'Missing eventSlug' }, { status: 400 })
    }

    // Fetch event from Sanity (bypass CDN for fresh data)
    const event = await client
      .withConfig({ useCdn: false })
      .fetch(eventQuery, { slug: eventSlug })

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    if (!event.requiresRegistration) {
      return NextResponse.json(
        { error: 'Event does not use in-app registration' },
        { status: 400 },
      )
    }

    if (event.status === 'completed' || event.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Event is no longer open for registration' },
        { status: 400 },
      )
    }

    // Check if user already has a paid registration
    const { data: existingReg } = await supabase
      .from('event_registrations')
      .select('id, status')
      .eq('event_sanity_id', event._id)
      .eq('user_id', user.id)
      .eq('status', 'paid')
      .maybeSingle()

    if (existingReg) {
      return NextResponse.json(
        { error: 'Already registered', alreadyRegistered: true },
        { status: 409 },
      )
    }

    // Check spots availability (only if spotsTotal is set)
    if (event.spotsTotal) {
      const { count: paidCount } = await supabase
        .from('event_registrations')
        .select('*', { count: 'exact', head: true })
        .eq('event_sanity_id', event._id)
        .eq('status', 'paid')

      if (paidCount !== null && paidCount >= event.spotsTotal) {
        return NextResponse.json(
          { error: 'Event is full', eventFull: true },
          { status: 409 },
        )
      }
    }

    // ── Free event: bypass Stripe entirely ──────────────────────────────────
    if (!event.entryFee || event.entryFee === 0) {
      const { error: freeRegError } = await supabase
        .from('event_registrations')
        .insert({
          user_id: user.id,
          event_sanity_id: event._id,
          event_slug: eventSlug,
          event_title: event.title,
          event_date: event.startDate ?? null,
          stripe_checkout_session_id: null,
          stripe_payment_intent_id: null,
          amount_paid: 0,
          currency: 'usd',
          status: 'paid',
        })

      if (freeRegError) {
        if (freeRegError.code === '23505') {
          return NextResponse.json(
            { error: 'Already registered', alreadyRegistered: true },
            { status: 409 },
          )
        }
        console.error('[stripe/checkout] Free registration insert failed:', freeRegError)
        return NextResponse.json({ error: 'Failed to register' }, { status: 500 })
      }

      const baseUrl =
        process.env.NEXT_PUBLIC_SITE_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

      return NextResponse.json({
        url: `${baseUrl}/compete/${eventSlug}/register-success?direct=1`,
        free: true,
      })
    }

    // Get profile for display name
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, display_name')
      .eq('id', user.id)
      .maybeSingle()

    const customerName = profile?.full_name || profile?.display_name || undefined

    // Get or create Stripe Customer
    const customerId = await getOrCreateStripeCustomer(user.id, user.email!, customerName)

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

    const entryFeeInCents = event.entryFee ? Math.round(event.entryFee * 100) : 0

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: entryFeeInCents,
            product_data: {
              name: event.title,
              description: event.shortDescription ?? `Registration for ${event.title}`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/compete/${eventSlug}/register-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/compete/${eventSlug}`,
      metadata: {
        userId: user.id,
        eventSanityId: event._id,
        eventSlug,
        eventTitle: event.title,
        eventDate: event.startDate ?? '',
      },
      payment_intent_data: {
        metadata: {
          userId: user.id,
          eventSanityId: event._id,
          eventSlug,
        },
      },
    })

    // Create a pending registration row so the expired handler and webhook update-path work correctly.
    // This is non-fatal — the webhook's defensive INSERT fallback handles missing pending rows.
    const { error: pendingError } = await supabase
      .from('event_registrations')
      .insert({
        user_id: user.id,
        event_sanity_id: event._id,
        event_slug: eventSlug,
        event_title: event.title,
        event_date: event.startDate ?? null,
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: null,
        amount_paid: 0,
        currency: 'usd',
        status: 'pending',
      })

    if (pendingError) {
      console.error('[stripe/checkout] Failed to create pending registration row:', pendingError)
    }

    return NextResponse.json({ url: session.url, sessionId: session.id })
  } catch (error) {
    console.error('[stripe/checkout] Error:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 },
    )
  }
}
