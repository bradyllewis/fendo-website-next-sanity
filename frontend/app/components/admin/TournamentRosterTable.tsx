'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SHIRT_SIZES } from '@/lib/shirt-sizes'
import {
  IconEdit,
  IconX,
  IconCheck,
  IconLoader,
  IconUsers,
  IconUser,
  IconDownload,
  IconMail,
  IconClock,
} from '@/app/components/icons'
import { isUnpaidSlotMember, type RosterEntry, type RosterMember } from '@/lib/tournamentRoster'
import {
  updateMember,
  updateTeamName,
  cancelMember,
  cancelTeam,
  sendTournamentReminder,
  sendPaymentReminders,
} from '@/app/admin/tournaments/[id]/teams/actions'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCents(cents: number | null): string {
  if (cents == null) return '—'
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const STATUS_STYLES: Record<string, string> = {
  paid: 'text-green bg-green/10 border-green/20',
  pending: 'text-fg bg-mustard/20 border-mustard/30',
  captain_registered: 'text-green bg-green/10 border-green/20',
  claimed: 'text-green bg-green/10 border-green/20',
  invited: 'text-muted bg-surface border-border',
  payment_started: 'text-fg bg-mustard/20 border-mustard/30',
  cancelled: 'text-red-600 bg-red-50 border-red-200',
  refunded: 'text-red-600 bg-red-50 border-red-200',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[0.6rem] font-mono font-medium border ${STATUS_STYLES[status] ?? 'text-muted bg-surface border-border'}`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  )
}

const OVERLAY = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'
const PANEL = 'bg-bg border border-border rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto'
const FIELD =
  'w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-bg text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-fg/20 focus:border-fg/40 transition-all'

// ─── Edit member modal ──────────────────────────────────────────────────────

function EditMemberModal({
  eventSanityId,
  member,
  onClose,
  onSaved,
}: {
  eventSanityId: string
  member: RosterMember
  onClose: () => void
  onSaved: () => void
}) {
  const [firstName, setFirstName] = useState(member.firstName)
  const [lastName, setLastName] = useState(member.lastName)
  const [email, setEmail] = useState(member.email)
  const [shirtSize, setShirtSize] = useState(member.shirtSize ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setLoading(true)
    setError(null)
    const res = await updateMember(
      eventSanityId,
      {
        sourceTable: member.sourceTable,
        sourceId: member.sourceId,
        linkedRegistrationId: member.linkedRegistrationId,
      },
      { firstName, lastName, email, shirtSize: shirtSize || null },
    )
    if (res.error) {
      setError(res.error)
      setLoading(false)
      return
    }
    onSaved()
  }

  return (
    <div className={OVERLAY} onClick={(e) => e.target === e.currentTarget && !loading && onClose()}>
      <div className={PANEL}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-base font-semibold text-fg">Edit member</h2>
          {!loading && (
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface text-muted hover:text-fg">
              <IconX className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-mono text-[0.6rem] text-muted">First name</label>
              <input className={`${FIELD} mt-1`} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div>
              <label className="label-mono text-[0.6rem] text-muted">Last name</label>
              <input className={`${FIELD} mt-1`} value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label-mono text-[0.6rem] text-muted">Email</label>
            <input className={`${FIELD} mt-1`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label-mono text-[0.6rem] text-muted">Shirt size</label>
            <select className={`${FIELD} mt-1`} value={shirtSize} onChange={(e) => setShirtSize(e.target.value)}>
              <option value="">—</option>
              {SHIRT_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 btn-outline text-sm py-2.5" disabled={loading}>
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 btn-primary text-sm py-2.5"
            >
              {loading ? <IconLoader className="w-4 h-4" /> : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Edit team name modal ───────────────────────────────────────────────────

function EditTeamNameModal({
  eventSanityId,
  entry,
  onClose,
  onSaved,
}: {
  eventSanityId: string
  entry: RosterEntry
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(entry.teamName ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!entry.teamId) return
    setLoading(true)
    setError(null)
    const res = await updateTeamName(eventSanityId, entry.teamId, name)
    if (res.error) {
      setError(res.error)
      setLoading(false)
      return
    }
    onSaved()
  }

  return (
    <div className={OVERLAY} onClick={(e) => e.target === e.currentTarget && !loading && onClose()}>
      <div className={PANEL}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-base font-semibold text-fg">Edit team name</h2>
          {!loading && (
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface text-muted hover:text-fg">
              <IconX className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="label-mono text-[0.6rem] text-muted">Team name</label>
            <input className={`${FIELD} mt-1`} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          {error && <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 btn-outline text-sm py-2.5" disabled={loading}>
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading || !name.trim()}
              className="flex-1 flex items-center justify-center gap-2 btn-primary text-sm py-2.5"
            >
              {loading ? <IconLoader className="w-4 h-4" /> : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Confirm cancel modal ─────────────────────────────────────────────────────

interface CancelTarget {
  kind: 'member' | 'team'
  entry: RosterEntry
  member?: RosterMember
}

function ConfirmCancelModal({
  eventSanityId,
  target,
  onClose,
  onDone,
}: {
  eventSanityId: string
  target: CancelTarget
  onClose: () => void
  onDone: () => void
}) {
  const [refund, setRefund] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isTeam = target.kind === 'team'
  const affected = isTeam ? target.entry.members : target.member ? [target.member] : []
  const canRefund = affected.some((m) => !!m.paymentIntentId)
  const title = isTeam ? 'Cancel team' : 'Remove member'
  const subject = isTeam
    ? target.entry.teamName ?? 'this team'
    : target.member
      ? `${target.member.firstName} ${target.member.lastName}`.trim()
      : 'this member'

  async function handleConfirm() {
    setLoading(true)
    setError(null)
    const res = isTeam
      ? await cancelTeam(eventSanityId, target.entry.teamId!, refund && canRefund)
      : await cancelMember(
          eventSanityId,
          {
            sourceTable: target.member!.sourceTable,
            sourceId: target.member!.sourceId,
            linkedRegistrationId: target.member!.linkedRegistrationId,
            paymentIntentId: target.member!.paymentIntentId,
          },
          refund && canRefund,
        )
    if (res.error) {
      setError(res.error)
      setLoading(false)
      return
    }
    if (res.refundError) {
      // Records were cancelled but refund had issues — surface then continue.
      setError(`Cancelled, but refund issue: ${res.refundError}`)
      setTimeout(onDone, 1800)
      return
    }
    onDone()
  }

  return (
    <div className={OVERLAY} onClick={(e) => e.target === e.currentTarget && !loading && onClose()}>
      <div className={PANEL}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <p className="label-mono text-[0.6rem] text-red-500">CONFIRM</p>
            <h2 className="text-base font-semibold text-fg mt-0.5">{title}</h2>
          </div>
          {!loading && (
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface text-muted hover:text-fg">
              <IconX className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-fg">
            {isTeam ? (
              <>
                Cancel <strong>{subject}</strong> and remove all {affected.length} member
                {affected.length !== 1 ? 's' : ''} from the roster?
              </>
            ) : (
              <>
                Remove <strong>{subject}</strong> from{' '}
                {target.entry.teamName ? <strong>{target.entry.teamName}</strong> : 'this tournament'}?
              </>
            )}
          </p>

          <div className="rounded-xl bg-surface border border-border p-3 space-y-1.5 max-h-40 overflow-y-auto">
            {affected.map((m) => (
              <div key={`${m.sourceTable}-${m.sourceId}`} className="flex items-center justify-between text-xs">
                <span className="text-fg truncate">
                  {`${m.firstName} ${m.lastName}`.trim() || m.email}
                  {m.isCaptain && <span className="text-muted"> · captain</span>}
                </span>
                <span className="font-mono text-muted shrink-0 ml-2">{formatCents(m.amountPaidCents)}</span>
              </div>
            ))}
          </div>

          {canRefund && (
            <label className="flex items-start gap-3 cursor-pointer">
              <div className="relative mt-0.5 shrink-0">
                <input type="checkbox" checked={refund} onChange={(e) => setRefund(e.target.checked)} className="sr-only peer" />
                <div className="w-4 h-4 rounded border border-border bg-bg peer-checked:bg-fg peer-checked:border-fg transition-all flex items-center justify-center">
                  {refund && <IconCheck className="w-2.5 h-2.5 text-bg" />}
                </div>
              </div>
              <div>
                <p className="text-sm text-fg font-medium leading-snug">Process Stripe refund</p>
                <p className="text-xs text-muted mt-0.5">
                  Issue full Stripe refunds for paid {isTeam ? 'members' : 'registration'}. Appears in 5–10 business days.
                </p>
              </div>
            </label>
          )}

          <p className="text-xs text-muted leading-relaxed rounded-xl bg-surface border border-border p-3">
            Records are soft-cancelled (kept for audit), and the freed spot{affected.length !== 1 ? 's' : ''} become
            available again. This can be re-done manually if needed.
          </p>

          {error && <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 btn-outline text-sm py-2.5" disabled={loading}>
              Keep
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {loading ? <IconLoader className="w-4 h-4" /> : isTeam ? 'Cancel team' : 'Remove member'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Reminder modal ─────────────────────────────────────────────────────────

interface ReminderTarget {
  mode: 'tournament' | 'payment'
  entry: RosterEntry
}

function ReminderModal({
  eventSanityId,
  target,
  onClose,
}: {
  eventSanityId: string
  target: ReminderTarget
  onClose: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentCount, setSentCount] = useState<number | null>(null)

  const isPayment = target.mode === 'payment'
  const { entry } = target

  // Recipient preview, deduped by email exactly like the server action.
  const pool = isPayment ? entry.members.filter(isUnpaidSlotMember) : entry.members
  const seen = new Set<string>()
  const recipients = pool.filter((m) => {
    const email = m.email?.trim().toLowerCase()
    if (!email || seen.has(email)) return false
    seen.add(email)
    return true
  })

  const subject = entry.kind === 'team' ? entry.teamName ?? 'this team' : 'this registrant'
  const title = isPayment ? 'Send payment reminder' : 'Send tournament reminder'

  async function handleSend() {
    setLoading(true)
    setError(null)
    const res = isPayment
      ? await sendPaymentReminders(eventSanityId, entry.teamId!)
      : await sendTournamentReminder(
          eventSanityId,
          entry.kind === 'team'
            ? { teamId: entry.teamId! }
            : { soloSourceId: entry.members[0].sourceId },
        )
    if (res.error) {
      setError(res.error)
      setLoading(false)
      return
    }
    setSentCount(res.sent ?? 0)
    setLoading(false)
  }

  return (
    <div className={OVERLAY} onClick={(e) => e.target === e.currentTarget && !loading && onClose()}>
      <div className={PANEL}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <p className="label-mono text-[0.6rem] text-accent">EMAIL</p>
            <h2 className="text-base font-semibold text-fg mt-0.5">{title}</h2>
          </div>
          {!loading && (
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface text-muted hover:text-fg">
              <IconX className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="p-5 space-y-4">
          {sentCount !== null ? (
            <>
              <div className="rounded-xl bg-green/10 border border-green/20 p-4 flex items-center gap-3">
                <IconCheck className="w-5 h-5 text-green shrink-0" />
                <p className="text-sm text-fg">
                  Reminder dispatched to <strong>{sentCount}</strong> recipient{sentCount !== 1 ? 's' : ''}.
                </p>
              </div>
              <button onClick={onClose} className="w-full btn-primary text-sm py-2.5">
                Done
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-fg">
                {isPayment ? (
                  <>
                    Email a payment reminder to the unpaid member{recipients.length !== 1 ? 's' : ''} of{' '}
                    <strong>{subject}</strong>? Each gets a link to pay their own spot.
                  </>
                ) : (
                  <>
                    Email an upcoming-tournament reminder to{' '}
                    {entry.kind === 'team' ? (
                      <>all members of <strong>{subject}</strong></>
                    ) : (
                      <strong>{subject}</strong>
                    )}
                    ?
                  </>
                )}
              </p>

              {recipients.length > 0 ? (
                <div className="rounded-xl bg-surface border border-border p-3 space-y-1.5 max-h-44 overflow-y-auto">
                  {recipients.map((m) => (
                    <div key={`${m.sourceTable}-${m.sourceId}`} className="flex items-center justify-between text-xs gap-2">
                      <span className="text-fg truncate">
                        {`${m.firstName} ${m.lastName}`.trim() || m.email}
                        {m.isCaptain && <span className="text-muted"> · captain</span>}
                      </span>
                      <span className="font-mono text-muted shrink-0 truncate max-w-[45%]">{m.email || '—'}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted rounded-xl bg-surface border border-border p-3">
                  No eligible recipients{isPayment ? ' (all spots are paid)' : ''}.
                </p>
              )}

              {error && <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}

              <div className="flex gap-3 pt-1">
                <button onClick={onClose} className="flex-1 btn-outline text-sm py-2.5" disabled={loading}>
                  Cancel
                </button>
                <button
                  onClick={handleSend}
                  disabled={loading || recipients.length === 0}
                  className="flex-1 flex items-center justify-center gap-2 btn-primary text-sm py-2.5"
                >
                  {loading ? (
                    <IconLoader className="w-4 h-4" />
                  ) : (
                    <>Send to {recipients.length}</>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Member row ───────────────────────────────────────────────────────────────

function MemberRow({
  member,
  onEdit,
  onRemove,
  onRemind,
}: {
  member: RosterMember
  onEdit: () => void
  onRemove: () => void
  onRemind?: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3">
      <div className="flex-1 min-w-[140px]">
        <p className="text-sm font-medium text-fg flex items-center gap-1.5">
          {`${member.firstName} ${member.lastName}`.trim() || <span className="text-muted italic">No name</span>}
          {member.isCaptain && (
            <span className="text-[0.55rem] font-mono uppercase tracking-wide text-accent bg-accent/10 border border-accent/20 rounded px-1.5 py-0.5">
              Captain
            </span>
          )}
        </p>
        <p className="text-xs font-mono text-muted truncate">{member.email || '—'}</p>
      </div>
      <span className="text-xs font-mono text-muted w-10 text-center" title="Shirt size">
        {member.shirtSize ?? '—'}
      </span>
      <StatusBadge status={member.status} />
      <span className="text-xs font-mono text-fg w-16 text-right hidden sm:block">{formatCents(member.amountPaidCents)}</span>
      <div className="flex items-center gap-1 shrink-0">
        {onRemind && (
          <button
            onClick={onRemind}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-fg hover:bg-surface transition-colors"
            title="Send tournament reminder"
          >
            <IconMail className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={onEdit}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-fg hover:bg-surface transition-colors"
          title="Edit member"
        >
          <IconEdit className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onRemove}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-red-600 hover:bg-red-50 transition-colors"
          title="Remove member"
        >
          <IconX className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function TournamentRosterTable({
  eventSanityId,
  entries,
}: {
  eventSanityId: string
  entries: RosterEntry[]
}) {
  const router = useRouter()
  const [editMember, setEditMember] = useState<RosterMember | null>(null)
  const [editTeam, setEditTeam] = useState<RosterEntry | null>(null)
  const [cancelTarget, setCancelTarget] = useState<CancelTarget | null>(null)
  const [reminderTarget, setReminderTarget] = useState<ReminderTarget | null>(null)

  const teams = entries.filter((e) => e.kind === 'team')
  const solos = entries.filter((e) => e.kind === 'solo')

  const refresh = () => {
    setEditMember(null)
    setEditTeam(null)
    setCancelTarget(null)
    router.refresh()
  }

  if (entries.length === 0) {
    return (
      <div className="card-base p-10 text-center">
        <p className="text-sm text-muted">No active registrations for this tournament yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Teams */}
      {teams.length > 0 && (
        <div className="space-y-4">
          <h2 className="label-mono text-[0.65rem] flex items-center gap-2">
            <IconUsers className="w-3.5 h-3.5 text-muted" />
            Teams ({teams.length})
          </h2>
          <div className="space-y-4">
            {teams.map((entry) => (
              <div key={entry.teamId} className="card-base overflow-hidden">
                {/* Team header */}
                <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-surface/60 border-b border-border">
                  <div className="flex-1 min-w-[160px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-fg">{entry.teamName ?? 'Unnamed team'}</p>
                      <span className="text-[0.6rem] font-mono uppercase tracking-wide text-fg bg-navy/10 border border-navy/20 rounded px-1.5 py-0.5">
                        {entry.registrationType === 'duo' ? 'Duo' : 'Team'}
                      </span>
                      {entry.teamStatus && <StatusBadge status={entry.teamStatus} />}
                    </div>
                    <p className="text-[0.65rem] font-mono text-muted mt-0.5">
                      {entry.members.length} member{entry.members.length !== 1 ? 's' : ''}
                      {entry.paymentMode
                        ? ` · ${entry.paymentMode === 'captain_pays_all' ? 'captain pays all' : 'individual pay'}`
                        : ''}
                      {entry.inviteCode ? ` · code ${entry.inviteCode}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    <button
                      onClick={() => setReminderTarget({ mode: 'tournament', entry })}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted border border-border hover:text-fg hover:bg-bg transition-all"
                    >
                      <IconMail className="w-3 h-3" />
                      Reminder
                    </button>
                    {entry.members.some(isUnpaidSlotMember) && (
                      <button
                        onClick={() => setReminderTarget({ mode: 'payment', entry })}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-accent border border-accent/30 hover:bg-accent/10 transition-all"
                      >
                        <IconClock className="w-3 h-3" />
                        Payment reminder
                      </button>
                    )}
                    <button
                      onClick={() => setEditTeam(entry)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted border border-border hover:text-fg hover:bg-bg transition-all"
                    >
                      <IconEdit className="w-3 h-3" />
                      Name
                    </button>
                    <button
                      onClick={() => setCancelTarget({ kind: 'team', entry })}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-all"
                    >
                      Cancel team
                    </button>
                  </div>
                </div>
                {/* Members */}
                <div className="divide-y divide-border">
                  {entry.members.map((m) => (
                    <MemberRow
                      key={`${m.sourceTable}-${m.sourceId}`}
                      member={m}
                      onEdit={() => setEditMember(m)}
                      onRemove={() => setCancelTarget({ kind: 'member', entry, member: m })}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Solos */}
      {solos.length > 0 && (
        <div className="space-y-4">
          <h2 className="label-mono text-[0.65rem] flex items-center gap-2">
            <IconUser className="w-3.5 h-3.5 text-muted" />
            Solo registrations ({solos.length})
          </h2>
          <div className="card-base overflow-hidden divide-y divide-border">
            {solos.map((entry) => (
              <MemberRow
                key={`${entry.members[0].sourceTable}-${entry.members[0].sourceId}`}
                member={entry.members[0]}
                onEdit={() => setEditMember(entry.members[0])}
                onRemove={() => setCancelTarget({ kind: 'member', entry, member: entry.members[0] })}
                onRemind={() => setReminderTarget({ mode: 'tournament', entry })}
              />
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      {editMember && (
        <EditMemberModal
          eventSanityId={eventSanityId}
          member={editMember}
          onClose={() => setEditMember(null)}
          onSaved={refresh}
        />
      )}
      {editTeam && (
        <EditTeamNameModal
          eventSanityId={eventSanityId}
          entry={editTeam}
          onClose={() => setEditTeam(null)}
          onSaved={refresh}
        />
      )}
      {cancelTarget && (
        <ConfirmCancelModal
          eventSanityId={eventSanityId}
          target={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onDone={refresh}
        />
      )}
      {reminderTarget && (
        <ReminderModal
          eventSanityId={eventSanityId}
          target={reminderTarget}
          onClose={() => setReminderTarget(null)}
        />
      )}
    </div>
  )
}

// Re-exported for the page's export buttons (kept here to co-locate roster UI).
export function ExportButtons({ eventSanityId }: { eventSanityId: string }) {
  const base = `/api/admin/export-tournament-roster?eventId=${encodeURIComponent(eventSanityId)}`
  return (
    <div className="flex items-center gap-2">
      <a href={`${base}&format=csv`} className="inline-flex items-center gap-1.5 btn-outline text-xs px-3 py-2">
        <IconDownload className="w-3.5 h-3.5" />
        CSV
      </a>
      <a href={`${base}&format=xlsx`} className="inline-flex items-center gap-1.5 btn-outline text-xs px-3 py-2">
        <IconDownload className="w-3.5 h-3.5" />
        XLSX
      </a>
    </div>
  )
}
