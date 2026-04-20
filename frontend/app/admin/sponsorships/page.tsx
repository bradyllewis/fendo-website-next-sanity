import { createAdminClient } from '@/lib/supabase/admin'
import SponsorshipsTable from '@/app/components/admin/SponsorshipsTable'
import type { SponsorRegistration } from '@/lib/supabase/types'

export const metadata = { title: 'Sponsorships' }

export default async function AdminSponsorshipsPage() {
  const db = createAdminClient()

  const { data: sponsorships } = await db
    .from('sponsor_registrations')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <span className="label-mono-accent">Management</span>
        <h1 className="display-md mt-1">Sponsorships</h1>
        <p className="text-muted text-sm mt-1">
          All sponsor registrations across all events.
        </p>
      </div>

      <SponsorshipsTable sponsorships={(sponsorships ?? []) as SponsorRegistration[]} />
    </div>
  )
}
