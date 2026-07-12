import { createAdminClient } from '@/lib/supabase/admin'
import SponsorshipsTable from '@/app/components/admin/SponsorshipsTable'
import { getCurrentEventInfo } from '@/sanity/lib/events'
import type { SponsorRegistration } from '@/lib/supabase/types'

export const metadata = { title: 'Sponsorships' }

export default async function AdminSponsorshipsPage() {
  const db = createAdminClient()

  const { data: sponsorships } = await db
    .from('sponsor_registrations')
    .select('*')
    .order('created_at', { ascending: false })

  // Override stale stored title/date with current Sanity values.
  // sponsorship_level/_price are transactional (what the sponsor was quoted/
  // charged) and intentionally kept as the at-purchase snapshot.
  const infoMap = await getCurrentEventInfo((sponsorships ?? []).map((s) => s.event_sanity_id))
  const rows = ((sponsorships ?? []) as SponsorRegistration[]).map((s) => ({
    ...s,
    event_title: infoMap.get(s.event_sanity_id)?.title ?? s.event_title,
    event_date: infoMap.get(s.event_sanity_id)?.startDate ?? s.event_date,
    event_timezone: infoMap.get(s.event_sanity_id)?.timezone ?? null,
  }))

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <span className="label-mono-accent">Management</span>
        <h1 className="display-md mt-1">Sponsorships</h1>
        <p className="text-muted text-sm mt-1">
          All sponsor registrations across all events.
        </p>
      </div>

      <SponsorshipsTable sponsorships={rows} />
    </div>
  )
}
