import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AccountNav from '@/app/components/account/AccountNav'
import RegistrationsList from '@/app/components/account/RegistrationsList'
import type { EventRegistration } from '@/lib/supabase/types'

export const metadata = {
  title: 'My Events',
}

export default async function AccountEventsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/sign-in?next=/account/events')
  }

  const { data: registrations } = await supabase
    .from('event_registrations')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <>
      {/* Hero */}
      <section className="relative border-b border-border overflow-hidden">
        <div
          className="absolute inset-0 bg-[url('/images/tile-grid-black.png')] opacity-[0.025]"
          style={{ backgroundSize: '24px' }}
          aria-hidden="true"
        />
        <div className="container relative py-16 lg:py-20">
          <span
            className="label-mono-accent"
            style={{ animationDelay: '0.1s', animationFillMode: 'both', animationName: 'hero-fade-up', animationDuration: '0.7s' }}
          >
            Account
          </span>
          <h1
            className="display-md mt-3"
            style={{ animationDelay: '0.2s', animationFillMode: 'both', animationName: 'hero-fade-up', animationDuration: '0.7s' }}
          >
            My Events
          </h1>
          <p
            className="mt-3 text-muted max-w-lg"
            style={{ animationDelay: '0.3s', animationFillMode: 'both', animationName: 'hero-fade-up', animationDuration: '0.7s' }}
          >
            All the competitions you&apos;ve registered for, in one place.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="section-padding">
        <div className="container max-w-2xl">
          <div className="mb-8">
            <AccountNav />
          </div>

          <RegistrationsList registrations={(registrations ?? []) as EventRegistration[]} />
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="relative bg-fg border-t border-bg/10 section-padding">
        <div
          className="absolute inset-0 bg-[url('/images/tile-grid-white.png')] opacity-[0.03]"
          style={{ backgroundSize: '24px' }}
          aria-hidden="true"
        />
        <div className="container relative text-center max-w-2xl mx-auto">
          <span className="label-mono text-bg/30">Compete</span>
          <h2 className="display-md text-bg mt-3">Find Your Next Event</h2>
          <p className="text-bg/50 mt-4 leading-relaxed">
            Browse upcoming tournaments and competitions. Register, compete, and climb the leaderboard.
          </p>
          <div className="mt-8">
            <a href="/compete" className="btn-accent">
              View All Events
            </a>
          </div>
        </div>
      </section>
    </>
  )
}
