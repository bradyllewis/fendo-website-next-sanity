'use client'

import { useState, useMemo, useRef } from 'react'
import { format } from 'date-fns'
import { useRouter } from 'next/navigation'
import {
  IconSearch,
  IconX,
  IconTrophy,
  IconLoader,
  IconCheck,
} from '@/app/components/icons'
import type { DeleteTournamentResult } from '@/app/api/admin/delete-tournament/route'

// ─── Types ────────────────────────────────────────────────────────────────────

interface EventStats {
  event_sanity_id: string
  paid_count: number
  total_revenue: number
}

interface TournamentEvent {
  _id: string
  title: string
  slug: string
  eventType: string
  status: string
  startDate: string | null
  endDate?: string | null
  location?: { venueName?: string; city?: string; state?: string } | null
  spotsTotal?: number | null
  entryFee?: number | null
  stats: EventStats
}

interface TournamentsClientProps {
  events: TournamentEvent[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EVENT_TYPE_LABELS: Record<string, string> = {
  tournament: 'Tournament',
  clinic: 'Clinic',
  community_round: 'Community Round',
  sponsored_championship: 'Championship',
  meetup: 'Meetup',
}

const STATUS_STYLES: Record<string, string> = {
  upcoming: 'text-fg bg-mustard/20 border-mustard/30',
  registration_open: 'text-green bg-green/10 border-green/20',
  waitlist: 'text-fg bg-accent/20 border-accent/30',
  completed: 'text-muted bg-surface border-border',
  cancelled: 'text-red-600 bg-red-50 border-red-200',
}

const TYPE_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'tournament', label: 'Tournament' },
  { key: 'clinic', label: 'Clinic' },
  { key: 'community_round', label: 'Community Round' },
  { key: 'sponsored_championship', label: 'Championship' },
  { key: 'meetup', label: 'Meetup' },
]

function formatCents(cents: number) {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}`
}

const STUDIO_BASE = process.env.NEXT_PUBLIC_SANITY_STUDIO_URL?.replace(/\/$/, '') || 'http://localhost:3333'

function studioEventUrl(eventId: string) {
  return `${STUDIO_BASE}/structure/event;${eventId}`
}

// ─── Delete Modal ─────────────────────────────────────────────────────────────

interface DeleteModalProps {
  event: TournamentEvent
  onClose: () => void
  onSuccess: (eventId: string) => void
}

function DeleteModal({ event, onClose, onSuccess }: DeleteModalProps) {
  const [sendEmails, setSendEmails] = useState(false)
  const [processRefunds, setProcessRefunds] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DeleteTournamentResult | null>(null)
  const [fatalError, setFatalError] = useState<string | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  const confirmed = confirmText.trim().toLowerCase() === event.title.trim().toLowerCase()

  async function handleDelete() {
    if (!confirmed || loading) return
    setLoading(true)
    setFatalError(null)

    try {
      const res = await fetch('/api/admin/delete-tournament', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventSanityId: event._id,
          eventSlug: event.slug,
          eventTitle: event.title,
          eventDate: event.startDate,
          sendEmails,
          processRefunds,
          skipSanityDeletion: true,
        }),
      })

      const data: DeleteTournamentResult = await res.json()

      if (!res.ok && !data.success) {
        setFatalError((data as unknown as { error?: string }).error ?? 'Deletion failed')
        setLoading(false)
        return
      }

      setResult(data)
      if (data.success) {
        onSuccess(event._id)
      }
    } catch (err: unknown) {
      const e = err as { message?: string }
      setFatalError(e.message ?? 'Network error')
      setLoading(false)
    }
  }

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current && !loading && !result) onClose()
  }

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="bg-bg border border-border rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <p className="label-mono text-[0.6rem] text-red-500">DANGER ZONE</p>
            <h2 className="text-base font-semibold text-fg mt-0.5">Delete Tournament</h2>
          </div>
          {!loading && !result && (
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface transition-colors text-muted hover:text-fg"
            >
              <IconX className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Result view */}
        {result ? (
          <div className="p-5 space-y-4">
            <div className={`rounded-xl p-4 border ${result.success ? 'bg-green/5 border-green/20' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                {result.success ? (
                  <IconCheck className="w-4 h-4 text-green" />
                ) : (
                  <IconX className="w-4 h-4 text-red-500" />
                )}
                <p className="text-sm font-semibold text-fg">
                  {result.success ? 'Tournament deleted successfully' : 'Deletion completed with warnings'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono text-muted mt-3">
                <span>Refunds processed: <strong className="text-fg">{result.refundsProcessed}</strong></span>
                <span>Refunds failed: <strong className={result.refundsFailed > 0 ? 'text-red-500' : 'text-fg'}>{result.refundsFailed}</strong></span>
                <span>Sessions cancelled: <strong className="text-fg">{result.sessionsCancelled}</strong></span>
                <span>Emails sent: <strong className="text-fg">{result.emailsSent}</strong></span>
                <span>Records cancelled: <strong className="text-fg">{result.recordsCancelled}</strong></span>
                <span>Email failures: <strong className={result.emailsFailed > 0 ? 'text-red-500' : 'text-fg'}>{result.emailsFailed}</strong></span>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="rounded-xl bg-surface border border-border p-4">
                <p className="text-xs font-semibold text-muted mb-2">Warnings / Errors</p>
                <ul className="space-y-1">
                  {result.errors.map((err, i) => (
                    <li key={i} className="text-xs text-muted font-mono break-all">&bull; {err}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-xl border border-border bg-surface p-4 space-y-2">
              <p className="text-xs font-semibold text-fg">One step remains</p>
              <p className="text-xs text-muted leading-relaxed">
                All registrations and payment records have been cleaned up. To finish, remove the event from Sanity Studio — it takes just a moment.
              </p>
              <a
                href={studioEventUrl(event._id)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline mt-1"
              >
                Open event in Sanity Studio
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 opacity-70">
                  <path fillRule="evenodd" d="M4.22 11.78a.75.75 0 0 1 0-1.06l5.25-5.25H5.75a.75.75 0 0 1 0-1.5h5.5a.75.75 0 0 1 .75.75v5.5a.75.75 0 0 1-1.5 0V6.56l-5.25 5.22a.75.75 0 0 1-1.03 0Z" clipRule="evenodd" />
                </svg>
              </a>
            </div>

            <button
              onClick={onClose}
              className="w-full btn-outline text-sm py-2.5"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-5">
            {/* Event info */}
            <div className="rounded-xl bg-surface border border-border p-4">
              <p className="label-mono text-[0.6rem] text-muted mb-1">Tournament to delete</p>
              <p className="text-sm font-semibold text-fg">{event.title}</p>
              {event.startDate && (
                <p className="text-xs font-mono text-muted mt-0.5">
                  {format(new Date(event.startDate), 'MMM d, yyyy')}
                </p>
              )}
              <div className="flex items-center gap-3 mt-2 text-xs font-mono text-muted">
                <span>{event.stats.paid_count} paid registrations</span>
                {event.stats.total_revenue > 0 && (
                  <span>{formatCents(event.stats.total_revenue)} collected</span>
                )}
              </div>
            </div>

            {/* Options */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-fg">Deletion options</p>

              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative mt-0.5 shrink-0">
                  <input
                    type="checkbox"
                    checked={sendEmails}
                    onChange={(e) => setSendEmails(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-4 h-4 rounded border border-border bg-bg peer-checked:bg-fg peer-checked:border-fg transition-all flex items-center justify-center">
                    {sendEmails && <IconCheck className="w-2.5 h-2.5 text-bg" />}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-fg font-medium leading-snug">Send cancellation emails</p>
                  <p className="text-xs text-muted mt-0.5">
                    Notify all registered players, team members, and sponsors via email. Includes refund info if refunds are selected.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative mt-0.5 shrink-0">
                  <input
                    type="checkbox"
                    checked={processRefunds}
                    onChange={(e) => setProcessRefunds(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-4 h-4 rounded border border-border bg-bg peer-checked:bg-fg peer-checked:border-fg transition-all flex items-center justify-center">
                    {processRefunds && <IconCheck className="w-2.5 h-2.5 text-bg" />}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-fg font-medium leading-snug">Refund all paid registrations</p>
                  <p className="text-xs text-muted mt-0.5">
                    Issue full Stripe refunds to all confirmed payers (players + sponsors). Refunds typically appear within 5–10 business days.
                  </p>
                  {event.stats.total_revenue > 0 && (
                    <p className="text-xs font-mono text-muted mt-1">
                      ≈ {formatCents(event.stats.total_revenue)} to be refunded
                    </p>
                  )}
                </div>
              </label>
            </div>

            {/* Confirmation input */}
            <div className="space-y-2">
              <p className="text-xs text-muted">
                Type <strong className="text-fg font-mono">{event.title}</strong> to confirm deletion:
              </p>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={event.title}
                className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-bg text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-fg/20 focus:border-fg/40 transition-all"
                autoComplete="off"
              />
            </div>

            {fatalError && (
              <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg p-3">
                {fatalError}
              </p>
            )}

            {/* Warning */}
            <div className="rounded-xl bg-surface border border-border p-3.5 space-y-2.5">
              <p className="text-xs text-muted leading-relaxed">
                This will permanently cancel all registrations, expire open checkout sessions, and remove all associated payment records. <strong className="text-fg font-medium">This cannot be undone.</strong>
              </p>
              <div className="border-t border-border pt-2.5 flex items-start gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 text-muted shrink-0 mt-0.5">
                  <path fillRule="evenodd" d="M15 8A7 7 0 1 1 1 8a7 7 0 0 1 14 0ZM9 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM6.75 8a.75.75 0 0 0 0 1.5h.75v1.75a.75.75 0 0 0 1.5 0v-2.5A.75.75 0 0 0 8.25 8h-1.5Z" clipRule="evenodd" />
                </svg>
                <p className="text-xs text-muted leading-relaxed">
                  The event will remain in Sanity Studio and on the public site until you delete it there.{' '}
                  <a
                    href={studioEventUrl(event._id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline font-medium"
                  >
                    Open event in Studio →
                  </a>
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={onClose}
                className="flex-1 btn-outline text-sm py-2.5"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={!confirmed || loading}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 ${
                  confirmed && !loading
                    ? 'bg-red-600 text-white hover:bg-red-700 active:scale-[0.98]'
                    : 'bg-red-200 text-red-400 cursor-not-allowed'
                }`}
              >
                {loading ? (
                  <>
                    <IconLoader className="w-4 h-4" />
                    Deleting…
                  </>
                ) : (
                  'Delete Tournament'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TournamentsClient({ events: initialEvents }: TournamentsClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [deleteTarget, setDeleteTarget] = useState<TournamentEvent | null>(null)
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())

  const visible = useMemo(() => {
    return initialEvents
      .filter((e) => !deletedIds.has(e._id))
      .filter((e) => typeFilter === 'all' || e.eventType === typeFilter)
      .filter((e) => {
        if (!search.trim()) return true
        const q = search.toLowerCase()
        return (
          e.title.toLowerCase().includes(q) ||
          (e.location?.city ?? '').toLowerCase().includes(q) ||
          (e.location?.venueName ?? '').toLowerCase().includes(q)
        )
      })
  }, [initialEvents, deletedIds, typeFilter, search])

  function handleDeleteSuccess(eventId: string) {
    setDeletedIds((prev) => new Set([...prev, eventId]))
    // Refresh server data in background so stats update
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <h2 className="text-sm font-semibold text-fg flex items-center gap-2">
          <IconTrophy className="w-4 h-4 text-muted" />
          All Tournaments
          <span className="label-mono text-[0.6rem] text-muted">{visible.length} of {initialEvents.filter(e => !deletedIds.has(e._id)).length}</span>
        </h2>

        {/* Search */}
        <div className="relative sm:ml-auto sm:w-64">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tournaments…"
            className="w-full pl-9 pr-3 py-2 text-xs border border-border rounded-lg bg-bg text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-fg/20 focus:border-fg/40 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-fg"
            >
              <IconX className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Type filter strip */}
      <div className="flex items-center gap-1 flex-wrap">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setTypeFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
              typeFilter === f.key
                ? 'bg-fg text-bg shadow-sm'
                : 'text-muted hover:text-fg hover:bg-surface'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card-base overflow-hidden">
        {visible.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-muted">No tournaments found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <th className="text-left px-4 py-3 text-[0.65rem] font-mono font-medium text-muted uppercase tracking-wider">
                    Tournament
                  </th>
                  <th className="hidden md:table-cell text-left px-4 py-3 text-[0.65rem] font-mono font-medium text-muted uppercase tracking-wider">
                    Type
                  </th>
                  <th className="text-left px-4 py-3 text-[0.65rem] font-mono font-medium text-muted uppercase tracking-wider">
                    Status
                  </th>
                  <th className="hidden lg:table-cell text-left px-4 py-3 text-[0.65rem] font-mono font-medium text-muted uppercase tracking-wider">
                    Date
                  </th>
                  <th className="hidden sm:table-cell text-right px-4 py-3 text-[0.65rem] font-mono font-medium text-muted uppercase tracking-wider">
                    Paid Regs
                  </th>
                  <th className="hidden sm:table-cell text-right px-4 py-3 text-[0.65rem] font-mono font-medium text-muted uppercase tracking-wider">
                    Revenue
                  </th>
                  <th className="text-right px-4 py-3 text-[0.65rem] font-mono font-medium text-muted uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map((ev) => (
                  <tr key={ev._id} className="hover:bg-surface/50 transition-colors duration-100">
                    {/* Name */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col min-w-0">
                        <a
                          href={`/compete/${ev.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-fg hover:text-accent transition-colors truncate max-w-[200px]"
                        >
                          {ev.title}
                        </a>
                        {ev.location?.city && (
                          <span className="text-[0.65rem] font-mono text-muted mt-0.5 truncate">
                            {ev.location.city}{ev.location.state ? `, ${ev.location.state}` : ''}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Type */}
                    <td className="hidden md:table-cell px-4 py-3">
                      <span className="text-xs font-mono text-muted">
                        {EVENT_TYPE_LABELS[ev.eventType] ?? ev.eventType}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[0.6rem] font-mono font-medium border ${STATUS_STYLES[ev.status] ?? 'text-muted bg-surface border-border'}`}
                      >
                        {ev.status.replace('_', ' ')}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="hidden lg:table-cell px-4 py-3">
                      <span className="text-xs font-mono text-muted">
                        {ev.startDate ? format(new Date(ev.startDate), 'MMM d, yyyy') : '—'}
                      </span>
                    </td>

                    {/* Paid Regs */}
                    <td className="hidden sm:table-cell px-4 py-3 text-right">
                      <span className="text-xs font-mono text-fg">
                        {ev.stats.paid_count}
                      </span>
                    </td>

                    {/* Revenue */}
                    <td className="hidden sm:table-cell px-4 py-3 text-right">
                      <span className="text-xs font-mono text-fg">
                        {ev.stats.total_revenue > 0 ? formatCents(ev.stats.total_revenue) : '—'}
                      </span>
                    </td>

                    {/* Delete */}
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setDeleteTarget(ev)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-all duration-150 active:scale-[0.97]"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete modal */}
      {deleteTarget && (
        <DeleteModal
          event={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onSuccess={(id) => {
            setDeleteTarget(null)
            handleDeleteSuccess(id)
          }}
        />
      )}
    </div>
  )
}
