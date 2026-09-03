'use client'

import { useState } from 'react'
import type { RosterEntry, RosterMember } from '@/lib/tournamentRoster'
import {
  movePlayers,
  type MemberRef,
  type MoveDestination,
} from '@/app/admin/tournaments/[id]/teams/moveActions'

const OVERLAY = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'
const PANEL = 'bg-bg border border-border rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto'
const FIELD =
  'w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-fg focus:outline-none focus:border-fg/40'

const keyOf = (m: RosterMember) => `${m.sourceTable}:${m.sourceId}`

const refOf = (m: RosterMember): MemberRef => ({
  sourceTable: m.sourceTable,
  sourceId: m.sourceId,
  linkedRegistrationId: m.linkedRegistrationId,
})

export default function MovePlayersModal({
  eventSanityId,
  entries,
  selected,
  onClose,
  onDone,
}: {
  eventSanityId: string
  entries: RosterEntry[]
  selected: RosterMember[]
  onClose: () => void
  onDone: () => void
}) {
  const [kind, setKind] = useState<MoveDestination['kind']>('existingTeam')
  const [teamId, setTeamId] = useState('')
  const [teamName, setTeamName] = useState('')
  const [teamSize, setTeamSize] = useState(Math.max(selected.length, 2))
  const [newTeamCaptainId, setNewTeamCaptainId] = useState(selected[0]?.sourceId ?? '')
  const [replacements, setReplacements] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedKeys = new Set(selected.map(keyOf))

  // A player can only be moved into an active team on this same tournament.
  const teams = entries.filter(
    (e) =>
      e.kind === 'team' &&
      e.teamId &&
      e.teamStatus !== 'cancelled' &&
      e.teamStatus !== 'expired',
  )
  const destTeam = teams.find((t) => t.teamId === teamId)

  // Source teams losing their captain while keeping members.
  const vacancies = entries.filter((e) => {
    if (e.kind !== 'team' || !e.teamId || e.teamId === teamId) return false
    const leaving = e.members.filter((m) => selectedKeys.has(keyOf(m)))
    if (leaving.length === 0) return false
    const remaining = e.members.length - leaving.length
    return remaining > 0 && leaving.some((m) => m.isCaptain)
  })

  // Source teams that will be emptied by this move.
  const emptied = entries.filter((e) => {
    if (e.kind !== 'team' || !e.teamId || e.teamId === teamId) return false
    const leaving = e.members.filter((m) => selectedKeys.has(keyOf(m)))
    return leaving.length > 0 && leaving.length === e.members.length
  })

  const ownerOf = (m: RosterMember) => entries.find((e) => e.members.some((x) => keyOf(x) === keyOf(m)))
  const incoming = selected.filter((m) => ownerOf(m)?.teamId !== teamId).length
  const projected = (destTeam?.members.length ?? 0) + incoming
  const willOverflow =
    kind === 'existingTeam' && !!destTeam && projected > destTeam.maxMembers

  const soloBlocked =
    selected.length !== 1 ||
    (selected[0].sourceTable === 'registration_slots' && !selected[0].linkedRegistrationId)

  const allVacanciesFilled = vacancies.every((v) => replacements[v.teamId!])

  const ready =
    (kind === 'existingTeam' && !!teamId) ||
    (kind === 'newTeam' && teamName.trim().length > 0 && !!newTeamCaptainId) ||
    (kind === 'solo' && !soloBlocked)

  async function submit() {
    setBusy(true)
    setError(null)

    const destination: MoveDestination =
      kind === 'existingTeam'
        ? { kind: 'existingTeam', teamId }
        : kind === 'newTeam'
          ? { kind: 'newTeam', name: teamName, teamSize }
          : { kind: 'solo' }

    const newCaptainByTeamId: Record<string, MemberRef> = {}
    for (const v of vacancies) {
      const m = v.members.find((x) => x.sourceId === replacements[v.teamId!])
      if (m) newCaptainByTeamId[v.teamId!] = refOf(m)
    }

    const captain = selected.find((m) => m.sourceId === newTeamCaptainId)

    const result = await movePlayers(eventSanityId, selected.map(refOf), destination, {
      newCaptainByTeamId,
      confirmOverflow: true,
      confirmEmptyTeams: emptied.map((e) => e.teamId!).filter(Boolean),
      newTeamCaptain: kind === 'newTeam' && captain ? refOf(captain) : undefined,
    })

    setBusy(false)
    if (result.error) {
      setError(result.error)
      return
    }
    if (result.failed.length > 0) {
      setError(`Moved ${result.moved}, but ${result.failed.length} failed. Reload and retry.`)
      return
    }
    onDone()
  }

  const summary =
    kind === 'existingTeam'
      ? destTeam
        ? `to ${destTeam.teamName}`
        : ''
      : kind === 'newTeam'
        ? `into a new team${teamName.trim() ? ` called ${teamName.trim()}` : ''}`
        : 'to a solo entry'

  return (
    <div className={OVERLAY} role="dialog" aria-modal="true">
      <div className={PANEL}>
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-fg">
            Move {selected.length} player{selected.length === 1 ? '' : 's'}
          </h3>
          <p className="text-xs text-muted mt-1">
            {selected.map((m) => `${m.firstName} ${m.lastName}`.trim()).join(', ')}
          </p>
        </div>

        <div className="px-5 py-4 space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-muted mb-1">Destination</legend>

            <label className="flex items-center gap-2 text-sm text-fg cursor-pointer">
              <input
                type="radio"
                name="dest"
                checked={kind === 'existingTeam'}
                onChange={() => setKind('existingTeam')}
              />
              An existing team
            </label>
            {kind === 'existingTeam' && (
              <select className={FIELD} value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                <option value="">Choose a team…</option>
                {teams.map((t) => (
                  <option key={t.teamId} value={t.teamId!}>
                    {t.teamName} — {t.members.length}/{t.maxMembers}
                  </option>
                ))}
              </select>
            )}

            <label className="flex items-center gap-2 text-sm text-fg cursor-pointer">
              <input
                type="radio"
                name="dest"
                checked={kind === 'newTeam'}
                onChange={() => setKind('newTeam')}
              />
              A new team
            </label>
            {kind === 'newTeam' && (
              <div className="space-y-2 pl-6">
                <input
                  className={FIELD}
                  placeholder="Team name"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                />
                <label className="block text-xs text-muted">
                  Team size
                  <input
                    type="number"
                    min={selected.length}
                    className={FIELD}
                    value={teamSize}
                    onChange={(e) => setTeamSize(Number(e.target.value))}
                  />
                </label>
                <label className="block text-xs text-muted">
                  Captain
                  <select
                    className={FIELD}
                    value={newTeamCaptainId}
                    onChange={(e) => setNewTeamCaptainId(e.target.value)}
                  >
                    {selected.map((m) => (
                      <option key={m.sourceId} value={m.sourceId}>
                        {`${m.firstName} ${m.lastName}`.trim() || m.email}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            <label
              className={`flex items-center gap-2 text-sm cursor-pointer ${soloBlocked ? 'text-muted' : 'text-fg'}`}
            >
              <input
                type="radio"
                name="dest"
                checked={kind === 'solo'}
                onChange={() => setKind('solo')}
                disabled={soloBlocked}
              />
              No team (solo entry)
            </label>
            {soloBlocked && (
              <p className="text-xs text-muted pl-6">
                {selected.length !== 1
                  ? 'Detach one player at a time.'
                  : 'This player has no standalone registration record to keep. Create a one-person team for them instead.'}
              </p>
            )}
          </fieldset>

          {vacancies.map((v) => (
            <label key={v.teamId} className="block text-xs text-muted">
              New captain for {v.teamName}
              <select
                className={FIELD}
                value={replacements[v.teamId!] ?? ''}
                onChange={(e) =>
                  setReplacements((p) => ({ ...p, [v.teamId!]: e.target.value }))
                }
              >
                <option value="">Choose…</option>
                {v.members
                  .filter((m) => !selectedKeys.has(keyOf(m)))
                  .map((m) => (
                    <option key={m.sourceId} value={m.sourceId}>
                      {`${m.firstName} ${m.lastName}`.trim() || m.email}
                    </option>
                  ))}
              </select>
            </label>
          ))}

          <div className="space-y-1.5 text-xs border-t border-border pt-3">
            {willOverflow && destTeam && (
              <p className="text-fg">
                {destTeam.teamName} will have {projected} players, above its size of{' '}
                {destTeam.maxMembers}. The team size will be raised to {projected}.
              </p>
            )}
            {emptied.map((e) => (
              <p key={e.teamId} className="text-fg">
                {e.teamName} will be left with no players and will be marked cancelled.
              </p>
            ))}
            <p className="text-muted">
              Payment records, refunds, and registration status are not affected.
            </p>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="text-sm text-muted hover:text-fg transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={busy || !ready || !allVacanciesFilled}
            onClick={submit}
            className="px-4 py-2 bg-fg text-bg text-sm rounded-lg disabled:opacity-40 active:scale-[0.98] transition-transform"
          >
            {busy
              ? 'Moving…'
              : `Move ${selected.length} player${selected.length === 1 ? '' : 's'} ${summary}`.trim()}
          </button>
        </div>
      </div>
    </div>
  )
}
