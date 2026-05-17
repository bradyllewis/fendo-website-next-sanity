import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripe } from '@/lib/stripe/client'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const token: string | undefined = body.token

    if (!token || token.length < 20) {
      return NextResponse.json({ error: 'Invalid invite token' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Load the slot
    const { data: slot, error: slotError } = await admin
      .from('registration_slots')
      .select('id, team_id, event_sanity_id, event_slug, status, amount_due, currency, expires_at, player_email, player_first_name, player_last_name, stripe_checkout_session_id')
      .eq('invite_token', token)
      .maybeSingle()

    if (slotError) {
      console.error('[slot-checkout] DB error:', slotError)
      return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }

    if (!slot) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    }

    // Guard: slot must be in a payable state
    if (slot.status === 'paid' || slot.status === 'claimed') {
      return NextResponse.json({ error: 'This spot is already paid' }, { status: 409 })
    }
    if (slot.status === 'expired' || slot.status === 'cancelled') {
      return NextResponse.json({ error: 'This invite has expired or been cancelled' }, { status: 410 })
    }

    // Guard: check invite has not passed its app-level expiry
    if (new Date(slot.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This invite has expired' }, { status: 410 })
    }

    // Guard: verify the parent team is not cancelled
    const { data: team } = await admin
      .from('teams')
      .select('team_status, team_name, registration_type')
      .eq('id', slot.team_id)
      .maybeSingle()

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }
    if (team.team_status === 'cancelled' || team.team_status === 'expired') {
      return NextResponse.json({ error: 'This team registration is no longer active' }, { status: 410 })
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

    const teamType = team.registration_type === 'duo' ? 'Duo' : 'Foursome'
    const playerName = `${slot.player_first_name} ${slot.player_last_name}`

    // Create Stripe Checkout Session (30-minute expiry)
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30 minutes
      customer_email: slot.player_email,
      line_items: [
        {
          price_data: {
            currency: slot.currency,
            unit_amount: slot.amount_due,
            product_data: {
              name: `${teamType} Entry — ${team.team_name}`,
              description: `Tournament entry fee for ${playerName}`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/compete/invite/${token}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/compete/invite/${token}?payment=cancelled`,
      metadata: {
        type: 'slot',
        registrationSlotId: slot.id,
        teamId: slot.team_id,
        eventSanityId: slot.event_sanity_id,
        eventSlug: slot.event_slug,
        inviteToken: token,
      },
    })

    // Update slot to payment_started
    const { error: updateError } = await admin
      .from('registration_slots')
      .update({
        status: 'payment_started',
        stripe_checkout_session_id: session.id,
      })
      .eq('id', slot.id)
      .in('status', ['invited', 'payment_started'])

    if (updateError) {
      console.error('[slot-checkout] Failed to update slot status:', updateError)
      // Non-fatal — Stripe session still valid
    }

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('[slot-checkout] Error:', error)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
