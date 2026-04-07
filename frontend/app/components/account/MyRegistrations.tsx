import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { IconCalendar } from '@/app/components/icons'
import type { EventRegistration } from '@/lib/supabase/types'

export default async function MyRegistrations() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: registrations } = await supabase
    .from('event_registrations')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (!registrations || registrations.length === 0) {
    return (
      <section className="py-12 border-t border-border">
        <div className="container max-w-2xl">
          <h2 className="font-semibold text-xl tracking-tight mb-3">My Events</h2>
          <p className="text-muted text-sm">
            You haven&apos;t registered for any events yet.{' '}
            <Link href="/compete" className="text-accent hover:underline transition-colors">
              Browse upcoming events
            </Link>
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="py-12 border-t border-border">
      <div className="container max-w-2xl">
        <h2 className="font-semibold text-xl tracking-tight mb-6">My Events</h2>
        <div className="space-y-3">
          {(registrations as EventRegistration[]).map((reg) => (
            <div
              key={reg.id}
              className="card-base p-5 flex items-start justify-between gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="font-medium text-fg text-sm">{reg.event_title}</h3>
                  <RegistrationStatusBadge status={reg.status} />
                </div>
                {reg.event_date && (
                  <p className="flex items-center gap-1.5 text-xs font-mono text-muted-2 mt-1">
                    <IconCalendar className="w-3.5 h-3.5 shrink-0" />
                    {format(parseISO(reg.event_date), 'MMMM d, yyyy')}
                  </p>
                )}
                {reg.amount_paid != null && (
                  <p className="text-xs font-mono text-muted-2 mt-0.5">
                    Paid: ${(reg.amount_paid / 100).toFixed(2)} USD
                  </p>
                )}
              </div>
              <Link
                href={`/compete/${reg.event_slug}`}
                className="btn-ghost text-xs px-3 py-2 shrink-0"
              >
                View Event
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function RegistrationStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    paid:       { label: 'Registered',  className: 'text-green bg-green/10 border-green/20' },
    pending:    { label: 'Pending',     className: 'text-fg bg-mustard/20 border-mustard/30' },
    cancelled:  { label: 'Cancelled',   className: 'text-muted bg-surface border-border' },
    refunded:   { label: 'Refunded',    className: 'text-muted bg-surface border-border' },
    waitlisted: { label: 'Waitlisted',  className: 'text-fg bg-mustard/20 border-mustard/30' },
  }

  const badge = config[status] ?? {
    label: status,
    className: 'text-muted bg-surface border-border',
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[0.65rem] font-mono font-medium tracking-wide border ${badge.className}`}
    >
      {badge.label}
    </span>
  )
}
