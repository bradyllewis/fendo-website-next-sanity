'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { IconPlus, IconX } from '@/app/components/icons'

export interface LauncherEvent {
  id: string
  title: string
  dateLabel: string | null
}

/**
 * "Create team" entry point on the all-teams page. A team always belongs to one
 * tournament, so this only picks the tournament, then hands off to that
 * tournament's roster page where the create form opens (`?create=1`).
 */
export default function CreateTeamLauncher({ events }: { events: LauncherEvent[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [eventId, setEventId] = useState('')

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 btn-primary text-xs px-3 py-2"
      >
        <IconPlus className="w-3.5 h-3.5" />
        Create team
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="bg-bg border border-border rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <p className="label-mono text-[0.6rem] text-accent">NEW TEAM</p>
                <h2 className="text-base font-semibold text-fg mt-0.5">Which tournament?</h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface text-muted hover:text-fg"
                aria-label="Close"
              >
                <IconX className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {events.length === 0 ? (
                <p className="text-sm text-muted">
                  No upcoming tournaments use on-site registration. Turn on &ldquo;Requires Registration&rdquo; for a
                  tournament in Sanity to add teams to it.
                </p>
              ) : (
                <div>
                  <label className="label-mono text-[0.6rem] text-muted" htmlFor="launcher-event">
                    Tournament
                  </label>
                  <select
                    id="launcher-event"
                    className="mt-1 w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-bg text-fg focus:outline-none focus:ring-2 focus:ring-fg/20 focus:border-fg/40"
                    value={eventId}
                    onChange={(e) => setEventId(e.target.value)}
                    autoFocus
                  >
                    <option value="">Choose a tournament…</option>
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.title}
                        {ev.dateLabel ? ` — ${ev.dateLabel}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <button onClick={() => setOpen(false)} className="flex-1 btn-outline text-sm py-2.5">
                  Cancel
                </button>
                <button
                  onClick={() => router.push(`/admin/tournaments/${eventId}/teams?create=1`)}
                  disabled={!eventId}
                  className="flex-1 btn-primary text-sm py-2.5 disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
