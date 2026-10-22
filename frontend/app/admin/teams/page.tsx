import { format, parseISO } from 'date-fns'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildMirrorRegIds } from '@/lib/registrationDedup'
import { client } from '@/sanity/lib/client'
import { allEventsQuery } from '@/sanity/lib/queries'
import { getCurrentEventInfo } from '@/sanity/lib/events'
import TeamsTable from '@/app/components/admin/TeamsTable'
import CreateTeamLauncher, { type LauncherEvent } from '@/app/components/admin/roster/CreateTeamLauncher'

export const metadata = { title: 'Teams' }

export default async function AdminTeamsPage() {
  const db = createAdminClient()

  const [{ data: teams }, events] = await Promise.all([
    db
      .from('teams')
      .select('id, team_name, invite_code, registration_type, max_members, event_sanity_id, event_slug, created_at')
      .order('created_at', { ascending: false }),
    client.fetch(allEventsQuery),
  ])

  const teamIds = (teams ?? []).map((t) => t.id)

  // Members are counted the same way as the tournament roster and seat counts:
  // active slots plus non-mirror paid/pending registrations. Slot-only teams
  // (individual pay, admin-created) have few or no registration rows, so
  // counting registrations alone undercounts them.
  const [{ data: slots }, { data: regs }] =
    teamIds.length > 0
      ? await Promise.all([
          db.from('registration_slots').select('team_id, status, event_registration_id').in('team_id', teamIds),
          db
            .from('event_registrations')
            .select('id, team_id, status, registration_type, registration_slot_id')
            .in('team_id', teamIds),
        ])
      : [{ data: [] }, { data: [] }]

  // Mirror set from ALL slots; seats from ACTIVE slots only (see lib/registrationDedup.ts).
  const mirrorRegIds = buildMirrorRegIds(regs ?? [], slots ?? [])

  const countMap: Record<string, number> = {}
  const bump = (teamId: string | null) => {
    if (teamId) countMap[teamId] = (countMap[teamId] ?? 0) + 1
  }
  for (const s of slots ?? []) {
    if (s.status !== 'expired' && s.status !== 'cancelled') bump(s.team_id)
  }
  for (const r of regs ?? []) {
    if (mirrorRegIds.has(r.id) || r.registration_type === 'volunteer') continue
    if (r.status === 'paid' || r.status === 'pending') bump(r.team_id)
  }

  // Override stale stored event_slug with the current Sanity title for display
  const infoMap = await getCurrentEventInfo((teams ?? []).map((t) => t.event_sanity_id))

  const rows = (teams ?? []).map((t) => ({
    ...t,
    event_title: infoMap.get(t.event_sanity_id)?.title ?? t.event_slug,
    member_count: countMap[t.id] ?? 0,
  }))

  // Tournaments a team can be created on: in-app registration and still ahead.
  const launcherEvents: LauncherEvent[] = (events ?? [])
    .filter(
      (ev) => ev.requiresRegistration && ev.status !== 'cancelled' && ev.status !== 'completed',
    )
    .map((ev) => ({
      id: ev._id,
      title: ev.title,
      dateLabel: ev.startDate ? format(parseISO(ev.startDate), 'MMM d, yyyy') : null,
    }))

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <span className="label-mono-accent">Management</span>
          <h1 className="display-md mt-1">Teams</h1>
          <p className="text-muted text-sm mt-1">
            All registered teams across all events. Invite codes are shown for reference.
          </p>
        </div>
        <CreateTeamLauncher events={launcherEvents} />
      </div>

      <TeamsTable teams={rows} />
    </div>
  )
}
