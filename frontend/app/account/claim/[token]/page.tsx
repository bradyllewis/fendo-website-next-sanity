import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { client } from '@/sanity/lib/client'
import { eventByIdQuery } from '@/sanity/lib/queries'

type Props = { params: Promise<{ token: string }> }

export const metadata = {
  title: 'Claim Your Spot — Fendo Golf',
}

export default async function ClaimPage({ params }: Props) {
  const { token } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/auth/sign-in?next=/account/claim/${token}`)
  }

  const admin = createAdminClient()

  const { data: slot } = await admin
    .from('registration_slots')
    .select('id, player_email, player_first_name, player_last_name, player_phone, status, team_id, event_sanity_id, event_slug, amount_due, is_captain, invite_token, metadata')
    .eq('invite_token', token)
    .maybeSingle()

  if (!slot) {
    redirect('/account/events?claim=invalid')
  }

  // Email must match
  if (slot.player_email.toLowerCase() !== user.email!.toLowerCase()) {
    redirect('/account/events?claim=mismatch')
  }

  // Already claimed
  if (slot.status === 'claimed') {
    redirect('/account/events?claim=already')
  }

  // Must be paid to claim
  if (slot.status !== 'paid') {
    redirect('/account/events?claim=unpaid')
  }

  // Claim the slot
  await admin
    .from('registration_slots')
    .update({ status: 'claimed', app_user_id: user.id })
    .eq('id', slot.id)

  // Fetch team info for event_registrations row
  const { data: team } = await admin
    .from('teams')
    .select('team_name, registration_type, invite_code')
    .eq('id', slot.team_id)
    .maybeSingle()

  // Resolve current event title from Sanity (slug may have changed)
  const eventData = await client
    .fetch(eventByIdQuery, { id: slot.event_sanity_id }, { next: { revalidate: 3600 } })
  const eventTitle = (eventData as { title?: string } | null)?.title ?? slot.event_slug

  // Link the event_registrations ledger row to the now-authenticated user.
  // Priority 1: a row already created by the webhook/success page keyed on registration_slot_id
  //   (user_id will be null — we fill it in here).
  // Priority 2: a row already exists for this (user_id, event_sanity_id).
  // Priority 3: insert a fresh row.
  const { data: slotReg } = await admin
    .from('event_registrations')
    .select('id')
    .eq('registration_slot_id', slot.id)
    .maybeSingle()

  if (slotReg) {
    // Backfill user_id onto the existing mirror row
    await admin
      .from('event_registrations')
      .update({ user_id: user.id, event_title: eventTitle })
      .eq('id', slotReg.id)
      .is('user_id', 'null')
  } else {
    const { data: existingReg } = await admin
      .from('event_registrations')
      .select('id')
      .eq('user_id', user.id)
      .eq('event_sanity_id', slot.event_sanity_id)
      .maybeSingle()

    if (!existingReg) {
      await admin
        .from('event_registrations')
        .insert({
          user_id: user.id,
          event_sanity_id: slot.event_sanity_id,
          event_slug: slot.event_slug,
          event_title: eventTitle,
          amount_paid: slot.amount_due,
          currency: 'usd',
          status: 'paid',
          registration_type: team?.registration_type ?? 'duo',
          team_name: team?.team_name ?? null,
          team_id: slot.team_id,
          player_first_name: slot.player_first_name,
          player_last_name: slot.player_last_name,
          player_email: slot.player_email,
          player_phone: slot.player_phone,
          registration_slot_id: slot.id,
          metadata: {
            isTeamCaptain: slot.is_captain,
            paymentMode: 'individual',
            registrationSlotId: slot.id,
            inviteToken: token,
            inviteCode: team?.invite_code ?? null,
            shirtSize: (slot.metadata as Record<string, unknown> | null)?.shirtSize ?? null,
          },
        })
    }
  }

  redirect('/account/events?claim=success')
}
