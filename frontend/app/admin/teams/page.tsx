import { createAdminClient } from '@/lib/supabase/admin'
import TeamsTable from '@/app/components/admin/TeamsTable'

export const metadata = { title: 'Teams' }

export default async function AdminTeamsPage() {
  const db = createAdminClient()

  const { data: teams } = await db
    .from('teams')
    .select('id, team_name, invite_code, registration_type, max_members, event_slug, created_at')
    .order('created_at', { ascending: false })

  const teamIds = (teams ?? []).map((t) => t.id)

  const { data: regs } = teamIds.length > 0
    ? await db
        .from('event_registrations')
        .select('team_id')
        .in('team_id', teamIds)
        .neq('status', 'cancelled')
    : { data: [] }

  const countMap: Record<string, number> = {}
  for (const reg of regs ?? []) {
    if (reg.team_id) countMap[reg.team_id] = (countMap[reg.team_id] ?? 0) + 1
  }

  const rows = (teams ?? []).map((t) => ({
    ...t,
    member_count: countMap[t.id] ?? 0,
  }))

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <span className="label-mono-accent">Management</span>
        <h1 className="display-md mt-1">Teams</h1>
        <p className="text-muted text-sm mt-1">
          All registered teams across all events. Invite codes are shown for reference.
        </p>
      </div>

      <TeamsTable teams={rows} />
    </div>
  )
}
