'use client'

import { useState } from 'react'
import type { RosterEntry } from '@/lib/tournamentRoster'
import { setTeamCaptain, type MemberRef } from '@/app/admin/tournaments/[id]/teams/moveActions'

const OVERLAY = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'
const PANEL = 'bg-bg border border-border rounded-2xl w-full max-w-md shadow-2xl'
const FIELD =
  'w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-fg focus:outline-none focus:border-fg/40'

export default function ChangeCaptainModal({
  eventSanityId,
  entry,
  onClose,
  onDone,
}: {
  eventSanityId: string
  entry: RosterEntry
  onClose: () => void
  onDone: () => void
}) {
  const current = entry.members.find((m) => m.isCaptain)
  const [choice, setChoice] = useState(current?.sourceId ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    const m = entry.members.find((x) => x.sourceId === choice)
    if (!m || !entry.teamId) return
    setBusy(true)
    setError(null)

    const ref: MemberRef = {
      sourceTable: m.sourceTable,
      sourceId: m.sourceId,
      linkedRegistrationId: m.linkedRegistrationId,
    }
    const result = await setTeamCaptain(eventSanityId, entry.teamId, ref)

    setBusy(false)
    if (result.error) {
      setError(result.error)
      return
    }
    onDone()
  }

  return (
    <div className={OVERLAY} role="dialog" aria-modal="true">
      <div className={PANEL}>
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-fg">Change captain</h3>
          <p className="text-xs text-muted mt-1">{entry.teamName}</p>
        </div>

        <div className="px-5 py-4 space-y-3">
          <select className={FIELD} value={choice} onChange={(e) => setChoice(e.target.value)}>
            {entry.members.map((m) => (
              <option key={m.sourceId} value={m.sourceId}>
                {`${m.firstName} ${m.lastName}`.trim() || m.email}
                {m.isCaptain ? ' (current captain)' : ''}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted">
            The new captain takes over managing this team&apos;s invites and player details.
            Payment records are not affected.
          </p>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-3">
          <button onClick={onClose} className="text-sm text-muted hover:text-fg transition-colors">
            Cancel
          </button>
          <button
            disabled={busy || !choice || choice === current?.sourceId}
            onClick={submit}
            className="px-4 py-2 bg-fg text-bg text-sm rounded-lg disabled:opacity-40 active:scale-[0.98] transition-transform"
          >
            {busy ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
