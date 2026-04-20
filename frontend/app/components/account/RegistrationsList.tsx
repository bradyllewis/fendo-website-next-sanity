import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { IconCalendar, IconTicket, IconArrow } from '@/app/components/icons'
import type { EventRegistration } from '@/lib/supabase/types'
import UnregisterButton from './UnregisterButton'

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
            {reg.team_name && (
              <p className="text-xs font-mono text-muted mt-0.5">
                Team: <span className="text-fg">{reg.team_name}</span>
              </p>
            )}
            {!!reg.metadata?.isTeamCaptain && !!reg.metadata?.inviteCode && (
              <p className="text-xs font-mono text-accent mt-0.5">
                Invite code:{' '}
                <span className="tracking-widest font-bold">
                  {String(reg.metadata.inviteCode)}
                </span>
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-0.5 shrink-0">
            <Link
              href={`/compete/${reg.event_slug}`}
              className="btn-ghost text-xs px-3 py-2"
            >
              View Event
            </Link>
            {reg.status === 'paid' &&
              reg.amount_paid === 0 &&
              !reg.stripe_payment_intent_id && (
                <UnregisterButton
                  registrationId={reg.id}
                  eventTitle={reg.event_title}
                />
              )}
          </div>
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
