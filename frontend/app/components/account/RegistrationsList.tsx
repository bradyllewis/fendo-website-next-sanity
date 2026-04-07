import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { IconCalendar, IconTicket, IconArrow } from '@/app/components/icons'
import type { EventRegistration } from '@/lib/supabase/types'

interface Props {
  registrations: EventRegistration[]
}

export default function RegistrationsList({ registrations }: Props) {
  if (registrations.length === 0) {
    return <RegistrationsEmptyState />
  }

  return (
    <div className="space-y-3">
      {registrations.map((reg) => (
        <div
          key={reg.id}
          className="card-base p-5 flex items-start justify-between gap-4 hover:-translate-y-px transition-transform duration-200"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-medium text-fg text-sm">{reg.event_title}</h3>
              <RegistrationStatusBadge status={reg.status} />
            </div>
            {reg.event_date && (
              <p className="flex items-center gap-1.5 text-xs font-mono text-muted mt-1">
                <IconCalendar className="w-3.5 h-3.5 shrink-0" />
                {format(parseISO(reg.event_date), 'MMMM d, yyyy')}
              </p>
            )}
            {reg.amount_paid != null && (
              <p className="text-xs font-mono text-muted mt-0.5">
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
  )
}

export function RegistrationsEmptyState() {
  return (
    <div className="card-base p-10 flex flex-col items-center text-center gap-4">
      <div className="w-12 h-12 rounded-full bg-surface border border-border flex items-center justify-center">
        <IconTicket className="w-5 h-5 text-muted" />
      </div>
      <div>
        <p className="font-medium text-fg text-sm mb-1">No registered events yet</p>
        <p className="text-muted text-sm">
          When you register for a competition, it will appear here.
        </p>
      </div>
      <Link
        href="/compete"
        className="btn-outline text-sm flex items-center gap-2 mt-1"
      >
        Browse Events
        <IconArrow className="w-4 h-4" />
      </Link>
    </div>
  )
}

export function RegistrationStatusBadge({ status }: { status: string }) {
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
