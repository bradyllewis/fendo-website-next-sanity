import { notFound } from 'next/navigation'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripe } from '@/lib/stripe/client'
import { IconCalendar } from '@/app/components/icons'

type Props = {
  params: Promise<{ token: string }>
  searchParams: Promise<{ session_id?: string }>
}

export const metadata = {
  title: 'Spot Confirmed — Fendo Golf',
}

export default async function InviteSuccessPage({ params, searchParams }: Props) {
  const { token } = await params
  const { session_id } = await searchParams

  const admin = createAdminClient()

  const { data: slot } = await admin
    .from('registration_slots')
    .select('id, status, player_first_name, player_last_name, player_email, amount_due, expires_at, team_id, event_slug, is_captain, paid_at')
    .eq('invite_token', token)
    .maybeSingle()

  if (!slot) notFound()

  // Inline fulfillment fallback — webhook may not have fired yet
  if (slot.status === 'payment_started' && session_id) {
    try {
      const stripeSession = await stripe.checkout.sessions.retrieve(session_id)
      if (
        stripeSession.payment_status === 'paid' &&
        stripeSession.metadata?.inviteToken === token
      ) {
        await admin
          .from('registration_slots')
          .update({
            status: 'paid',
            paid_at: new Date().toISOString(),
            stripe_payment_intent_id: (stripeSession.payment_intent as string) ?? null,
            stripe_customer_id: (stripeSession.customer as string) ?? null,
          })
          .eq('id', slot.id)
          .eq('status', 'payment_started')
        // Re-fetch after inline fulfillment
        const { data: refreshed } = await admin
          .from('registration_slots')
          .select('status, paid_at')
          .eq('id', slot.id)
          .maybeSingle()
        if (refreshed) {
          slot.status = refreshed.status
          slot.paid_at = refreshed.paid_at
        }
      }
    } catch {
      // Non-fatal — Stripe may be briefly unavailable
    }
  }

  const { data: team } = await admin
    .from('teams')
    .select('team_name, registration_type, event_slug')
    .eq('id', slot.team_id)
    .maybeSingle()

  const isPaid = slot.status === 'paid' || slot.status === 'claimed'
  const teamType = team?.registration_type === 'duo' ? 'Duo' : 'Foursome'
  const signUpUrl = `/auth/sign-up?claimToken=${token}&email=${encodeURIComponent(slot.player_email)}`
  const signInUrl = `/auth/sign-in?next=/account/claim/${token}`

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
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${
              isPaid ? 'bg-green/10' : 'bg-mustard/20'
            }`}
          >
            {isPaid ? (
              <svg className="w-10 h-10 text-green" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-10 h-10 text-fg/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>

          <span className="label-mono-accent mb-4 block">
            {isPaid ? 'Payment Confirmed' : 'Payment Received'}
          </span>

          <h1 className="display-md mb-4">
            {isPaid ? "You're In!" : 'Confirming Your Spot…'}
          </h1>

          <p className="text-muted leading-relaxed mb-8 max-w-md mx-auto">
            {isPaid
              ? `Your spot on ${team?.team_name ?? 'the team'} is confirmed. A confirmation email has been sent to ${slot.player_email}.`
              : 'Your payment was received. Your spot is being confirmed — check your email shortly.'}
          </p>
        </div>
      </section>

      {/* Booking summary */}
      {isPaid && (
        <section className="section-padding border-b border-border">
          <div className="container max-w-md mx-auto">
            <div className="card-base p-6 space-y-4">
              <h2 className="font-semibold text-fg">Booking Summary</h2>
              <div className="divide-y divide-border">
                <div className="flex justify-between gap-4 py-3">
                  <span className="text-sm text-muted font-mono">Player</span>
                  <span className="text-sm text-fg">{slot.player_first_name} {slot.player_last_name}</span>
                </div>
                <div className="flex justify-between gap-4 py-3">
                  <span className="text-sm text-muted font-mono">Team</span>
                  <span className="text-sm text-fg">{team?.team_name}</span>
                </div>
                <div className="flex justify-between gap-4 py-3">
                  <span className="text-sm text-muted font-mono">Format</span>
                  <span className="text-sm text-fg">{teamType}</span>
                </div>
                {slot.paid_at && (
                  <div className="flex justify-between gap-4 py-3 items-center">
                    <span className="text-sm text-muted font-mono flex items-center gap-1.5">
                      <IconCalendar className="w-3.5 h-3.5" /> Paid
                    </span>
                    <span className="text-sm text-fg font-mono">
                      {format(parseISO(slot.paid_at), 'MMM d, yyyy')}
                    </span>
                  </div>
                )}
                <div className="flex justify-between gap-4 py-3">
                  <span className="text-sm text-muted font-mono">Amount Paid</span>
                  <span className="text-sm text-fg font-mono">
                    ${(slot.amount_due / 100).toFixed(2)} USD
                  </span>
                </div>
                <div className="flex justify-between gap-4 py-3">
                  <span className="text-sm text-muted font-mono">Status</span>
                  <span className="text-sm text-green font-mono font-medium">Confirmed</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Claim CTA */}
      {isPaid && (
        <section className="section-padding border-b border-border">
          <div className="container max-w-md mx-auto">
            <div className="card-base p-6 space-y-4 text-center">
              <h2 className="font-semibold text-fg">Create Your Player Profile</h2>
              <p className="text-sm text-muted leading-relaxed">
                Link your payment to a Fendo Golf account to view your registrations, track results, and connect with your team.
              </p>
              <Link href={signUpUrl} className="btn-accent w-full block">
                Create My Player Profile →
              </Link>
              <p className="text-xs text-muted">
                Already have an account?{' '}
                <Link href={signInUrl} className="text-fg font-medium hover:text-accent transition-colors">
                  Sign in to claim your spot
                </Link>
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Bottom CTA */}
      <section className="relative bg-fg border-t border-bg/10 section-padding">
        <div
          className="absolute inset-0 bg-[url('/images/tile-grid-white.png')] opacity-[0.03]"
          style={{ backgroundSize: '24px' }}
          aria-hidden="true"
        />
        <div className="container relative text-center max-w-xl mx-auto">
          <p className="label-mono text-bg/30 mb-6">The Collective</p>
          <h2 className="display-md text-bg mb-5">Ready for more?</h2>
          <p className="text-bg/60 text-base leading-relaxed mb-10">
            Explore upcoming events and improve your game with the Fendo Playbook.
          </p>
          <a href="/compete" className="btn-accent">Browse All Events</a>
        </div>
      </section>
    </>
  )
}
