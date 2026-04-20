import { redirect } from 'next/navigation'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripe } from '@/lib/stripe/client'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ session_id?: string; invoice?: string }>
}

export const metadata = {
  title: 'Sponsorship Confirmed — Fendo Golf',
}

export default async function SponsorSuccessPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { session_id, invoice } = await searchParams

  if (!session_id && !invoice) {
    redirect(`/compete/${slug}`)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/auth/sign-in?next=/compete/${slug}`)
  }

  let sponsorship = null

  if (invoice) {
    const { data } = await supabase
      .from('sponsor_registrations')
      .select('*')
      .eq('event_slug', slug)
      .eq('user_id', user.id)
      .eq('status', 'invoiced')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    sponsorship = data
  } else if (session_id) {
    const { data } = await supabase
      .from('sponsor_registrations')
      .select('*')
      .eq('stripe_checkout_session_id', session_id)
      .eq('user_id', user.id)
      .maybeSingle()
    sponsorship = data

    // Inline fulfillment if webhook hasn't fired yet
    if (sponsorship?.status === 'pending') {
      try {
        const stripeSession = await stripe.checkout.sessions.retrieve(session_id)

        if (
          stripeSession.payment_status === 'paid' &&
          stripeSession.metadata?.userId === user.id
        ) {
          const admin = createAdminClient()
          const { data: fulfilled } = await admin
            .from('sponsor_registrations')
            .update({
              status: 'paid',
              stripe_payment_intent_id: (stripeSession.payment_intent as string) ?? null,
              amount_paid: stripeSession.amount_total,
              currency: stripeSession.currency ?? 'usd',
            })
            .eq('stripe_checkout_session_id', session_id)
            .eq('status', 'pending')
            .select('*')
            .maybeSingle()

          if (fulfilled) sponsorship = fulfilled
        }
      } catch (err) {
        console.error('[sponsor-success] Stripe session verify failed:', err)
      }
    }
  }

  const isInvoice = sponsorship?.status === 'invoiced'
  const isPaid = sponsorship?.status === 'paid'
  const isConfirmed = isPaid || isInvoice

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
              isConfirmed ? 'bg-green/10' : 'bg-mustard/20'
            }`}
          >
            {isConfirmed ? (
              <svg className="w-10 h-10 text-green" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg className="w-10 h-10 text-fg/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>

          <span className="label-mono-accent mb-4 block">
            {isInvoice ? 'Invoice Requested' : isPaid ? 'Sponsorship Confirmed' : 'Payment Received'}
          </span>

          <h1 className="display-md mb-4">
            {isInvoice
              ? "You're on board!"
              : isPaid
                ? "Sponsorship confirmed!"
                : 'Confirming your sponsorship…'}
          </h1>

          {isInvoice ? (
            <p className="text-muted leading-relaxed mb-8 max-w-md mx-auto">
              Your sponsorship for{' '}
              <strong className="text-fg">{sponsorship?.event_title}</strong> has been submitted.
              Our team will send you an invoice shortly.
            </p>
          ) : isPaid ? (
            <p className="text-muted leading-relaxed mb-8 max-w-md mx-auto">
              Your sponsorship for{' '}
              <strong className="text-fg">{sponsorship?.event_title}</strong> is confirmed.
              {sponsorship?.event_date && (
                <> We&apos;ll see you on {format(parseISO(sponsorship.event_date), 'MMMM d, yyyy')}.</>
              )}
            </p>
          ) : (
            <p className="text-muted leading-relaxed mb-8 max-w-md mx-auto">
              Your payment was received and your sponsorship is being confirmed.
            </p>
          )}

          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link href={`/compete/${slug}`} className="btn-ghost">View Event</Link>
            <Link href="/account" className="btn-accent">My Account</Link>
          </div>
        </div>
      </section>

      {/* Summary */}
      {isConfirmed && sponsorship && (
        <section className="section-padding">
          <div className="container max-w-md mx-auto">
            <div className="card-base p-6 space-y-4">
              <h2 className="font-semibold text-fg">Sponsorship Summary</h2>
              <div className="divide-y divide-border">
                <div className="flex justify-between gap-4 py-3">
                  <span className="text-sm text-muted font-mono">Event</span>
                  <span className="text-sm text-fg font-medium text-right max-w-[60%]">
                    {sponsorship.event_title}
                  </span>
                </div>
                <div className="flex justify-between gap-4 py-3">
                  <span className="text-sm text-muted font-mono">Company</span>
                  <span className="text-sm text-fg font-medium">{sponsorship.company_name}</span>
                </div>
                <div className="flex justify-between gap-4 py-3">
                  <span className="text-sm text-muted font-mono">Level</span>
                  <span className="text-sm text-fg font-medium">{sponsorship.sponsorship_level}</span>
                </div>
                {sponsorship.event_date && (
                  <div className="flex justify-between gap-4 py-3">
                    <span className="text-sm text-muted font-mono">Date</span>
                    <span className="text-sm text-fg font-mono">
                      {format(parseISO(sponsorship.event_date), 'MMM d, yyyy')}
                    </span>
                  </div>
                )}
                {isPaid && sponsorship.amount_paid != null && (
                  <div className="flex justify-between gap-4 py-3">
                    <span className="text-sm text-muted font-mono">Amount Paid</span>
                    <span className="text-sm text-fg font-mono">
                      ${(sponsorship.amount_paid / 100).toFixed(2)} USD
                    </span>
                  </div>
                )}
                <div className="flex justify-between gap-4 py-3">
                  <span className="text-sm text-muted font-mono">Status</span>
                  <span className={`text-sm font-mono font-medium ${isInvoice ? 'text-mustard' : 'text-green'}`}>
                    {isInvoice ? 'Invoice Pending' : 'Confirmed'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Bottom CTA */}
      <section className="relative bg-fg border-t border-bg/10 section-padding">
        <div
          className="absolute inset-0 bg-[url(/images/tile-grid-white.png)] opacity-[0.03]"
          style={{ backgroundSize: '24px' }}
          aria-hidden="true"
        />
        <div className="container relative text-center max-w-xl mx-auto">
          <p className="label-mono text-bg/30 mb-6">The Collective</p>
          <h2 className="display-md text-bg mb-5">Thank you for your support.</h2>
          <p className="text-bg/60 text-base leading-relaxed mb-10">
            Your partnership helps grow the game and the Fendo Golf community.
          </p>
          <Link href="/compete" className="btn-accent">Browse All Events</Link>
        </div>
      </section>
    </>
  )
}
