import { createAdminClient } from '@/lib/supabase/admin'
import UserTable from '@/app/components/admin/UserTable'
import type { Profile } from '@/lib/supabase/types'

export const metadata = { title: 'Users' }

export default async function AdminUsersPage() {
  const db = createAdminClient()

  const { data: users } = await db
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <span className="label-mono-accent">Management</span>
        <h1 className="display-md mt-1">Members</h1>
        <p className="text-muted text-sm mt-1">
          All registered members. Click a row to view details and manage roles.
        </p>
      </div>

      <UserTable users={(users ?? []) as Profile[]} />
    </div>
  )
}
