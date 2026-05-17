import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { client } from '@/sanity/lib/client'
import { eventQuery } from '@/sanity/lib/queries'

type Params = { params: Promise<{ token: string }> }

type EventSnippet = {
  title?: string | null
  startDate?: string | null
  location?: { venueName?: string | null; city?: string | null; state?: string | null } | null
}

export async function GET(_request: NextRequest, { params }: Params) {
  const { token } = await params

  if (!token || token.length < 20) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: slot, error } = await admin
    .from('registration_slots')
    .select(`
      id,
      team_id,
      event_sanity_id,
      event_slug,
      is_captain,
      player_first_name,
      player_last_name,
      player_email,
      status,
      amount_due,
      currency,
      expires_at,
      paid_at,
      invited_by_user_id,
      metadata
    `)
    .eq('invite_token', token)
    .maybeSingle()

  if (error) {
    console.error('[registration-slots/token] DB error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }

  if (!slot) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  }

  // Fetch team info
  const { data: team } = await admin
    .from('teams')
    .select('team_name, registration_type, team_status, payment_mode')
    .eq('id', slot.team_id)
    .maybeSingle()

  // Fetch captain's name
  let captainName = 'Your Captain'
  if (slot.invited_by_user_id) {
    const { data: profile } = await admin
      .from('profiles')
      .select('full_name, display_name')
      .eq('id', slot.invited_by_user_id)
      .maybeSingle()
    captainName = profile?.full_name || profile?.display_name || captainName
  }

  // Fetch event from Sanity
  let event: EventSnippet | null = null
  try {
    event = await client
      .withConfig({ useCdn: true })
      .fetch(eventQuery, { slug: slot.event_slug }) as EventSnippet
  } catch {
    // non-fatal — event details are nice-to-have on the invite page
  }

  const eventLocation = event?.location
    ? [event.location.venueName, event.location.city, event.location.state].filter(Boolean).join(', ')
    : null

  return NextResponse.json({
    id: slot.id,
    status: slot.status,
    playerFirstName: slot.player_first_name,
    playerLastName: slot.player_last_name,
    playerEmail: slot.player_email,
    amountDue: slot.amount_due,
    currency: slot.currency,
    expiresAt: slot.expires_at,
    paidAt: slot.paid_at,
    isCaptain: slot.is_captain,
    captainName,
    teamName: team?.team_name ?? null,
    teamType: team?.registration_type === 'duo' ? 'Duo' : 'Foursome',
    teamStatus: team?.team_status ?? null,
    eventTitle: event?.title ?? null,
    eventDate: event?.startDate ?? null,
    eventSlug: slot.event_slug,
    eventLocation,
  })
}
