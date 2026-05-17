import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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
    .select('id, player_email, player_first_name, status, team_id, event_sanity_id, event_slug, amount_due, is_captain, invite_token')
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
    .select('team_name, registration_type')
    .eq('id', slot.team_id)
    .maybeSingle()

  // Insert event_registrations row (idempotent: skip if already exists for this slot)
  const { data: existingReg } = await admin
    .from('event_registrations')
    .select('id')
    .eq('user_id', user.id)
    .eq('event_slug', slot.event_slug)
    .maybeSingle()

  if (!existingReg) {
    await admin
      .from('event_registrations')
      .insert({
        user_id: user.id,
        event_sanity_id: slot.event_sanity_id,
        event_slug: slot.event_slug,
        event_title: slot.event_slug, // best available without a Sanity query here
        amount_paid: slot.amount_due,
        currency: 'usd',
        status: 'paid',
        registration_type: team?.registration_type ?? 'duo',
        team_name: team?.team_name ?? null,
        team_id: slot.team_id,
        metadata: {
          isTeamCaptain: slot.is_captain,
          paymentMode: 'individual',
          registrationSlotId: slot.id,
          inviteToken: token,
        },
      })
  }

  redirect('/account/events?claim=success')
}
