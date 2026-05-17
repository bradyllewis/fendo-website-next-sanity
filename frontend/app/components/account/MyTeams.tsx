import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { format, parseISO, formatDistanceToNow, isPast } from 'date-fns'
import Link from 'next/link'
import MyTeamsSlotActions from './MyTeamsSlotActions'
import type { RegistrationSlot, TeamRecord } from '@/lib/supabase/types'

type SlotRow = Pick<
  RegistrationSlot,
  'id' | 'is_captain' | 'player_first_name' | 'player_last_name' | 'player_email' | 'status' | 'expires_at' | 'amount_due' | 'invite_token'
>

type TeamWithSlots = TeamRecord & { slots: SlotRow[] }

export default async function MyTeams() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()

  // Find slots where this user is the captain (invited_by_user_id)
  const { data: captainSlots } = await admin
    .from('registration_slots')
    .select('team_id')
    .eq('invited_by_user_id', user.id)
    .eq('is_captain', true)

  if (!captainSlots || captainSlots.length === 0) return null

  const teamIds = [...new Set(captainSlots.map((s) => s.team_id))]

  const { data: teams } = await admin
    .from('teams')
    .select('*')
    .in('id', teamIds)
    .eq('payment_mode', 'individual')
    .order('created_at', { ascending: false })

  if (!teams || teams.length === 0) return null

  const { data: allSlots } = await admin
    .from('registration_slots')
    .select('id, team_id, is_captain, player_first_name, player_last_name, player_email, status, expires_at, amount_due, invite_token')
    .in('team_id', teamIds)
    .order('created_at', { ascending: true })

  const slotsByTeam = new Map<string, SlotRow[]>()
  for (const slot of allSlots ?? []) {
    const arr = slotsByTeam.get(slot.team_id) ?? []
    arr.push(slot)
    slotsByTeam.set(slot.team_id, arr)
  }

  const teamsWithSlots: TeamWithSlots[] = (teams as TeamRecord[]).map((t) => ({
    ...t,
    slots: slotsByTeam.get(t.id) ?? [],
  }))

  return (
    <section className="pt-8 space-y-8">
      <h2 className="font-semibold text-xl tracking-tight">My Teams</h2>
      {teamsWithSlots.map((team) => (
        <div key={team.id} className="card-base overflow-hidden">
          {/* Team header */}
          <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-border">
            <div>
              <h3 className="font-semibold text-fg">{team.team_name}</h3>
              <p className="text-xs text-muted font-mono mt-0.5">{team.event_slug}</p>
            </div>
            <TeamStatusBadge status={team.team_status} />
          </div>

          {/* Slot list */}
          <div className="divide-y divide-border">
            {team.slots.map((slot) => {
              const expired = slot.status === 'expired' || slot.status === 'cancelled'
              const expiringSoon =
                !expired &&
                slot.status !== 'paid' &&
                slot.status !== 'claimed' &&
                !isPast(parseISO(slot.expires_at)) &&
                parseISO(slot.expires_at).getTime() - Date.now() < 48 * 60 * 60 * 1000

              return (
                <div key={slot.id} className="px-5 py-4 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-fg">
                        {slot.player_first_name} {slot.player_last_name}
                        {slot.is_captain && (
                          <span className="ml-1.5 text-xs font-mono text-muted">(You)</span>
                        )}
                      </span>
                      <SlotStatusBadge status={slot.status} />
                    </div>
                    <p className="text-xs text-muted mt-0.5">{slot.player_email}</p>
                    {!slot.is_captain && slot.status !== 'paid' && slot.status !== 'claimed' && !expired && (
                      <p className={`text-xs font-mono mt-1 ${expiringSoon ? 'text-danger' : 'text-muted-2'}`}>
                        {expiringSoon ? '⚠ ' : ''}
                        Expires {formatDistanceToNow(parseISO(slot.expires_at), { addSuffix: true })}
                      </p>
                    )}
                  </div>

                  {/* Actions for unpaid, non-captain, non-expired slots */}
                  {!slot.is_captain && slot.status !== 'paid' && slot.status !== 'claimed' && !expired && (
                    <MyTeamsSlotActions token={slot.invite_token} />
                  )}
                </div>
              )
            })}
          </div>

          {/* Footer */}
          {team.expires_at && team.team_status !== 'complete' && (
            <div className="px-5 py-3 border-t border-border bg-surface/50">
              <p className="text-xs text-muted">
                Team expires{' '}
                <strong className="text-fg">
                  {format(parseISO(team.expires_at), 'MMMM d, yyyy')}
                </strong>
              </p>
            </div>
          )}
        </div>
      ))}
    </section>
  )
}

function TeamStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    pending:        { label: 'Awaiting Payments', className: 'text-fg bg-mustard/20 border-mustard/30' },
    partially_paid: { label: 'Partially Paid',   className: 'text-fg bg-mustard/20 border-mustard/30' },
    complete:       { label: 'Complete',          className: 'text-green bg-green/10 border-green/20' },
    expired:        { label: 'Expired',           className: 'text-muted bg-surface border-border' },
    cancelled:      { label: 'Cancelled',         className: 'text-muted bg-surface border-border' },
  }
  const badge = config[status] ?? { label: status, className: 'text-muted bg-surface border-border' }
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[0.65rem] font-mono font-medium tracking-wide border whitespace-nowrap ${badge.className}`}>
      {badge.label}
    </span>
  )
}

function SlotStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    captain_pending: { label: 'Pending',    className: 'text-fg bg-mustard/20 border-mustard/30' },
    invited:         { label: 'Invited',    className: 'text-fg bg-mustard/10 border-mustard/20' },
    payment_started: { label: 'In Progress', className: 'text-fg bg-mustard/20 border-mustard/30' },
    paid:            { label: 'Paid ✓',     className: 'text-green bg-green/10 border-green/20' },
    claimed:         { label: 'Claimed ✓',  className: 'text-green bg-green/10 border-green/20' },
    expired:         { label: 'Expired',    className: 'text-muted bg-surface border-border' },
    cancelled:       { label: 'Cancelled',  className: 'text-muted bg-surface border-border' },
  }
  const badge = config[status] ?? { label: status, className: 'text-muted bg-surface border-border' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[0.65rem] font-mono font-medium tracking-wide border ${badge.className}`}>
      {badge.label}
    </span>
  )
}
