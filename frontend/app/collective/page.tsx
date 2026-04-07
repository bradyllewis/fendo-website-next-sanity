import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { IconTarget, IconUsers, IconBook, IconTicket } from '@/app/components/icons'

export const metadata = {
  title: 'The Collective',
}

export default async function CollectivePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/sign-in?next=/collective')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, display_name')
    .eq('id', user.id)
    .single()

  const displayName = profile?.display_name || profile?.full_name?.split(' ')[0] || 'Member'

  return (
    <>
      {/* Hero */}
      <section className="relative border-b border-border overflow-hidden">
        <div
          className="absolute inset-0 bg-[url('/images/tile-grid-black.png')] opacity-[0.025]"
          style={{ backgroundSize: '24px' }}
          aria-hidden="true"
        />
        <div className="container relative py-24 lg:py-32">
          <span
            className="label-mono-accent"
            style={{ animationDelay: '0.1s', animationFillMode: 'both', animationName: 'hero-fade-up', animationDuration: '0.7s' }}
          >
            The Collective
          </span>
          <h1
            className="display-lg mt-3"
            style={{ animationDelay: '0.2s', animationFillMode: 'both', animationName: 'hero-fade-up', animationDuration: '0.7s' }}
          >
            Welcome, {displayName}
          </h1>
          <p
            className="mt-4 text-muted text-lg max-w-xl leading-relaxed"
            style={{ animationDelay: '0.35s', animationFillMode: 'both', animationName: 'hero-fade-up', animationDuration: '0.7s' }}
          >
            Your home base. Compete in events, sharpen your game, and connect with golfers who play with intention.
          </p>
        </div>
      </section>

      {/* Quick links */}
      <section className="section-padding" id="hub">
        <div className="container">
          <span className="label-mono text-muted">Your Hub</span>
          <h2 className="display-md mt-3 mb-10">What&apos;s Next</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <QuickCard
              href="/compete"
              icon={<IconTicket className="w-6 h-6" />}
              title="Compete"
              description="Browse upcoming events and register for your next round."
            />
            <QuickCard
              href="/playbook"
              icon={<IconBook className="w-6 h-6" />}
              title="Playbook"
              description="Drills, guides, and video content to sharpen every part of your game."
            />
            <QuickCard
              href="/gear"
              icon={<IconTarget className="w-6 h-6" />}
              title="Gear"
              description="Curated equipment picks from the Fendo team."
            />
            <QuickCard
              href="/account"
              icon={<IconUsers className="w-6 h-6" />}
              title="Your Profile"
              description="Update your details, handicap, and avatar."
            />
          </div>
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
          <span className="label-mono text-bg/30">Stay Sharp</span>
          <h2 className="display-md text-bg mt-3">More Coming Soon</h2>
          <p className="text-bg/50 mt-4 leading-relaxed">
            Challenges, leaderboards, and member-only content are on the way.
            This is just the beginning.
          </p>
          <div className="mt-8">
            <Link href="/playbook" className="btn-accent">
              Explore the Playbook
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}

function QuickCard({
  href,
  icon,
  title,
  description,
}: {
  href: string
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <Link href={href} className="card-base overflow-hidden p-6 group flex gap-5 items-start">
      <div className="shrink-0 w-12 h-12 rounded-xl bg-surface flex items-center justify-center text-fg group-hover:bg-accent group-hover:text-white transition-colors duration-200">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold text-fg group-hover:text-accent transition-colors duration-200">
          {title}
        </h3>
        <p className="text-sm text-muted mt-1 leading-relaxed">{description}</p>
      </div>
    </Link>
  )
}
