'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { IconSearch, IconX, IconChevronRight, IconShield } from '@/app/components/icons'
import UserAvatar from '@/app/components/auth/UserAvatar'
import type { Profile } from '@/lib/supabase/types'

interface Props {
  users: Profile[]
}

export default function UserTable({ users }: Props) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return users
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        (u.full_name ?? '').toLowerCase().includes(q) ||
        (u.display_name ?? '').toLowerCase().includes(q),
    )
  }, [users, query])

  return (
    <div className="flex flex-col gap-4">
      {/* Search */}
      <div className="relative max-w-sm">
        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email…"
          className="w-full pl-9 pr-9 py-2.5 text-sm bg-surface border border-border rounded-xl text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/60 transition-all"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-fg transition-colors"
            aria-label="Clear search"
          >
            <IconX className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Count */}
      <p className="text-xs font-mono text-muted">
        {filtered.length} {filtered.length === 1 ? 'member' : 'members'}
        {query ? ` matching "${query}"` : ''}
      </p>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="card-base p-10 text-center">
          <p className="text-sm text-muted">No members found.</p>
        </div>
      ) : (
        <div className="card-base overflow-hidden">
          {/* Header row */}
          <div className="hidden lg:grid grid-cols-[2fr_2fr_1fr_1fr_auto] gap-4 px-5 py-3 border-b border-border bg-surface/50">
            <span className="label-mono text-[0.6rem]">Member</span>
            <span className="label-mono text-[0.6rem]">Email</span>
            <span className="label-mono text-[0.6rem]">Handicap / Course</span>
            <span className="label-mono text-[0.6rem]">Joined</span>
            <span className="label-mono text-[0.6rem]">Role</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-border">
            {filtered.map((user) => (
              <Link
                key={user.id}
                href={`/admin/users/${user.id}`}
                className="flex lg:grid lg:grid-cols-[2fr_2fr_1fr_1fr_auto] gap-4 items-center px-5 py-4 hover:bg-surface/50 transition-colors duration-150 group"
              >
                {/* Avatar + name */}
                <div className="flex items-center gap-3 min-w-0">
                  <UserAvatar
                    avatarUrl={user.avatar_url}
                    fullName={user.full_name}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-fg truncate">
                      {user.display_name || user.full_name || '—'}
                    </p>
                    {user.display_name && user.full_name && (
                      <p className="text-xs text-muted truncate">{user.full_name}</p>
                    )}
                  </div>
                </div>

                {/* Email */}
                <p className="hidden lg:block text-sm text-muted truncate">{user.email}</p>

                {/* Handicap / course */}
                <div className="hidden lg:block">
                  {user.handicap != null && (
                    <p className="text-xs font-mono text-fg">HCP {user.handicap}</p>
                  )}
                  {user.home_course && (
                    <p className="text-xs text-muted truncate">{user.home_course}</p>
                  )}
                  {user.handicap == null && !user.home_course && (
                    <span className="text-xs text-muted">—</span>
                  )}
                </div>

                {/* Joined */}
                <p className="hidden lg:block text-xs font-mono text-muted">
                  {format(parseISO(user.created_at), 'MMM d, yyyy')}
                </p>

                {/* Role + chevron */}
                <div className="flex items-center gap-2 ml-auto">
                  {user.role === 'admin' && (
                    <span className="flex items-center gap-1 text-[0.6rem] font-mono font-medium tracking-wide px-2 py-0.5 rounded-md bg-fg text-bg border border-fg/20">
                      <IconShield className="w-2.5 h-2.5" />
                      Admin
                    </span>
                  )}
                  <IconChevronRight className="w-4 h-4 text-muted group-hover:text-fg transition-colors duration-150" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
