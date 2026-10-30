'use client'

import { useState } from 'react'
import { SHIRT_SIZES } from '@/lib/shirt-sizes'
import { IconCheck, IconLoader, IconX } from '@/app/components/icons'
import type { RosterEntry } from '@/lib/tournamentRoster'
import type { NewPlayerPayment, TeamFormat, UnpaidSpot } from '@/lib/rosterCreate'
import {
  addPlayersToTeam,
  createTeam,
  type TeamActionResult,
} from '@/app/admin/tournaments/[id]/teams/createActions'

/** Registration settings the form needs to price and capacity-check a team. */
export interface TeamFormEvent {
  entryFeeCents: number
  spotsTotal: number | null
  seatsFilled: number
}

const OVERLAY = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'
const PANEL = 'bg-bg border border-border rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto'
const FIELD =
  'w-full px-3 py-2 text-sm border border-border rounded-lg bg-bg text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-fg/20 focus:border-fg/40 transition-all'
const LABEL = 'label-mono text-[0.6rem] text-muted'

const TEAM_SIZE: Record<TeamFormat, number> = { duo: 2, team: 4 }

interface PlayerRow {
  firstName: string
  lastName: string
  email: string
  phone: string
  shirtSize: string
}

const emptyRow = (): PlayerRow => ({ firstName: '', lastName: '', email: '', phone: '', shirtSize: '' })

/** A row with nothing typed in it is an open spot, not a player. */
const isBlank = (r: PlayerRow) => !r.firstName.trim() && !r.lastName.trim() && !r.email.trim() && !r.phone.trim()

function formatDollars(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function RadioCard({
  checked,
  onSelect,
  title,
  description,
}: {
  checked: boolean
  onSelect: () => void
  title: string
  description: string
}) {
  return (
    <label
      className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${checked ? 'border-fg bg-surface' : 'border-border hover:bg-surface/60'}`}
    >
      <input type="radio" checked={checked} onChange={onSelect} className="mt-1 accent-fg" />
      <span>
        <span className="block text-sm font-medium text-fg">{title}</span>
        <span className="block text-xs text-muted mt-0.5">{description}</span>
      </span>
    </label>
  )
}

/**
 * Creates a new team on a tournament, or — when `team` is given — adds new
 * players to that existing team. Blank player rows are left as open spots.
 */
export default function TeamFormModal({
  eventSanityId,
  event,
  team,
  onClose,
  onDone,
}: {
  eventSanityId: string
  event: TeamFormEvent
  team?: RosterEntry
  onClose: () => void
  onDone: () => void
}) {
  const isAdd = !!team
  const openSpots = team ? Math.max(0, team.maxMembers - team.members.length) : 0

  const [teamName, setTeamName] = useState('')
  const [teamFormat, setTeamFormat] = useState<TeamFormat>('team')
  const [walkUpSong, setWalkUpSong] = useState('')
  const [rows, setRows] = useState<PlayerRow[]>(() =>
    Array.from({ length: isAdd ? openSpots : TEAM_SIZE.team }, emptyRow),
  )
  const [captainIndex, setCaptainIndex] = useState(0)
  const isFree = event.entryFeeCents <= 0
  const [payment, setPayment] = useState<NewPlayerPayment | null>(isFree ? 'paid' : null)
  const [notify, setNotify] = useState(true)
  const [confirmOver, setConfirmOver] = useState(false)
  const [serverOverCapacity, setServerOverCapacity] = useState(false)
  const [unpaidSpots, setUnpaidSpots] = useState<UnpaidSpot[]>([])
  const [confirmReplace, setConfirmReplace] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<TeamActionResult | null>(null)

  const players = rows.filter((r) => !isBlank(r))
  const projected = event.seatsFilled + players.length - unpaidSpots.length
  const overCapacity =
    serverOverCapacity || (event.spotsTotal != null && projected > event.spotsTotal)

  // The spots belong to the players as last submitted, so any edit voids them.
  function clearUnpaidSpots() {
    setUnpaidSpots([])
    setConfirmReplace(false)
  }

  function changeFormat(next: TeamFormat) {
    setTeamFormat(next)
    const size = TEAM_SIZE[next]
    setRows((prev) =>
      prev.length > size ? prev.slice(0, size) : [...prev, ...Array.from({ length: size - prev.length }, emptyRow)],
    )
    if (captainIndex >= size) setCaptainIndex(0)
    clearUnpaidSpots()
  }

  function updateRow(index: number, field: keyof PlayerRow, value: string) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)))
    clearUnpaidSpots()
  }

  // First problem blocking submit, shown beside the button.
  let issue: string | null = null
  if (!isAdd && !teamName.trim()) issue = 'Enter a team name.'
  else if (players.length === 0) issue = 'Add at least one player.'
  else if (players.some((r) => !r.firstName.trim() || !r.lastName.trim() || !r.email.trim())) {
    issue = 'Each player needs a first name, last name and email.'
  } else if (!isAdd && isBlank(rows[captainIndex] ?? emptyRow())) issue = 'Choose a captain from the players entered.'
  else if (!payment) issue = 'Choose how these players pay.'
  else if (unpaidSpots.length > 0 && !confirmReplace) issue = 'Confirm replacing the unpaid registration.'
  else if (overCapacity && !confirmOver) issue = 'Confirm going over capacity.'

  async function submit() {
    if (issue || !payment) return
    setBusy(true)
    setError(null)

    // Captain index counts only the rows actually submitted.
    const submitted = rows.map((r, i) => ({ r, i })).filter(({ r }) => !isBlank(r))
    const playerInputs = submitted.map(({ r }) => ({
      firstName: r.firstName,
      lastName: r.lastName,
      email: r.email,
      phone: r.phone || null,
      shirtSize: r.shirtSize || null,
    }))
    const confirmReplaceSpots = confirmReplace ? unpaidSpots.map((s) => s.sourceId) : []

    let res: TeamActionResult
    try {
      res = isAdd
        ? await addPlayersToTeam(
            eventSanityId,
            {
              teamId: team.teamId!,
              players: playerInputs,
              payment,
              confirmOverCapacity: confirmOver,
              confirmReplaceSpots,
            },
            notify,
          )
        : await createTeam(
            eventSanityId,
            {
              teamName,
              format: teamFormat,
              walkUpSong: walkUpSong || null,
              players: playerInputs,
              captainIndex: submitted.findIndex(({ i }) => i === captainIndex),
              payment,
              confirmOverCapacity: confirmOver,
              confirmReplaceSpots,
            },
            notify,
          )
    } catch (err) {
      console.error(isAdd ? 'addPlayersToTeam failed' : 'createTeam failed', err)
      res = { error: 'Request failed. Reload the page to see what was saved, then retry.' }
    }

    setBusy(false)
    if (res.unpaidSpots) {
      // Shown as a confirmation below, so there is no error to display.
      setUnpaidSpots(res.unpaidSpots)
      setConfirmReplace(false)
      return
    }
    if (res.error) {
      // Seats may have filled since the page loaded; let the admin confirm.
      if (res.overCapacity) setServerOverCapacity(true)
      setError(res.error)
      return
    }
    setDone(res)
  }

  const title = isAdd ? `Add players to ${team.teamName ?? 'team'}` : 'Create team'
  const submitLabel = !isAdd
    ? 'Create team'
    : players.length > 0
      ? `Add ${players.length} player${players.length === 1 ? '' : 's'}`
      : 'Add players'

  return (
    <div className={OVERLAY} role="dialog" aria-modal="true" onClick={(e) => e.target === e.currentTarget && !busy && !done && onClose()}>
      <div className={PANEL}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <p className="label-mono text-[0.6rem] text-accent">{isAdd ? 'ROSTER' : 'NEW TEAM'}</p>
            <h2 className="text-base font-semibold text-fg mt-0.5">{title}</h2>
          </div>
          {!busy && (
            <button
              onClick={done ? onDone : onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface text-muted hover:text-fg"
              aria-label="Close"
            >
              <IconX className="w-4 h-4" />
            </button>
          )}
        </div>

        {done ? (
          <div className="p-5 space-y-4">
            <div className="rounded-xl bg-green/10 border border-green/20 p-4 flex items-start gap-3">
              <IconCheck className="w-5 h-5 text-green shrink-0 mt-0.5" />
              <div className="text-sm text-fg space-y-1">
                <p>
                  {isAdd ? (
                    <>
                      Added {players.length} player{players.length === 1 ? '' : 's'} to <strong>{done.teamName}</strong>.
                    </>
                  ) : (
                    <>
                      Created <strong>{done.teamName}</strong> with {players.length} player
                      {players.length === 1 ? '' : 's'}.
                    </>
                  )}
                </p>
                <p className="text-muted text-xs">
                  {done.emailed
                    ? `Email sent to ${done.emailed} player${done.emailed === 1 ? '' : 's'}.`
                    : 'No emails were sent.'}
                </p>
              </div>
            </div>
            <button onClick={onDone} className="w-full btn-primary text-sm py-2.5">
              Done
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-6">
            {/* Team details */}
            {!isAdd && (
              <div className="space-y-3">
                <div className="grid sm:grid-cols-[1fr_auto] gap-3">
                  <div>
                    <label className={LABEL} htmlFor="team-name">Team name</label>
                    <input
                      id="team-name"
                      className={`${FIELD} mt-1`}
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div>
                    <span className={LABEL}>Format</span>
                    <div className="mt-1 flex border border-border rounded-lg p-1 w-fit">
                      {(['duo', 'team'] as const).map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => changeFormat(f)}
                          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${teamFormat === f ? 'bg-fg text-bg shadow-sm' : 'text-muted hover:text-fg'}`}
                        >
                          {f === 'duo' ? 'Duo · 2' : 'Foursome · 4'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <label className={LABEL} htmlFor="walk-up-song">Walk-up song (optional)</label>
                  <input
                    id="walk-up-song"
                    className={`${FIELD} mt-1`}
                    value={walkUpSong}
                    onChange={(e) => setWalkUpSong(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Players */}
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-fg">Players</p>
                <p className="text-xs text-muted mt-0.5">
                  {isAdd
                    ? `${team.teamName ?? 'This team'} has ${openSpots} open spot${openSpots === 1 ? '' : 's'}. Leave a row blank to keep it open.`
                    : 'Leave a row blank to keep that spot open. You can add players later.'}
                </p>
              </div>

              {rows.length === 0 && (
                <p className="text-xs text-muted rounded-xl bg-surface border border-border p-3">This team is full.</p>
              )}

              {rows.map((row, i) => (
                <fieldset key={i} className="rounded-xl border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <legend className="text-xs font-medium text-fg">Player {i + 1}</legend>
                    {!isAdd && (
                      <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer">
                        <input
                          type="radio"
                          name="captain"
                          checked={captainIndex === i}
                          onChange={() => setCaptainIndex(i)}
                          aria-label={`Player ${i + 1} is captain`}
                          className="accent-fg"
                        />
                        Captain
                      </label>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                    <input
                      className={`${FIELD} sm:col-span-3`}
                      placeholder="First name"
                      aria-label={`Player ${i + 1} first name`}
                      value={row.firstName}
                      onChange={(e) => updateRow(i, 'firstName', e.target.value)}
                    />
                    <input
                      className={`${FIELD} sm:col-span-3`}
                      placeholder="Last name"
                      aria-label={`Player ${i + 1} last name`}
                      value={row.lastName}
                      onChange={(e) => updateRow(i, 'lastName', e.target.value)}
                    />
                    <input
                      className={`${FIELD} col-span-2 sm:col-span-3`}
                      type="email"
                      placeholder="Email"
                      aria-label={`Player ${i + 1} email`}
                      value={row.email}
                      onChange={(e) => updateRow(i, 'email', e.target.value)}
                    />
                    <input
                      className={`${FIELD} sm:col-span-2`}
                      type="tel"
                      placeholder="Phone (optional)"
                      aria-label={`Player ${i + 1} phone`}
                      value={row.phone}
                      onChange={(e) => updateRow(i, 'phone', e.target.value)}
                    />
                    <select
                      className={FIELD}
                      aria-label={`Player ${i + 1} shirt size`}
                      value={row.shirtSize}
                      onChange={(e) => updateRow(i, 'shirtSize', e.target.value)}
                    >
                      <option value="">Shirt</option>
                      {SHIRT_SIZES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </fieldset>
              ))}
            </div>

            {/* Payment */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-fg">Payment</p>
              {isFree ? (
                <p className="text-xs text-muted">This tournament is free, so players are confirmed right away.</p>
              ) : (
                <>
                  <RadioCard
                    checked={payment === 'paid'}
                    onSelect={() => setPayment('paid')}
                    title="Mark as paid"
                    description="Paid outside the site (cash, check, transfer) or complimentary. Spots are confirmed now and nothing is charged."
                  />
                  <RadioCard
                    checked={payment === 'payLink'}
                    onSelect={() => setPayment('payLink')}
                    title={`Send payment links · ${formatDollars(event.entryFeeCents)} each`}
                    description="Each player pays online with their own link. Spots are held for 7 days, then released if unpaid."
                  />
                </>
              )}
            </div>

            {/* Notify */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={notify}
                onChange={(e) => setNotify(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-fg"
              />
              <span>
                <span className="block text-sm text-fg">
                  {payment === 'payLink' ? 'Email each player their payment link now' : 'Email each player a registration confirmation'}
                </span>
                {payment === 'payLink' && (
                  <span className="block text-xs text-muted mt-0.5">
                    If you skip this, send the links later with Payment reminder.
                  </span>
                )}
              </span>
            </label>

            {/* Unpaid spots */}
            {unpaidSpots.length > 0 && (
              <label className="flex items-start gap-3 rounded-xl border border-mustard/40 bg-mustard/10 p-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmReplace}
                  onChange={(e) => setConfirmReplace(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-fg"
                />
                <span className="text-xs text-fg space-y-1">
                  <span className="block">
                    Cancel {unpaidSpots.length === 1 ? 'this unpaid registration' : 'these unpaid registrations'} and add
                    the {unpaidSpots.length === 1 ? 'player' : 'players'} here. Any open checkout or payment link stops working.
                  </span>
                  {unpaidSpots.map((s) => (
                    <span key={s.sourceId} className="block text-muted">
                      {s.playerName} · {s.teamName ?? 'Solo'} · {s.status.replace(/_/g, ' ')}
                    </span>
                  ))}
                </span>
              </label>
            )}

            {/* Capacity */}
            {overCapacity && (
              <label className="flex items-start gap-3 rounded-xl border border-mustard/40 bg-mustard/10 p-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmOver}
                  onChange={(e) => setConfirmOver(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-fg"
                />
                <span className="text-xs text-fg">
                  {event.spotsTotal != null
                    ? `This puts the tournament at ${projected} of ${event.spotsTotal} spots. `
                    : 'This tournament is over capacity. '}
                  Add {players.length === 1 ? 'this player' : 'these players'} anyway.
                </span>
              </label>
            )}

            {error && <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}

            <div className="flex flex-wrap items-center justify-end gap-3 pt-1 border-t border-border">
              {issue && <p className="text-xs text-muted mr-auto pt-3">{issue}</p>}
              <div className="flex gap-3 pt-3">
                <button onClick={onClose} className="btn-outline text-sm px-4 py-2.5" disabled={busy}>
                  Cancel
                </button>
                <button
                  onClick={submit}
                  disabled={busy || !!issue}
                  className="flex items-center justify-center gap-2 btn-primary text-sm px-4 py-2.5 disabled:opacity-50"
                >
                  {busy ? <IconLoader className="w-4 h-4" /> : submitLabel}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
