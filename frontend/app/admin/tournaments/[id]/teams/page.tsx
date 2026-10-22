import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { getTournamentRoster } from '@/lib/tournamentRoster'
import { getCurrentEventInfo, getEventAddOnNames } from '@/sanity/lib/events'
import { client } from '@/sanity/lib/client'
import { eventRegistrationByIdQuery } from '@/sanity/lib/queries'
import { getEventSeatCounts } from '@/sanity/lib/eventSeats'
import TournamentRosterTable, { ExportButtons } from '@/app/components/admin/TournamentRosterTable'
import CreateTeamButton from '@/app/components/admin/roster/CreateTeamButton'
import type { TeamFormEvent } from '@/app/components/admin/roster/TeamFormModal'
import StatCard from '@/app/components/admin/StatCard'
import { IconArrow, IconUsers } from '@/app/components/icons'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const info = await getCurrentEventInfo([id])
  return { title: `${info.get(id)?.title ?? 'Tournament'} — Teams` }
}

export default async function TournamentTeamsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ create?: string }>
}) {
  const { id } = await params
  const { create } = await searchParams

  const [roster, infoMap, addOnNames, registration, seatMap] = await Promise.all([
    getTournamentRoster(id),
    getCurrentEventInfo([id]),
    getEventAddOnNames(id),
    client.withConfig({ useCdn: false }).fetch(eventRegistrationByIdQuery, { id }),
    getEventSeatCounts([id]),
  ])
  const info = infoMap.get(id)

  // Teams can only be added to live in-app-registration events; the server
  // actions enforce the same rule.
  const canAddTeams = !!registration?.requiresRegistration && registration.status !== 'cancelled'
  const teamFormEvent: TeamFormEvent = {
    entryFeeCents: registration?.entryFee ? Math.round(registration.entryFee * 100) : 0,
    spotsTotal: registration?.spotsTotal ?? null,
    seatsFilled: seatMap.get(id) ?? 0,
  }

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
        <div className="flex items-center gap-2 flex-wrap">
          {canAddTeams && (
            <CreateTeamButton eventSanityId={id} event={teamFormEvent} autoOpen={create === '1'} />
          )}
          <ExportButtons eventSanityId={id} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 max-w-md">
        <StatCard label="Teams" value={teams.length} />
        <StatCard label="Solo" value={solos.length} />
        <StatCard label="Total Players" value={totalPlayers} />
      </div>

      {/* Roster */}
      <TournamentRosterTable
        eventSanityId={id}
        entries={roster}
        addOnNames={addOnNames}
        teamFormEvent={canAddTeams ? teamFormEvent : null}
      />
    </div>
  )
}
