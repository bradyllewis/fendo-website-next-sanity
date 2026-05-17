import { notFound } from 'next/navigation'
import { format, parseISO, isPast } from 'date-fns'
import { createAdminClient } from '@/lib/supabase/admin'
import { client } from '@/sanity/lib/client'
import { defineQuery } from 'next-sanity'
import { IconCalendar, IconMapPin, IconDollar } from '@/app/components/icons'
import InvitePayButton from './InvitePayButton'

type Props = { params: Promise<{ token: string }> }

const eventTitleQuery = defineQuery(`
  *[_type == "event" && slug.current == $slug][0]{
    title,
    startDate,
    "location": location { venueName, city, state }
  }
`)

export default async function InvitePage({ params }: Props) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: slot } = await admin
    .from('registration_slots')
    .select('id, status, player_first_name, player_last_name, player_email, amount_due, expires_at, invited_by_user_id, team_id, event_slug, is_captain')
    .eq('invite_token', token)
    .maybeSingle()

  if (!slot) notFound()

  const { data: team } = await admin
    .from('teams')
    .select('team_name, registration_type, team_status')
    .eq('id', slot.team_id)
    .maybeSingle()

  let captainName = 'Your Captain'
  if (slot.invited_by_user_id) {
    const { data: captain } = await admin
      .from('profiles')
      .select('full_name')
      .eq('id', slot.invited_by_user_id)
      .maybeSingle()
    if (captain?.full_name) captainName = captain.full_name
  }

  const eventData = await client.fetch(eventTitleQuery, { slug: slot.event_slug }, { next: { revalidate: 3600 } })

  const isExpired = slot.status === 'expired' || slot.status === 'cancelled' || isPast(parseISO(slot.expires_at))
  const isPaid = slot.status === 'paid' || slot.status === 'claimed'
  const teamCancelled = team?.team_status === 'cancelled' || team?.team_status === 'expired'
  const canPay = !isExpired && !isPaid && !teamCancelled

  const teamType = team?.registration_type === 'duo' ? 'Duo' : 'Foursome'
  const expiresAt = format(parseISO(slot.expires_at), 'MMMM d, yyyy')
  const eventTitle = eventData?.title ?? slot.event_slug
  const eventDate = eventData?.startDate ? format(parseISO(eventData.startDate), 'EEEE, MMMM d, yyyy') : null
  const locationParts = [eventData?.location?.venueName, eventData?.location?.city, eventData?.location?.state].filter(Boolean)
  const eventLocation = locationParts.length > 0 ? locationParts.join(', ') : null

  return (
    <>
      {/* Hero */}
      <section className="relative border-b border-border overflow-hidden">
        <div
          className="absolute inset-0 bg-[url('/images/tile-grid-black.png')] opacity-[0.025]"
          style={{ backgroundSize: '24px' }}
          aria-hidden="true"
        />
        <div className="container relative py-20 max-w-2xl mx-auto text-center">
          <span className="label-mono-accent mb-4 block">Team Invitation</span>
          <h1 className="display-md mb-4">
            {isPaid
              ? 'Spot Already Claimed'
              : isExpired || teamCancelled
              ? 'This Invite Has Expired'
              : `You're Invited, ${slot.player_first_name}!`}
          </h1>
          <p className="text-muted leading-relaxed max-w-md mx-auto">
            {isPaid
              ? 'Your spot has already been paid. Check your email for confirmation.'
              : isExpired || teamCancelled
              ? 'This invite link is no longer active. Contact your team captain for a new invite.'
              : `${captainName} has invited you to join their ${teamType} team for ${eventTitle}.`}
          </p>
        </div>
      </section>

      {/* Details + pay */}
      <section className="section-padding">
        <div className="container max-w-md mx-auto space-y-6">
          {/* Event info card */}
          <div className="card-base p-6 space-y-4">
            <h2 className="font-semibold text-fg">Tournament Details</h2>
            <div className="divide-y divide-border">
              <div className="flex justify-between gap-4 py-3">
                <span className="text-sm text-muted font-mono">Event</span>
                <span className="text-sm text-fg font-medium text-right">{eventTitle}</span>
              </div>
              {eventDate && (
                <div className="flex justify-between gap-4 py-3 items-center">
                  <span className="text-sm text-muted font-mono flex items-center gap-1.5">
                    <IconCalendar className="w-3.5 h-3.5" /> Date
                  </span>
                  <span className="text-sm text-fg font-mono">{eventDate}</span>
                </div>
              )}
              {eventLocation && (
                <div className="flex justify-between gap-4 py-3 items-center">
                  <span className="text-sm text-muted font-mono flex items-center gap-1.5">
                    <IconMapPin className="w-3.5 h-3.5" /> Location
                  </span>
                  <span className="text-sm text-fg text-right max-w-[60%]">{eventLocation}</span>
                </div>
              )}
              <div className="flex justify-between gap-4 py-3">
                <span className="text-sm text-muted font-mono">Team</span>
                <span className="text-sm text-fg">{team?.team_name}</span>
              </div>
              <div className="flex justify-between gap-4 py-3">
                <span className="text-sm text-muted font-mono">Format</span>
                <span className="text-sm text-fg">{teamType}</span>
              </div>
              <div className="flex justify-between gap-4 py-3">
                <span className="text-sm text-muted font-mono">Invited by</span>
                <span className="text-sm text-fg">{captainName}</span>
              </div>
              <div className="flex justify-between gap-4 py-3 items-center">
                <span className="text-sm text-muted font-mono flex items-center gap-1.5">
                  <IconDollar className="w-3.5 h-3.5" /> Entry Fee
                </span>
                <span className="text-sm text-fg font-semibold">
                  ${(slot.amount_due / 100).toFixed(2)} USD
                </span>
              </div>
            </div>
          </div>

          {/* Invite expiry notice */}
          {canPay && (
            <p className="text-xs text-center text-muted">
              This invite expires on <strong className="text-fg">{expiresAt}</strong>. Pay now to lock in your spot.
            </p>
          )}

          {/* CTA */}
          {canPay && <InvitePayButton token={token} />}

          {isPaid && (
            <div className="card-base p-5 text-center space-y-2">
              <p className="text-sm text-green font-medium">✓ Spot Confirmed</p>
              <p className="text-xs text-muted">Check your email for your booking confirmation.</p>
            </div>
          )}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="relative bg-fg border-t border-bg/10 section-padding">
        <div
          className="absolute inset-0 bg-[url('/images/tile-grid-white.png')] opacity-[0.03]"
          style={{ backgroundSize: '24px' }}
          aria-hidden="true"
        />
        <div className="container relative text-center max-w-xl mx-auto">
          <p className="label-mono text-bg/30 mb-6">Fendo Golf</p>
          <h2 className="display-md text-bg mb-5">Compete With Intent</h2>
          <p className="text-bg/60 text-base leading-relaxed mb-10">
            Fendo Golf brings together players who take their game seriously.
          </p>
          <a href="/compete" className="btn-accent">Browse All Events</a>
        </div>
      </section>
    </>
  )
}
