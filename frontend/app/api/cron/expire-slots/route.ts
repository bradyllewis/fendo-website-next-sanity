import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, getBaseUrl } from '@/lib/email/resend'
import { buildSlotExpiredEmail } from '@/lib/email/templates/slot-expired'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const expectedSecret = process.env.CRON_SECRET

  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const siteUrl = getBaseUrl()

  // Find all slots past their expiry window that are still in a non-terminal state
  const { data: expiredSlots, error: fetchError } = await admin
    .from('registration_slots')
    .select(`
      id,
      team_id,
      player_first_name,
      player_last_name,
      player_email,
      invited_by_user_id,
      event_slug
    `)
    .lt('expires_at', new Date().toISOString())
    .in('status', ['captain_pending', 'invited', 'payment_started'])

  if (fetchError) {
    console.error('[cron/expire-slots] Failed to fetch expired slots:', fetchError)
    return NextResponse.json({ error: 'DB query failed' }, { status: 500 })
  }

  if (!expiredSlots || expiredSlots.length === 0) {
    return NextResponse.json({ expired: 0, message: 'No slots to expire' })
  }

  const slotIds = expiredSlots.map((s) => s.id)

  // Batch expire
  const { error: expireError } = await admin
    .from('registration_slots')
    .update({ status: 'expired' })
    .in('id', slotIds)

  if (expireError) {
    console.error('[cron/expire-slots] Failed to expire slots:', expireError)
    return NextResponse.json({ error: 'Failed to expire slots' }, { status: 500 })
  }

  // Group by team + captain to send one email per captain per team
  const byTeamCaptain = new Map<string, {
    captainUserId: string
    teamId: string
    slots: Array<{ firstName: string; lastName: string; email: string }>
  }>()

  for (const slot of expiredSlots) {
    if (!slot.invited_by_user_id) continue
    const key = `${slot.team_id}:${slot.invited_by_user_id}`
    if (!byTeamCaptain.has(key)) {
      byTeamCaptain.set(key, { captainUserId: slot.invited_by_user_id, teamId: slot.team_id, slots: [] })
    }
    byTeamCaptain.get(key)!.slots.push({
      firstName: slot.player_first_name,
      lastName: slot.player_last_name,
      email: slot.player_email,
    })
  }

  // Update team statuses for affected teams
  const affectedTeamIds = [...new Set(expiredSlots.map((s) => s.team_id))]

  for (const teamId of affectedTeamIds) {
    const { data: allSlots } = await admin
      .from('registration_slots')
      .select('status')
      .eq('team_id', teamId)

    if (!allSlots) continue

    const paidCount = allSlots.filter((s) => s.status === 'paid' || s.status === 'claimed').length
    const activeCount = allSlots.filter((s) => !['paid', 'claimed', 'expired', 'cancelled'].includes(s.status)).length
    const total = allSlots.length

    let newStatus: string
    if (paidCount === total) {
      newStatus = 'complete'
    } else if (paidCount > 0 && activeCount === 0) {
      newStatus = 'partially_paid'
    } else if (paidCount === 0 && activeCount === 0) {
      newStatus = 'expired'
    } else {
      newStatus = 'partially_paid'
    }

    await admin
      .from('teams')
      .update({ team_status: newStatus })
      .eq('id', teamId)
  }

  // Send expiry notification emails to captains
  for (const [, group] of byTeamCaptain) {
    const { data: captain } = await admin
      .from('profiles')
      .select('full_name, email')
      .eq('id', group.captainUserId)
      .maybeSingle()

    const { data: team } = await admin
      .from('teams')
      .select('team_name, event_slug')
      .eq('id', group.teamId)
      .maybeSingle()

    if (!captain?.email || !team) continue

    const captainFirstName = (captain.full_name ?? 'Captain').split(' ')[0]

    try {
      await sendEmail({
        to: captain.email,
        subject: `Team invite${group.slots.length > 1 ? 's' : ''} expired — ${team.team_name}`,
        html: buildSlotExpiredEmail({
          captainFirstName,
          expiredSlots: group.slots,
          teamName: team.team_name,
          eventTitle: team.event_slug,
          siteUrl,
        }),
      })
    } catch (err) {
      console.error('[cron/expire-slots] Failed to send expiry email:', err)
    }
  }

  return NextResponse.json({ expired: slotIds.length, teams: affectedTeamIds.length })
}
