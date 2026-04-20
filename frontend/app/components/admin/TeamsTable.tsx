'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { IconSearch, IconX } from '@/app/components/icons'

interface TeamRow {
  id: string
  team_name: string
  invite_code: string
  registration_type: 'duo' | 'team'
  max_members: number
  event_slug: string
  member_count: number
  created_at: string
}

interface Props {
  teams: TeamRow[]
}

export default function TeamsTable({ teams }: Props) {
  const [search, setSearch] = useState('')

  const filtered = teams.filter(
    (t) =>
      t.team_name.toLowerCase().includes(search.toLowerCase()) ||
      t.invite_code.toLowerCase().includes(search.toLowerCase()) ||
      t.event_slug.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative max-w-xs">
        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
        <input
          className="w-full bg-bg border border-border rounded-xl pl-9 pr-8 py-2.5 text-sm placeholder:text-muted-2 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
          placeholder="Search teams…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-fg"
          >
            <IconX className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card-base overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface/60">
                <th className="text-left px-4 py-3 text-xs font-mono text-muted font-medium">Team</th>
                <th className="text-left px-4 py-3 text-xs font-mono text-muted font-medium">Type</th>
                <th className="text-left px-4 py-3 text-xs font-mono text-muted font-medium">Code</th>
                <th className="text-left px-4 py-3 text-xs font-mono text-muted font-medium">Members</th>
                <th className="text-left px-4 py-3 text-xs font-mono text-muted font-medium">Event</th>
                <th className="text-left px-4 py-3 text-xs font-mono text-muted font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted">
                    No teams found.
                  </td>
                </tr>
              ) : (
                filtered.map((team) => (
                  <tr key={team.id} className="hover:bg-surface/40 transition-colors">
                    <td className="px-4 py-3 font-medium text-fg">{team.team_name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[0.65rem] font-mono font-medium tracking-wide border ${
                          team.registration_type === 'duo'
                            ? 'text-accent bg-accent/10 border-accent/20'
                            : 'text-fg bg-navy/10 border-navy/20'
                        }`}
                      >
                        {team.registration_type === 'duo' ? 'Duo' : 'Team'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold tracking-widest text-fg text-xs">
                      {team.invite_code}
                    </td>
                    <td className="px-4 py-3 font-mono text-muted">
                      {team.member_count} / {team.max_members}
                    </td>
                    <td className="px-4 py-3 font-mono text-muted text-xs">{team.event_slug}</td>
                    <td className="px-4 py-3 font-mono text-muted text-xs">
                      {format(parseISO(team.created_at), 'MMM d, yyyy')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-muted font-mono">
        {filtered.length} team{filtered.length !== 1 ? 's' : ''}
        {search ? ` matching "${search}"` : ' total'}
      </p>
    </div>
  )
}
