'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { updateSponsorshipStatus } from '@/app/admin/actions'
import type { SponsorRegistration } from '@/lib/supabase/types'

interface Props {
  sponsorships: SponsorRegistration[]
}

const STATUS_FILTERS = ['all', 'paid', 'invoiced', 'pending', 'cancelled', 'refunded'] as const
type Filter = typeof STATUS_FILTERS[number]

const STATUS_LABEL: Record<string, string> = {
  all:       'All',
  paid:      'Paid',
  invoiced:  'Invoiced',
  pending:   'Pending',
  cancelled: 'Cancelled',
  refunded:  'Refunded',
}

const STATUS_STYLES: Record<string, string> = {
  paid:      'text-green bg-green/10 border border-green/30',
  invoiced:  'text-mustard bg-mustard/20 border border-mustard/40',
  pending:   'text-muted bg-surface border border-border',
  cancelled: 'text-danger bg-danger/10 border border-danger/20',
  refunded:  'text-muted bg-surface border border-border',
}

export default function SponsorshipsTable({ sponsorships }: Props) {
  const [filter, setFilter] = useState<Filter>('all')

  const filtered = useMemo(() => {
    if (filter === 'all') return sponsorships
    return sponsorships.filter(s => s.status === filter)
  }, [sponsorships, filter])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: sponsorships.length }
    for (const s of sponsorships) {
      c[s.status] = (c[s.status] ?? 0) + 1
    }
    return c
  }, [sponsorships])

  return (
    <div className="flex flex-col gap-4">
      {/* Filter tabs */}
      <div className="border border-border rounded-xl p-1 w-fit flex gap-0.5 flex-wrap">
        {STATUS_FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150
              ${filter === f ? 'bg-fg text-bg shadow-sm' : 'text-muted hover:text-fg hover:bg-surface'}
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
          <p className="text-sm text-muted">No sponsorships found.</p>
        </div>
      ) : (
        <div className="card-base overflow-hidden">
          {/* Header */}
          <div className="hidden lg:grid grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr] gap-4 px-5 py-3 border-b border-border bg-surface/50">
            <span className="label-mono text-[0.6rem]">Company</span>
            <span className="label-mono text-[0.6rem]">Event</span>
            <span className="label-mono text-[0.6rem]">Level</span>
            <span className="label-mono text-[0.6rem]">Status</span>
            <span className="label-mono text-[0.6rem]">Amount</span>
            <span className="label-mono text-[0.6rem]">Date</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-border">
            {filtered.map(s => (
              <div
                key={s.id}
                className="flex flex-col lg:grid lg:grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr] gap-2 lg:gap-4 lg:items-center px-5 py-4"
              >
                {/* Company */}
                <div>
                  <p className="text-sm font-medium text-fg">{s.company_name}</p>
                  <p className="text-xs text-muted">{s.primary_contact}</p>
                  <p className="text-xs text-muted truncate">{s.email}</p>
                </div>

                {/* Event */}
                <div>
                  <Link
                    href={`/compete/${s.event_slug}`}
                    className="text-sm text-fg hover:text-accent transition-colors line-clamp-1"
                  >
                    {s.event_title}
                  </Link>
                  {s.event_date && (
                    <p className="text-xs font-mono text-muted">
                      {format(parseISO(s.event_date), 'MMM d, yyyy')}
                    </p>
                  )}
                </div>

                {/* Level */}
                <div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[0.6rem] font-mono uppercase tracking-wider bg-surface border border-border text-muted">
                    {s.sponsorship_level}
                  </span>
                  <p className="text-[0.65rem] font-mono text-muted mt-0.5">
                    {s.payment_method === 'invoice' ? 'Invoice' : 'Card/ACH'}
                  </p>
                </div>

                {/* Status */}
                <SponsorStatusSelector sponsorshipId={s.id} currentStatus={s.status} statusStyles={STATUS_STYLES} />

                {/* Amount */}
                <p className="text-sm font-mono text-fg">
                  {s.amount_paid != null
                    ? `$${(s.amount_paid / 100).toFixed(2)}`
                    : s.sponsorship_level_price != null
                      ? <span className="text-muted">${(s.sponsorship_level_price / 100).toFixed(2)}</span>
                      : <span className="text-muted">—</span>
                  }
                </p>

                {/* Date */}
                <p className="text-xs font-mono text-muted">
                  {format(parseISO(s.created_at), 'MMM d, yyyy')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SponsorStatusSelector({
  sponsorshipId,
  currentStatus,
  statusStyles,
}: {
  sponsorshipId: string
  currentStatus: string
  statusStyles: Record<string, string>
}) {
  const [status, setStatus] = useState(currentStatus)
  const [saving, setSaving] = useState(false)

  const handleChange = async (next: string) => {
    setSaving(true)
    setStatus(next)
    await updateSponsorshipStatus(sponsorshipId, next)
    setSaving(false)
  }

  return (
    <div>
      <select
        value={status}
        onChange={e => handleChange(e.target.value)}
        disabled={saving}
        className={`text-[0.65rem] font-mono px-2 py-1 rounded-lg border cursor-pointer transition-all ${statusStyles[status] ?? 'text-muted bg-surface border-border'} ${saving ? 'opacity-60' : ''}`}
      >
        {['pending', 'paid', 'invoiced', 'cancelled', 'refunded'].map(s => (
          <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
        ))}
      </select>
    </div>
  )
}
