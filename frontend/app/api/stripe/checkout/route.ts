import type Stripe from 'stripe'
import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripe } from '@/lib/stripe/client'
import { getOrCreateStripeCustomer } from '@/lib/stripe/customer'
import { client } from '@/sanity/lib/client'
import { eventQuery } from '@/sanity/lib/queries'
import { sendEmail, getBaseUrl } from '@/lib/email/resend'
import { buildInviteEmail } from '@/lib/email/templates/invite'
import { format, parseISO } from 'date-fns'

// Generates a 6-character invite code, skipping visually ambiguous characters
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// Generates a cryptographically secure 64-char hex invite token
function generateInviteToken(): string {
  return randomBytes(32).toString('hex')
}

interface Invitee {
  firstName: string
  lastName: string
  email: string
  phone?: string
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
    const donationAmountCents = Math.max(0, Math.round(Number(body.donationAmount ?? 0) * 100))

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

    const formRegistrationType: string | undefined = registrationData?.registrationType
    const paymentMode: string | undefined = registrationData?.paymentMode
    const admin = createAdminClient()

    // ── INDIVIDUAL PAYMENT MODE (self-pay team) ──────────────────────────────
    // When the captain chooses "each player pays for themselves", we create
    // registration_slots for each player instead of a normal registration row.
    if (
      paymentMode === 'individual' &&
      (formRegistrationType === 'duo' || formRegistrationType === 'team')
    ) {
      const invitees: Invitee[] = Array.isArray(registrationData?.invitees)
        ? registrationData.invitees
        : []

      const maxMembers = formRegistrationType === 'duo' ? 2 : 4
      const expectedInvitees = maxMembers - 1 // captain fills 1 spot

      // Validate invitees
      if (invitees.length !== expectedInvitees) {
        return NextResponse.json(
          { error: `Expected ${expectedInvitees} invited player(s) for a ${formRegistrationType}` },
          { status: 400 },
        )
      }

      for (const inv of invitees) {
        if (!inv.firstName?.trim() || !inv.lastName?.trim() || !inv.email?.trim()) {
          return NextResponse.json(
            { error: 'Each invited player requires first name, last name, and email' },
            { status: 400 },
          )
        }
      }

      const teamName = (registrationData?.teamName as string | undefined)?.trim()
      if (!teamName) {
        return NextResponse.json({ error: 'Team name is required' }, { status: 400 })
      }

      // Capacity check: paid slots + active slots + team size must not exceed spotsTotal
      if (event.spotsTotal) {
        const { count: paidCount } = await admin
          .from('event_registrations')
          .select('*', { count: 'exact', head: true })
          .eq('event_sanity_id', event._id)
          .eq('status', 'paid')

        const { count: activeSlotCount } = await admin
          .from('registration_slots')
          .select('*', { count: 'exact', head: true })
          .eq('event_sanity_id', event._id)
          .not('status', 'in', '("expired","cancelled")')

        const used = (paidCount ?? 0) + (activeSlotCount ?? 0)
        if (used + maxMembers > event.spotsTotal) {
          return NextResponse.json(
            { error: 'Not enough spots available for your team size', eventFull: true },
            { status: 409 },
          )
        }
      }

      // Create the team with individual payment mode
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

      let teamData: { id: string; invite_code: string } | null = null
      for (let attempt = 0; attempt < 3; attempt++) {
        const code = generateInviteCode()
        const { data, error: teamErr } = await admin
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
            payment_mode: 'individual',
            team_status: 'pending',
            expires_at: expiresAt,
          })
          .select('id, invite_code')
          .single()

        if (!teamErr && data) {
          teamData = data
          break
        }
        if (teamErr?.code !== '23505') {
          console.error('[stripe/checkout/individual] Failed to create team:', teamErr)
          return NextResponse.json({ error: 'Failed to create team' }, { status: 500 })
        }
      }

      if (!teamData) {
        return NextResponse.json({ error: 'Failed to generate unique team code' }, { status: 500 })
      }

      const entryFeeInCents = event.entryFee ? Math.round(event.entryFee * 100) : 0

      // Get captain profile for name
      const { data: captainProfile } = await supabase
        .from('profiles')
        .select('full_name, display_name')
        .eq('id', user.id)
        .maybeSingle()
      const captainName = captainProfile?.full_name || captainProfile?.display_name || 'Captain'
      const captainFirstName = captainName.split(' ')[0]

      // Build all slots: captain first, then invitees
      const captainToken = generateInviteToken()
      const allSlots = [
        {
          team_id: teamData.id,
          event_sanity_id: event._id,
          event_slug: eventSlug,
          is_captain: true,
          player_first_name: captainName.split(' ')[0],
          player_last_name: captainName.split(' ').slice(1).join(' ') || '',
          player_email: user.email!,
          player_phone: null as string | null,
          app_user_id: user.id,
          invited_by_user_id: user.id,
          invite_token: captainToken,
          status: 'captain_pending' as const,
          amount_due: entryFeeInCents,
          currency: 'usd',
          expires_at: expiresAt,
        },
        ...invitees.map((inv) => ({
          team_id: teamData!.id,
          event_sanity_id: event._id,
          event_slug: eventSlug,
          is_captain: false,
          player_first_name: inv.firstName.trim(),
          player_last_name: inv.lastName.trim(),
          player_email: inv.email.trim().toLowerCase(),
          player_phone: inv.phone?.trim() || null as string | null,
          app_user_id: null as string | null,
          invited_by_user_id: user.id,
          invite_token: generateInviteToken(),
          status: 'invited' as const,
          amount_due: entryFeeInCents,
          currency: 'usd',
          expires_at: expiresAt,
        })),
      ]

      const { data: insertedSlots, error: slotsError } = await admin
        .from('registration_slots')
        .insert(allSlots)
        .select('id, is_captain, player_first_name, player_last_name, player_email, invite_token, status')

      if (slotsError || !insertedSlots) {
        console.error('[stripe/checkout/individual] Failed to create slots:', slotsError)
        // Roll back team
        await admin.from('teams').delete().eq('id', teamData.id)
        return NextResponse.json({ error: 'Failed to create player slots' }, { status: 500 })
      }

      const captainSlot = insertedSlots.find((s) => s.is_captain)
      if (!captainSlot) {
        return NextResponse.json({ error: 'Captain slot not found after insert' }, { status: 500 })
      }

      // Send invite emails to non-captain players (non-blocking)
      const baseUrl = getBaseUrl()
      const eventLocation = event.location
        ? [event.location.venueName, event.location.city, event.location.state].filter(Boolean).join(', ')
        : null
      const eventDateStr = event.startDate
        ? format(parseISO(event.startDate), 'EEEE, MMMM d, yyyy')
        : ''
      const expiresAtStr = format(new Date(expiresAt), 'MMMM d, yyyy')
      const teamType = formRegistrationType === 'duo' ? 'Duo' : 'Foursome'

      const invitedSlots = insertedSlots.filter((s) => !s.is_captain)

      Promise.all(
        invitedSlots.map((slot) =>
          sendEmail({
            to: slot.player_email,
            subject: `${captainFirstName} invited you to join their ${teamType.toLowerCase()} — ${event.title ?? ''}`,
            html: buildInviteEmail({
              playerFirstName: slot.player_first_name,
              captainName,
              eventTitle: event.title ?? eventSlug,
              eventDate: eventDateStr,
              eventLocation,
              teamType,
              amountDue: entryFeeInCents,
              expiresAt: expiresAtStr,
              inviteUrl: `${baseUrl}/compete/invite/${slot.invite_token}`,
            }),
          }).then(() =>
            admin
              .from('registration_slots')
              .update({ email_sent_at: new Date().toISOString() })
              .eq('id', slot.id),
          ),
        ),
      ).catch((err) => console.error('[stripe/checkout/individual] Email send error:', err))

      // If entry fee is $0, mark captain's slot paid immediately and skip Stripe
      if (entryFeeInCents === 0) {
        await admin
          .from('registration_slots')
          .update({ status: 'paid', paid_at: new Date().toISOString() })
          .eq('id', captainSlot.id)

        await supabase
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
            registration_type: formRegistrationType,
            team_name: teamName,
            team_id: teamData.id,
            metadata: { ...registrationData, isTeamCaptain: true, paymentMode: 'individual', inviteCode: teamData.invite_code },
          })

        return NextResponse.json({
          url: `${baseUrl}/compete/${eventSlug}/register-success?direct=1`,
          free: true,
        })
      }

      // Create Stripe Checkout Session for captain's own slot
      const customerId = await getOrCreateStripeCustomer(user.id, user.email!, captainName)

      const captainSession = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: 'usd',
              unit_amount: entryFeeInCents,
              product_data: {
                name: `${teamType} Entry — ${teamName}`,
                description: `Captain entry fee for ${event.title ?? eventSlug}`,
              },
            },
            quantity: 1,
          },
        ],
        success_url: `${baseUrl}/compete/${eventSlug}/register-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/compete/${eventSlug}`,
        metadata: {
          type: 'slot',
          registrationSlotId: captainSlot.id,
          teamId: teamData.id,
          userId: user.id,
          eventSanityId: event._id,
          eventSlug,
          eventTitle: event.title ?? '',
          eventDate: event.startDate ?? '',
          teamName,
          inviteCode: teamData.invite_code,
          paymentMode: 'individual',
        },
        payment_intent_data: {
          metadata: {
            type: 'slot',
            registrationSlotId: captainSlot.id,
            userId: user.id,
            eventSanityId: event._id,
            eventSlug,
          },
        },
      })

      // Update captain slot with session id
      await admin
        .from('registration_slots')
        .update({ stripe_checkout_session_id: captainSession.id, status: 'payment_started' })
        .eq('id', captainSlot.id)

      return NextResponse.json({
        url: captainSession.url,
        sessionId: captainSession.id,
        invitedCount: invitedSlots.length,
      })
    }

    // ── Check spots availability for standard flows ──────────────────────────
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

    // ── Standard team handling ───────────────────────────────────────────────
    let dbRegistrationType: string | null = formRegistrationType ?? null
    let teamId: string | null = null
    let inviteCode: string | null = null

    if (formRegistrationType === 'join') {
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

      const { count: memberCount } = await admin
        .from('event_registrations')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', team.id)
        .neq('status', 'cancelled')

      if (memberCount !== null && memberCount >= team.max_members) {
        return NextResponse.json({ error: 'This team is already full' }, { status: 409 })
      }

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
      registrationData = {
        ...registrationData,
        registrationType: team.registration_type,
        teamName: team.team_name,
        isJoiner: true,
      }
    } else if (formRegistrationType === 'duo' || formRegistrationType === 'team') {
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
            payment_mode: 'captain_pays_all',
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
      registrationData = { ...registrationData, inviteCode, isTeamCaptain: true }
    }

    // ── Volunteer: bypass Stripe regardless of event fee ────────────────────
    if (formRegistrationType === 'volunteer') {
      const { error: volunteerRegError } = await supabase
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
          registration_type: 'volunteer',
          team_name: null,
          team_id: null,
          metadata: registrationData ?? {},
        })

      if (volunteerRegError) {
        if (volunteerRegError.code === '23505') {
          return NextResponse.json(
            { error: 'Already registered', alreadyRegistered: true },
            { status: 409 },
          )
        }
        console.error('[stripe/checkout] Volunteer registration insert failed:', volunteerRegError)
        return NextResponse.json({ error: 'Failed to register' }, { status: 500 })
      }

      const baseUrl = getBaseUrl()

      return NextResponse.json({
        url: `${baseUrl}/compete/${eventSlug}/register-success?direct=1`,
        free: true,
      })
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

      const baseUrl = getBaseUrl()

      return NextResponse.json({
        url: `${baseUrl}/compete/${eventSlug}/register-success?direct=1`,
        free: true,
      })
    }

    // ── Standard Stripe Checkout ─────────────────────────────────────────────
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, display_name')
      .eq('id', user.id)
      .maybeSingle()

    const customerName = profile?.full_name || profile?.display_name || undefined
    const customerId = await getOrCreateStripeCustomer(user.id, user.email!, customerName)

    const baseUrl = getBaseUrl()
    const entryFeeInCents = event.entryFee ? Math.round(event.entryFee * 100) : 0
    const eventTitle = event.title ?? ''

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
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
    ]

    const selectedAddOnIds = Object.entries(
      (registrationData?.selectedAddOns as Record<string, string | boolean> | undefined) ?? {},
    )
      .filter(([, v]) => v === true || (typeof v === 'string' && (v as string).trim() !== ''))
      .map(([id]) => id)

    const pricedAddOns = ((event.addOns ?? []) as Array<{ _id: string; name: string; price?: number }>).filter(
      (a) => selectedAddOnIds.includes(a._id) && (a.price ?? 0) > 0,
    )

    for (const addOn of pricedAddOns) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          unit_amount: Math.round((addOn.price ?? 0) * 100),
          product_data: { name: addOn.name },
        },
        quantity: 1,
      })
    }

    if (donationAmountCents > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          unit_amount: donationAmountCents,
          product_data: { name: 'Donation', description: 'Charitable donation to support the event' },
        },
        quantity: 1,
      })
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: lineItems,
      success_url: `${baseUrl}/compete/${eventSlug}/register-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/compete/${eventSlug}`,
      metadata: {
        userId: user.id,
        eventSanityId: event._id,
        eventSlug,
        eventTitle,
        eventDate: event.startDate ?? '',
        donationAmount: donationAmountCents > 0 ? String(donationAmountCents / 100) : '',
      },
      payment_intent_data: {
        metadata: {
          userId: user.id,
          eventSanityId: event._id,
          eventSlug,
        },
      },
    })

    const pendingMetadata = donationAmountCents > 0
      ? { ...(registrationData ?? {}), donationAmount: donationAmountCents / 100 }
      : (registrationData ?? {})

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
        metadata: pendingMetadata,
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
