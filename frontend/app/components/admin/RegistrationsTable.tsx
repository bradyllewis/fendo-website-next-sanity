'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import StatusSelector from './StatusSelector'
import type { EventRegistration } from '@/lib/supabase/types'

interface RegistrationRow extends EventRegistration {
  user_email?: string
  user_name?: string
}

interface Props {
  registrations: RegistrationRow[]
}

const STATUS_FILTERS = ['all', 'paid', 'pending', 'waitlisted', 'cancelled', 'refunded'] as const
type Filter = typeof STATUS_FILTERS[number]

const STATUS_LABEL: Record<string, string> = {
  all:        'All',
  paid:       'Registered',
  pending:    'Pending',
  waitlisted: 'Waitlisted',
  cancelled:  'Cancelled',
  refunded:   'Refunded',
}

export default function RegistrationsTable({ registrations }: Props) {
  const [filter, setFilter] = useState<Filter>('all')

  const filtered = useMemo(() => {
    if (filter === 'all') return registrations
    return registrations.filter((r) => r.status === filter)
  }, [registrations, filter])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: registrations.length }
    for (const r of registrations) {
      c[r.status] = (c[r.status] ?? 0) + 1
    }
    return c
  }, [registrations])

  return (
    <div className="flex flex-col gap-4">
      {/* Filter tabs */}
      <div className="border border-border rounded-xl p-1 w-fit flex gap-0.5 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150
              ${filter === f
                ? 'bg-fg text-bg shadow-sm'
                : 'text-muted hover:text-fg hover:bg-surface'
              }
            `}
          >
            {STATUS_LABEL[f]}
            {counts[f] != null && (
              <span className={`text-[0.6rem] font-mono ${filter === f ? 'text-bg/60' : 'text-muted'}`}>
                {counts[f]}
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card-base p-10 text-center">
          <p className="text-sm text-muted">No registrations found.</p>
        </div>
      ) : (
        <div className="card-base overflow-hidden">
          {/* Header */}
          <div className="hidden lg:grid grid-cols-[2fr_2fr_1fr_1fr_1fr] gap-4 px-5 py-3 border-b border-border bg-surface/50">
            <span className="label-mono text-[0.6rem]">Member</span>
            <span className="label-mono text-[0.6rem]">Event</span>
            <span className="label-mono text-[0.6rem]">Status</span>
            <span className="label-mono text-[0.6rem]">Amount</span>
            <span className="label-mono text-[0.6rem]">Date</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-border">
            {filtered.map((reg) => (
              <div
                key={reg.id}
                className="flex flex-col lg:grid lg:grid-cols-[2fr_2fr_1fr_1fr_1fr] gap-2 lg:gap-4 lg:items-center px-5 py-4"
              >
                {/* Member */}
                <div>
                  {reg.user_name ? (
                    <Link
                      href={`/admin/users/${reg.user_id}`}
                      className="text-sm font-medium text-fg hover:text-accent transition-colors"
                    >
                      {reg.user_name}
                    </Link>
                  ) : (
                    <p className="text-sm text-muted font-mono truncate">{reg.user_id.slice(0, 8)}…</p>
                  )}
                  {reg.user_email && (
                    <p className="text-xs text-muted truncate">{reg.user_email}</p>
                  )}
                </div>

                {/* Event */}
                <div>
                  <Link
                    href={`/compete/${reg.event_slug}`}
                    className="text-sm text-fg hover:text-accent transition-colors line-clamp-1"
                  >
                    {reg.event_title}
                  </Link>
                  {reg.event_date && (
                    <p className="text-xs font-mono text-muted">
                      {format(parseISO(reg.event_date), 'MMM d, yyyy')}
                    </p>
                  )}
                </div>

                {/* Status */}
                <div>
                  <StatusSelector
                    registrationId={reg.id}
                    currentStatus={reg.status}
                  />
                  {reg.notes && (
                    <p className="text-[0.65rem] text-muted mt-1 italic line-clamp-1">{reg.notes}</p>
                  )}
                </div>

                {/* Amount */}
                <p className="text-sm font-mono text-fg">
                  {reg.amount_paid != null
                    ? `$${(reg.amount_paid / 100).toFixed(2)}`
                    : <span className="text-muted">—</span>
                  }
                </p>

                {/* Date */}
                <p className="text-xs font-mono text-muted">
                  {format(parseISO(reg.created_at), 'MMM d, yyyy')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
