import { createAdminClient } from '@/lib/supabase/admin'
import StatCard from '@/app/components/admin/StatCard'
import { IconCalendar, IconUsers, IconDollar, IconTicket, IconTrendUp } from '@/app/components/icons'
import { format } from 'date-fns'

export const metadata = { title: 'Dashboard' }

function formatCents(cents: number) {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default async function AdminDashboard() {
  const db = createAdminClient()
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  // Parallel fetches
  const [
    { count: totalUsers },
    { count: newUsers },
    { data: regStats },
    { data: revenueAll },
    { data: revenueMonth },
    { data: topEvents },
    { data: recentRegs },
  ] = await Promise.all([
    db.from('profiles').select('*', { count: 'exact', head: true }),
    db.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', monthStart),
    db.from('event_registrations').select('status'),
    db.from('event_registrations').select('amount_paid').eq('status', 'paid'),
    db.from('event_registrations').select('amount_paid').eq('status', 'paid').gte('created_at', monthStart),
    db.from('event_registrations')
      .select('event_sanity_id, event_title, event_slug')
      .eq('status', 'paid'),
    db.from('event_registrations')
      .select('id, event_title, event_slug, status, amount_paid, created_at, user_id')
      .order('created_at', { ascending: false })
      .limit(8),
  ])

  // Status breakdown
  const statusCounts: Record<string, number> = {}
  for (const r of regStats ?? []) {
    statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1
  }

  // Revenue
  const totalRevenue = (revenueAll ?? []).reduce((s, r) => s + (r.amount_paid ?? 0), 0)
  const monthRevenue = (revenueMonth ?? []).reduce((s, r) => s + (r.amount_paid ?? 0), 0)

  // Top events by paid registrations
  const eventCounts: Record<string, { title: string; slug: string; count: number }> = {}
  for (const r of topEvents ?? []) {
    if (!eventCounts[r.event_sanity_id]) {
      eventCounts[r.event_sanity_id] = { title: r.event_title, slug: r.event_slug, count: 0 }
    }
    eventCounts[r.event_sanity_id].count++
  }
  const topEventList = Object.values(eventCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const totalPaid = statusCounts['paid'] ?? 0
  const totalPending = statusCounts['pending'] ?? 0
  const totalRegistrations = Object.values(statusCounts).reduce((s, c) => s + c, 0)

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div>
        <span className="label-mono-accent">Overview</span>
        <h1 className="display-md mt-1">Dashboard</h1>
        <p className="text-muted text-sm mt-1">{format(now, 'MMMM d, yyyy')}</p>
      </div>

      {/* Key metrics */}
      <div>
        <h2 className="label-mono text-[0.65rem] mb-3">Members</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Total Members"
            value={totalUsers ?? 0}
            sub="All time"
          />
          <StatCard
            label="New This Month"
            value={newUsers ?? 0}
            sub={format(now, 'MMMM yyyy')}
            accent
          />
          <StatCard
            label="Total Revenue"
            value={formatCents(totalRevenue)}
            sub="All paid registrations"
          />
          <StatCard
            label="Revenue This Month"
            value={formatCents(monthRevenue)}
            sub={format(now, 'MMMM yyyy')}
          />
        </div>
      </div>

      {/* Registration stats */}
      <div>
        <h2 className="label-mono text-[0.65rem] mb-3">Registrations</h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatCard label="Total" value={totalRegistrations} />
          <StatCard label="Registered" value={totalPaid} />
          <StatCard label="Pending" value={totalPending} />
          <StatCard label="Waitlisted" value={statusCounts['waitlisted'] ?? 0} />
          <StatCard label="Cancelled / Refunded" value={(statusCounts['cancelled'] ?? 0) + (statusCounts['refunded'] ?? 0)} />
        </div>
      </div>

      {/* Bottom two columns */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top events */}
        <div className="card-base p-5">
          <div className="flex items-center gap-2 mb-4">
            <IconTrendUp className="w-4 h-4 text-muted" />
            <h2 className="text-sm font-semibold text-fg">Top Events by Registrations</h2>
          </div>
          {topEventList.length === 0 ? (
            <p className="text-sm text-muted">No paid registrations yet.</p>
          ) : (
            <div className="space-y-2">
              {topEventList.map((ev, i) => (
                <div key={ev.slug} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="label-mono text-[0.6rem] w-4 text-right text-muted shrink-0">
                      {i + 1}
                    </span>
                    <a
                      href={`/compete/${ev.slug}`}
                      className="text-sm text-fg hover:text-accent transition-colors truncate"
                    >
                      {ev.title}
                    </a>
                  </div>
                  <span className="text-xs font-mono text-fg shrink-0">
                    {ev.count} {ev.count === 1 ? 'reg' : 'regs'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent registrations */}
        <div className="card-base p-5">
          <div className="flex items-center gap-2 mb-4">
            <IconCalendar className="w-4 h-4 text-muted" />
            <h2 className="text-sm font-semibold text-fg">Recent Registrations</h2>
          </div>
          {(recentRegs ?? []).length === 0 ? (
            <p className="text-sm text-muted">No registrations yet.</p>
          ) : (
            <div className="space-y-2">
              {(recentRegs ?? []).map((reg) => (
                <div key={reg.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-fg truncate">{reg.event_title}</p>
                    <p className="text-[0.65rem] font-mono text-muted">
                      {format(new Date(reg.created_at), 'MMM d, h:mm a')}
                    </p>
                  </div>
                  <span
                    className={`
                      shrink-0 text-[0.6rem] font-mono font-medium px-2 py-0.5 rounded-md border
                      ${reg.status === 'paid' ? 'text-green bg-green/10 border-green/20'
                        : reg.status === 'pending' ? 'text-fg bg-mustard/20 border-mustard/30'
                        : 'text-muted bg-surface border-border'}
                    `}
                  >
                    {reg.status}
                  </span>
                </div>
              ))}
            </div>
          )}
          {totalRegistrations > 8 && (
            <a
              href="/admin/registrations"
              className="mt-4 text-xs text-accent hover:underline block"
            >
              View all {totalRegistrations} registrations →
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
