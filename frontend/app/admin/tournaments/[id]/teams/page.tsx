import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { getTournamentRoster } from '@/lib/tournamentRoster'
import { getCurrentEventInfo } from '@/sanity/lib/events'
import TournamentRosterTable, { ExportButtons } from '@/app/components/admin/TournamentRosterTable'
import StatCard from '@/app/components/admin/StatCard'
import { IconArrow, IconUsers } from '@/app/components/icons'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const info = await getCurrentEventInfo([id])
  return { title: `${info.get(id)?.title ?? 'Tournament'} — Teams` }
}

export default async function TournamentTeamsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [roster, infoMap] = await Promise.all([getTournamentRoster(id), getCurrentEventInfo([id])])
  const info = infoMap.get(id)

  const teams = roster.filter((e) => e.kind === 'team')
  const solos = roster.filter((e) => e.kind === 'solo')
  const totalPlayers = roster.reduce((sum, e) => sum + e.members.length, 0)

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Back */}
      <Link
        href="/admin/tournaments"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg transition-colors"
      >
        <IconArrow className="w-4 h-4 rotate-180" />
        All Tournaments
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-fg/5 border border-border flex items-center justify-center">
            <IconUsers className="w-4.5 h-4.5 text-muted" />
          </div>
          <div>
            <span className="label-mono-accent">Team Management</span>
            <h1 className="display-md mt-0.5">{info?.title ?? 'Tournament'}</h1>
            {info?.startDate && (
              <p className="text-xs font-mono text-muted mt-1">
                {format(parseISO(info.startDate), 'MMMM d, yyyy')}
              </p>
            )}
          </div>
        </div>
        <ExportButtons eventSanityId={id} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 max-w-md">
        <StatCard label="Teams" value={teams.length} />
        <StatCard label="Solo" value={solos.length} />
        <StatCard label="Total Players" value={totalPlayers} />
      </div>

      {/* Roster */}
      <TournamentRosterTable eventSanityId={id} entries={roster} />
    </div>
  )
}
