'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import UserAvatar from './UserAvatar'
import { IconUser, IconLogOut, IconUsers, IconTicket } from '@/app/components/icons'
import { signOut } from '@/app/auth/actions'
import type { Profile } from '@/lib/supabase/types'

export default function UserMenu({ profile }: { profile: Profile | null }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-full hover:opacity-80 transition-opacity duration-200"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="User menu"
      >
        <UserAvatar
          avatarUrl={profile?.avatar_url}
          fullName={profile?.full_name}
          size="sm"
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 card-base overflow-hidden shadow-layer z-50">
          {/* User info */}
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm font-semibold text-fg truncate">
              {profile?.display_name || profile?.full_name || 'Member'}
            </p>
            <p className="text-xs text-muted truncate">{profile?.email}</p>
          </div>

          {/* Menu items */}
          <div className="py-1">
            <Link
              href="/account"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-muted hover:text-fg hover:bg-surface transition-colors duration-150"
            >
              <IconUser className="w-4 h-4" />
              My Profile
            </Link>
            <Link
              href="/account/events"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-muted hover:text-fg hover:bg-surface transition-colors duration-150"
            >
              <IconTicket className="w-4 h-4" />
              My Events
            </Link>
            <Link
              href="/collective"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-muted hover:text-fg hover:bg-surface transition-colors duration-150"
            >
              <IconUsers className="w-4 h-4" />
              The Collective
            </Link>
          </div>

          {/* Sign out */}
          <div className="border-t border-border py-1">
            <form action={signOut}>
              <button
                type="submit"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-muted hover:text-danger transition-colors duration-150"
              >
                <IconLogOut className="w-4 h-4" />
                Sign Out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
