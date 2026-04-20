import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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

    const body = await request.json()
    const { eventSlug, sponsorData } = body as {
      eventSlug: string
      sponsorData: {
        companyName: string
        primaryContact: string
        email: string
        phone?: string
        sponsorshipLevel: string
        sponsorshipLevelPrice: number
        paymentMethod: 'stripe' | 'invoice'
        activationNotes?: string
        marketingRequests?: string
        logoUrl?: string
        playerAllocation?: unknown
      }
    }

    if (!eventSlug || !sponsorData) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const event = await client
      .withConfig({ useCdn: false })
      .fetch(eventQuery, { slug: eventSlug })

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    if (!event.sponsorshipsEnabled) {
      return NextResponse.json({ error: 'Sponsorships are not enabled for this event' }, { status: 400 })
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

    const adminDb = createAdminClient()

    // ── Invoice / pay-later path ───────────────────────────────────────────────
    if (sponsorData.paymentMethod === 'invoice') {
      const { error: insertError } = await adminDb
        .from('sponsor_registrations')
        .insert({
          user_id: user.id,
          event_sanity_id: event._id,
          event_slug: eventSlug,
          event_title: event.title,
          event_date: event.startDate ?? null,
          company_name: sponsorData.companyName,
          primary_contact: sponsorData.primaryContact,
          email: sponsorData.email,
          phone: sponsorData.phone ?? null,
          sponsorship_level: sponsorData.sponsorshipLevel,
          sponsorship_level_price: sponsorData.sponsorshipLevelPrice
            ? Math.round(sponsorData.sponsorshipLevelPrice * 100)
            : null,
          payment_method: 'invoice',
          status: 'invoiced',
          logo_url: sponsorData.logoUrl ?? null,
          activation_notes: sponsorData.activationNotes ?? null,
          marketing_requests: sponsorData.marketingRequests ?? null,
          metadata: sponsorData.playerAllocation ? { playerAllocation: sponsorData.playerAllocation } : {},
        })

      if (insertError) {
        console.error('[sponsor-checkout] Invoice insert failed:', insertError)
        return NextResponse.json({ error: 'Failed to create sponsorship record' }, { status: 500 })
      }

      return NextResponse.json({
        url: `${baseUrl}/compete/${eventSlug}/sponsor-success?invoice=1`,
        invoice: true,
      })
    }

    // ── Stripe / pay-now path ──────────────────────────────────────────────────
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, display_name')
      .eq('id', user.id)
      .maybeSingle()

    const customerName = profile?.full_name || profile?.display_name || sponsorData.primaryContact
    const customerId = await getOrCreateStripeCustomer(user.id, user.email!, customerName)

    const amountInCents = Math.round(sponsorData.sponsorshipLevelPrice * 100)

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card', 'us_bank_account'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: amountInCents,
            product_data: {
              name: `${event.title} — ${sponsorData.sponsorshipLevel} Sponsorship`,
              description: `Sponsorship registration for ${event.title}`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/compete/${eventSlug}/sponsor-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/compete/${eventSlug}/sponsor`,
      metadata: {
        type: 'sponsor',
        userId: user.id,
        eventSanityId: event._id,
        eventSlug,
        eventTitle: event.title,
        eventDate: event.startDate ?? '',
      },
      payment_intent_data: {
        metadata: {
          type: 'sponsor',
          userId: user.id,
          eventSanityId: event._id,
          eventSlug,
        },
      },
    })

    // Create pending sponsor registration row
    const { error: pendingError } = await adminDb
      .from('sponsor_registrations')
      .insert({
        user_id: user.id,
        event_sanity_id: event._id,
        event_slug: eventSlug,
        event_title: event.title,
        event_date: event.startDate ?? null,
        company_name: sponsorData.companyName,
        primary_contact: sponsorData.primaryContact,
        email: sponsorData.email,
        phone: sponsorData.phone ?? null,
        sponsorship_level: sponsorData.sponsorshipLevel,
        sponsorship_level_price: amountInCents,
        payment_method: 'stripe',
        stripe_checkout_session_id: session.id,
        status: 'pending',
        logo_url: sponsorData.logoUrl ?? null,
        activation_notes: sponsorData.activationNotes ?? null,
        marketing_requests: sponsorData.marketingRequests ?? null,
        metadata: sponsorData.playerAllocation ? { playerAllocation: sponsorData.playerAllocation } : {},
      })

    if (pendingError) {
      console.error('[sponsor-checkout] Failed to create pending sponsor row:', pendingError)
    }

    return NextResponse.json({ url: session.url, sessionId: session.id })
  } catch (error) {
    console.error('[sponsor-checkout] Error:', error)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
