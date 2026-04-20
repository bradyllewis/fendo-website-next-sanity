import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { client } from '@/sanity/lib/client'
import { eventQuery } from '@/sanity/lib/queries'
import SponsorForm from './SponsorForm'
import type { SponsorshipTier } from '../../types'

type Props = { params: Promise<{ slug: string }> }

export const metadata: Metadata = {
  title: 'Become a Sponsor — Fendo Golf',
}

export default async function SponsorPage({ params }: Props) {
  const { slug } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/auth/sign-in?next=/compete/${slug}/sponsor`)
  }

  const event = await client.withConfig({ useCdn: false }).fetch(eventQuery, { slug })

  if (!event?._id || !event.sponsorshipsEnabled) return notFound()

  if (event.status === 'completed' || event.status === 'cancelled') {
    redirect(`/compete/${slug}`)
  }

  const tiers: SponsorshipTier[] = event.sponsorshipTiers ?? []

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, display_name')
    .eq('id', user.id)
    .maybeSingle()

  const initialName = profile?.full_name || profile?.display_name || ''

  return (
    <>
      {/* Back link */}
      <div className="border-b border-border">
        <div className="container py-4">
          <Link
            href={`/compete/${slug}`}
            className="inline-flex items-center gap-2 text-sm text-muted hover:text-fg transition-colors duration-160 group"
          >
            <span className="group-hover:-translate-x-0.5 transition-transform duration-160">
              <svg
                className="w-4 h-4 rotate-180"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </span>
            Back to Event
          </Link>
        </div>
      </div>

      {/* Header */}
      <header className="border-b border-border bg-surface/40">
        <div className="container py-10 lg:py-14">
          <p className="label-mono mb-3">Sponsorship</p>
          <h1 className="display-md text-fg">{event.title}</h1>
          <p className="text-muted mt-2 max-w-lg">
            Partner with Fendo Golf and connect your brand with passionate golfers.
          </p>
        </div>
      </header>

      {/* Form */}
      <section className="section-padding">
        <div className="container">
          <SponsorForm
            event={{
              _id: event._id,
              slug,
              title: event.title ?? '',
              startDate: event.startDate ?? null,
            }}
            tiers={tiers}
            userEmail={user.email ?? ''}
            initialName={initialName}
            userId={user.id}
          />
        </div>
      </section>
    </>
  )
}
