import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripe } from '@/lib/stripe/client'
import { getOrCreateStripeCustomer } from '@/lib/stripe/customer'
import { client } from '@/sanity/lib/client'
import { eventQuery } from '@/sanity/lib/queries'

// Generates a 6-character invite code, skipping visually ambiguous characters
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
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
    const eventSlug: string = body.eventSlug
    let registrationData = body.registrationData

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

    // ── Team handling ────────────────────────────────────────────────────────
    // Resolve team context before inserting any registration row.
    // dbRegistrationType: what to store in the registration_type column.
    // teamId / inviteCode: populated for team/duo registrations and joiners.

    const formRegistrationType: string | undefined = registrationData?.registrationType
    let dbRegistrationType: string | null = formRegistrationType ?? null
    let teamId: string | null = null
    let inviteCode: string | null = null
    const admin = createAdminClient()

    if (formRegistrationType === 'join') {
      // Joiner: validate invite code server-side
      const joinCode = (registrationData?.joinTeamCode as string | undefined)?.toUpperCase().trim()
      if (!joinCode) {
        return NextResponse.json({ error: 'Missing team invite code' }, { status: 400 })
      }

      const { data: team } = await admin
        .from('teams')
        .select('id, team_name, registration_type, max_members, created_by')
        .eq('invite_code', joinCode)
        .eq('event_sanity_id', event._id)
        .maybeSingle()

      if (!team) {
        return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 })
      }

      // Ensure captain has paid
      const { data: captainReg } = await admin
        .from('event_registrations')
        .select('id')
        .eq('team_id', team.id)
        .eq('user_id', team.created_by)
        .eq('status', 'paid')
        .maybeSingle()

      if (!captainReg) {
        return NextResponse.json(
          { error: 'This team is not yet confirmed. Ask your captain to complete payment first.' },
          { status: 400 },
        )
      }

      // Enforce capacity
      const { count: memberCount } = await admin
        .from('event_registrations')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', team.id)
        .neq('status', 'cancelled')

      if (memberCount !== null && memberCount >= team.max_members) {
        return NextResponse.json({ error: 'This team is already full' }, { status: 409 })
      }

      // Ensure user isn't already on this team
      const { data: existingMembership } = await admin
        .from('event_registrations')
        .select('id')
        .eq('team_id', team.id)
        .eq('user_id', user.id)
        .maybeSingle()

      if (existingMembership) {
        return NextResponse.json(
          { error: 'Already a member of this team', alreadyRegistered: true },
          { status: 409 },
        )
      }

      teamId = team.id
      dbRegistrationType = team.registration_type
      // Merge team info into registrationData for metadata storage
      registrationData = {
        ...registrationData,
        registrationType: team.registration_type,
        teamName: team.team_name,
        isJoiner: true,
      }
    } else if (formRegistrationType === 'duo' || formRegistrationType === 'team') {
      // Captain creating a new team
      const maxMembers = formRegistrationType === 'duo' ? 2 : 4
      const teamName = (registrationData?.teamName as string | undefined)?.trim()

      if (!teamName) {
        return NextResponse.json({ error: 'Team name is required' }, { status: 400 })
      }

      let teamData: { id: string; invite_code: string } | null = null
      for (let attempt = 0; attempt < 3; attempt++) {
        const code = generateInviteCode()
        const { data, error } = await admin
          .from('teams')
          .insert({
            event_sanity_id: event._id,
            event_slug: eventSlug,
            team_name: teamName,
            invite_code: code,
            created_by: user.id,
            registration_type: formRegistrationType,
            max_members: maxMembers,
            walk_up_song: (registrationData?.walkUpSong as string | undefined) || null,
          })
          .select('id, invite_code')
          .single()

        if (!error && data) {
          teamData = data
          break
        }
        if (error?.code !== '23505') {
          console.error('[stripe/checkout] Failed to create team:', error)
          return NextResponse.json({ error: 'Failed to create team' }, { status: 500 })
        }
      }

      if (!teamData) {
        return NextResponse.json({ error: 'Failed to generate unique team code' }, { status: 500 })
      }

      teamId = teamData.id
      inviteCode = teamData.invite_code
      // Store invite code in metadata so the success page can display it
      registrationData = { ...registrationData, inviteCode, isTeamCaptain: true }
    }

    // ── Free event: bypass Stripe entirely ──────────────────────────────────
    if (!event.entryFee || event.entryFee === 0) {
      const { error: freeRegError } = await supabase
        .from('event_registrations')
        .insert({
          user_id: user.id,
          event_sanity_id: event._id,
          event_slug: eventSlug,
          event_title: event.title ?? '',
          event_date: event.startDate ?? null,
          stripe_checkout_session_id: null,
          stripe_payment_intent_id: null,
          amount_paid: 0,
          currency: 'usd',
          status: 'paid',
          registration_type: dbRegistrationType,
          team_name: (registrationData?.teamName as string | undefined) ?? null,
          team_id: teamId,
          metadata: registrationData ?? {},
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
    const eventTitle = event.title ?? ''
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
              name: eventTitle,
              description: event.shortDescription ?? `Registration for ${eventTitle}`,
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
        eventTitle,
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
        event_title: event.title ?? '',
        event_date: event.startDate ?? null,
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: null,
        amount_paid: 0,
        currency: 'usd',
        status: 'pending',
        registration_type: dbRegistrationType,
        team_name: (registrationData?.teamName as string | undefined) ?? null,
        team_id: teamId,
        metadata: registrationData ?? {},
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
