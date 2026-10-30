import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripe } from '@/lib/stripe/client'
import { getOrCreateStripeCustomer } from '@/lib/stripe/customer'
import { client } from '@/sanity/lib/client'
import { eventQuery } from '@/sanity/lib/queries'
import { sendEmail, getBaseUrl } from '@/lib/email/resend'
import { buildSponsorConfirmationEmail } from '@/lib/email/templates/sponsor-confirmation'
import { formatEventDateLong } from '@/lib/eventDates'

/** Keeps only the fields the form collects, up to the spots the tier includes. */
function readPlayerAllocation(raw: unknown, spots: number): { name: string; email: string }[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((p: { name?: unknown; email?: unknown } | null) => ({
      name: typeof p?.name === 'string' ? p.name.trim().slice(0, 200) : '',
      email: typeof p?.email === 'string' ? p.email.trim().slice(0, 200) : '',
    }))
    .filter((p) => p.name || p.email)
    .slice(0, spots)
}

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
        tierId: string
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

    if (event.status === 'completed' || event.status === 'cancelled') {
      return NextResponse.json({ error: 'Event is no longer open for sponsorship' }, { status: 400 })
    }

    // The level, price and player spots always come from Sanity, never the request.
    const tier = event.sponsorshipTiers?.find((t) => t.id === sponsorData.tierId)
    if (!tier?.name || tier.price == null) {
      return NextResponse.json(
        { error: 'That sponsorship level is no longer available. Reload the page and choose again.' },
        { status: 400 },
      )
    }

    const amountInCents = Math.round(tier.price * 100)
    const playerAllocation = readPlayerAllocation(
      sponsorData.playerAllocation,
      tier.includedPlayerSpots ?? 0,
    )
    const metadata = playerAllocation.length > 0 ? { playerAllocation } : {}

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
          sponsorship_level: tier.name,
          sponsorship_level_price: amountInCents,
          payment_method: 'invoice',
          status: 'invoiced',
          logo_url: sponsorData.logoUrl ?? null,
          activation_notes: sponsorData.activationNotes ?? null,
          marketing_requests: sponsorData.marketingRequests ?? null,
          metadata,
        })

      if (insertError) {
        console.error('[sponsor-checkout] Invoice insert failed:', insertError)
        return NextResponse.json({ error: 'Failed to create sponsorship record' }, { status: 500 })
      }

      // Send invoice-received confirmation to sponsor
      const siteUrl = getBaseUrl()
      const eventDateStr = event.startDate ? formatEventDateLong(event.startDate, event.timezone) : ''
      await sendEmail({
        to: sponsorData.email,
        subject: `Sponsorship request received — ${event.title}`,
        html: buildSponsorConfirmationEmail({
          contactName: sponsorData.primaryContact,
          companyName: sponsorData.companyName,
          sponsorshipLevel: tier.name,
          eventTitle: event.title,
          eventDate: eventDateStr,
          eventLocation: null,
          amountPaid: null,
          paymentMethod: 'invoice',
          siteUrl,
        }),
      }).catch((err) => console.error('[sponsor-checkout] Invoice confirmation email error:', err))

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
              name: `${event.title} — ${tier.name} Sponsorship`,
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
        eventTimezone: event.timezone ?? '',
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
        sponsorship_level: tier.name,
        sponsorship_level_price: amountInCents,
        payment_method: 'stripe',
        stripe_checkout_session_id: session.id,
        status: 'pending',
        logo_url: sponsorData.logoUrl ?? null,
        activation_notes: sponsorData.activationNotes ?? null,
        marketing_requests: sponsorData.marketingRequests ?? null,
        metadata,
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
