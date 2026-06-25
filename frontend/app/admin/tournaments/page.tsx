import { createAdminClient } from '@/lib/supabase/admin'
import { client } from '@/sanity/lib/client'
import { allEventsQuery } from '@/sanity/lib/queries'
import { getEventSeatCounts } from '@/sanity/lib/eventSeats'
import StatCard from '@/app/components/admin/StatCard'
import TournamentsClient from './TournamentsClient'
import { IconTrophy } from '@/app/components/icons'

export const metadata = { title: 'Tournaments' }

// Revalidate every 60s so Sanity changes surface without a full deploy
export const revalidate = 60

interface SupabaseEventStats {
  event_sanity_id: string
  paid_count: number
  seats_filled: number
  total_revenue: number
}

export default async function TournamentsPage() {
  // Parallel fetch: Sanity events + Supabase registration stats
  const [events, regRows] = await Promise.all([
    client.fetch(allEventsQuery),
    createAdminClient()
      .from('event_registrations')
      .select('event_sanity_id, status, amount_paid')
      .in('status', ['paid', 'refunded', 'cancelled', 'pending', 'waitlisted']),
  ])

  // Derive live seat counts (counts each player once across all registration flows)
  const seatMap = await getEventSeatCounts((events ?? []).map((e: { _id: string }) => e._id))

  // Filled spots: derived for in-app-registration events; manual Sanity value otherwise
  const filledFor = (ev: { _id: string; requiresRegistration?: boolean; spotsFilled?: number | null }) =>
    ev.requiresRegistration ? (seatMap.get(ev._id) ?? 0) : (ev.spotsFilled ?? 0)
  const eventById = new Map(
    (events ?? []).map((e: { _id: string }) => [e._id, e as { _id: string; requiresRegistration?: boolean; spotsFilled?: number | null }]),
  )

  // Aggregate per-event stats from Supabase
  const statsMap = new Map<string, SupabaseEventStats>()
  for (const row of regRows.data ?? []) {
    if (!statsMap.has(row.event_sanity_id)) {
      const ev = eventById.get(row.event_sanity_id)
      statsMap.set(row.event_sanity_id, {
        event_sanity_id: row.event_sanity_id,
        paid_count: 0,
        seats_filled: ev ? filledFor(ev) : (seatMap.get(row.event_sanity_id) ?? 0),
        total_revenue: 0,
      })
    }
    const entry = statsMap.get(row.event_sanity_id)!
    if (row.status === 'paid') {
      entry.paid_count++
      entry.total_revenue += row.amount_paid ?? 0
    }
  }

  // Summary metrics
  const totalEvents = events?.length ?? 0
  const upcoming = (events ?? []).filter((e: { status: string }) =>
    ['upcoming', 'registration_open', 'waitlist'].includes(e.status),
  ).length
  const completed = (events ?? []).filter((e: { status: string }) => e.status === 'completed').length
  const cancelled = (events ?? []).filter((e: { status: string }) => e.status === 'cancelled').length
  const totalRegs = [...statsMap.values()].reduce((s, v) => s + v.paid_count, 0)
  const totalRevenue = [...statsMap.values()].reduce((s, v) => s + v.total_revenue, 0)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eventsWithStats = (events ?? []).map((ev: any) => ({
    ...ev,
    stats: statsMap.get(ev._id as string) ?? {
      paid_count: 0,
      seats_filled: filledFor(ev),
      total_revenue: 0,
      event_sanity_id: ev._id as string,
    },
  }))

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-fg/5 border border-border flex items-center justify-center">
          <IconTrophy className="w-4.5 h-4.5 text-muted" />
        </div>
        <div>
          <span className="label-mono-accent">Management</span>
          <h1 className="display-md mt-0.5">Tournaments</h1>
        </div>
      </div>

      {/* Metrics */}
      <div>
        <h2 className="label-mono text-[0.65rem] mb-3">Overview</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Total Events" value={totalEvents} sub="All time" />
          <StatCard label="Upcoming / Open" value={upcoming} />
          <StatCard label="Completed" value={completed} />
          <StatCard label="Cancelled" value={cancelled} />
          <StatCard label="Total Paid Regs" value={totalRegs} sub="Across all events" />
          <StatCard
            label="Total Revenue"
            value={`$${(totalRevenue / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            sub="Paid registrations"
            accent
          />
        </div>
      </div>

      {/* Tournament management table */}
      <TournamentsClient events={eventsWithStats} />
    </div>
  )
}
