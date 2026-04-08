import { createAdminClient } from '@/lib/supabase/admin'
import RegistrationsTable from '@/app/components/admin/RegistrationsTable'
import type { EventRegistration } from '@/lib/supabase/types'

export const metadata = { title: 'Registrations' }

export default async function AdminRegistrationsPage() {
  const db = createAdminClient()

  // Fetch registrations + join profile data for display
  const { data: registrations } = await db
    .from('event_registrations')
    .select('*')
    .order('created_at', { ascending: false })

  // Fetch all referenced profiles in one query
  const userIds = [...new Set((registrations ?? []).map((r) => r.user_id))]
  const { data: profiles } = userIds.length > 0
    ? await db.from('profiles').select('id, full_name, display_name, email').in('id', userIds)
    : { data: [] }

  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]))

  const rows = (registrations ?? []).map((r) => {
    const profile = profileMap[r.user_id]
    return {
      ...(r as EventRegistration),
      user_email: profile?.email,
      user_name: profile?.display_name || profile?.full_name || undefined,
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
