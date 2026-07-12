import { createAdminClient } from '@/lib/supabase/admin'
import RegistrationsTable from '@/app/components/admin/RegistrationsTable'
import { getCurrentEventInfo } from '@/sanity/lib/events'
import type { EventRegistration } from '@/lib/supabase/types'

export const metadata = { title: 'Registrations' }

export default async function AdminRegistrationsPage() {
  const db = createAdminClient()

  // Fetch registrations + join profile data for display
  const { data: registrations } = await db
    .from('event_registrations')
    .select('*')
    .order('created_at', { ascending: false })

  // Fetch all referenced profiles in one query (filter out null user_ids —
  // unauthenticated slot-payers have no profile row)
  const userIds = [...new Set((registrations ?? []).map((r) => r.user_id).filter((id): id is string => !!id))]
  const { data: profiles } = userIds.length > 0
    ? await db.from('profiles').select('id, full_name, display_name, email').in('id', userIds)
    : { data: [] }

  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]))

  // Override stale stored title/date with current Sanity values
  const infoMap = await getCurrentEventInfo((registrations ?? []).map((r) => r.event_sanity_id))

  const rows = (registrations ?? []).map((r) => {
    const profile = r.user_id ? profileMap[r.user_id] : undefined
    return {
      ...(r as EventRegistration),
      event_title: infoMap.get(r.event_sanity_id)?.title ?? r.event_title,
      event_date: infoMap.get(r.event_sanity_id)?.startDate ?? r.event_date,
      event_timezone: infoMap.get(r.event_sanity_id)?.timezone ?? null,
      user_email: profile?.email ?? r.player_email ?? undefined,
      user_name: profile?.display_name || profile?.full_name || [r.player_first_name, r.player_last_name].filter(Boolean).join(' ') || undefined,
    }
  })

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <span className="label-mono-accent">Management</span>
        <h1 className="display-md mt-1">Registrations</h1>
        <p className="text-muted text-sm mt-1">
          All event registrations across all members. Update statuses as needed.
        </p>
      </div>

      <RegistrationsTable registrations={rows} />
    </div>
  )
}
