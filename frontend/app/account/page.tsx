import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ProfileForm from '@/app/components/auth/ProfileForm'
import type { Profile } from '@/lib/supabase/types'
import MyRegistrations from '@/app/components/account/MyRegistrations'

export const metadata = {
  title: 'My Profile',
}

export default async function AccountPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/sign-in?next=/account')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/auth/sign-in')
  }

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
          <span className="label-mono-accent" style={{ animationDelay: '0.1s', animationFillMode: 'both', animationName: 'hero-fade-up', animationDuration: '0.7s' }}>
            Account
          </span>
          <h1
            className="display-md mt-3"
            style={{ animationDelay: '0.2s', animationFillMode: 'both', animationName: 'hero-fade-up', animationDuration: '0.7s' }}
          >
            Your Profile
          </h1>
          <p
            className="mt-3 text-muted max-w-lg"
            style={{ animationDelay: '0.3s', animationFillMode: 'both', animationName: 'hero-fade-up', animationDuration: '0.7s' }}
          >
            Manage your account details and personalize your experience.
          </p>
        </div>
      </section>

      {/* Profile form section */}
      <section className="section-padding">
        <div className="container max-w-2xl">
          <ProfileForm profile={profile as Profile} />
        </div>
      </section>

      {/* My Registrations */}
      <MyRegistrations />

      {/* Bottom CTA */}
      <section className="relative bg-fg border-t border-bg/10 section-padding">
        <div
          className="absolute inset-0 bg-[url('/images/tile-grid-white.png')] opacity-[0.03]"
          style={{ backgroundSize: '24px' }}
          aria-hidden="true"
        />
        <div className="container relative text-center max-w-2xl mx-auto">
          <span className="label-mono text-bg/30">Community</span>
          <h2 className="display-md text-bg mt-3">The Collective Awaits</h2>
          <p className="text-bg/50 mt-4 leading-relaxed">
            Connect with golfers who share your mindset. Compete, learn, and grow together.
          </p>
          <div className="mt-8">
            <a href="/collective" className="btn-accent">
              Enter The Collective
            </a>
          </div>
        </div>
      </section>
    </>
  )
}
