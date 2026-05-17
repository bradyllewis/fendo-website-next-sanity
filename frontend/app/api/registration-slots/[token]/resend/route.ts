import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, getBaseUrl } from '@/lib/email/resend'
import { buildInviteEmail } from '@/lib/email/templates/invite'
import { format, parseISO } from 'date-fns'

type Params = { params: Promise<{ token: string }> }

export async function POST(_request: NextRequest, { params }: Params) {
  const { token } = await params

  // Only the captain (authenticated user who invited) can resend
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: slot, error } = await admin
    .from('registration_slots')
    .select('id, player_first_name, player_last_name, player_email, invited_by_user_id, team_id, event_slug, amount_due, expires_at, status')
    .eq('invite_token', token)
    .maybeSingle()

  if (error || !slot) {
    return NextResponse.json({ error: 'Slot not found' }, { status: 404 })
  }

  // Only the captain who created the invite can resend
  if (slot.invited_by_user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (slot.status === 'paid' || slot.status === 'claimed') {
    return NextResponse.json({ error: 'Slot already paid — no resend needed' }, { status: 409 })
  }

  if (slot.status === 'expired' || slot.status === 'cancelled') {
    return NextResponse.json({ error: 'Slot is expired or cancelled' }, { status: 410 })
  }

  // Fetch captain's name
  const { data: captainProfile } = await admin
    .from('profiles')
    .select('full_name, display_name')
    .eq('id', user.id)
    .maybeSingle()

  const captainName = captainProfile?.full_name || captainProfile?.display_name || 'Your Captain'

  // Fetch team info
  const { data: team } = await admin
    .from('teams')
    .select('team_name, registration_type')
    .eq('id', slot.team_id)
    .maybeSingle()

  const teamType = team?.registration_type === 'duo' ? 'Duo' : 'Foursome'
  const siteUrl = getBaseUrl()
  const inviteUrl = `${siteUrl}/compete/invite/${token}`
  const expiresAt = format(parseISO(slot.expires_at), 'MMMM d, yyyy')

  await sendEmail({
    to: slot.player_email,
    subject: `Reminder: You've been invited to join ${team?.team_name ?? 'a tournament team'}`,
    html: buildInviteEmail({
      playerFirstName: slot.player_first_name,
      captainName,
      eventTitle: team?.team_name ?? 'Tournament',
      eventDate: '',
      eventLocation: null,
      teamType,
      amountDue: slot.amount_due,
      expiresAt,
      inviteUrl,
    }),
  })

  // Update email_sent_at
  await admin
    .from('registration_slots')
    .update({ email_sent_at: new Date().toISOString() })
    .eq('id', slot.id)

  return NextResponse.json({ success: true })
}
