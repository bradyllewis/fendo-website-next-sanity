'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { IconUser, IconTicket } from '@/app/components/icons'

const tabs = [
  { label: 'Profile',   href: '/account',        icon: IconUser },
  { label: 'My Events', href: '/account/events',  icon: IconTicket },
]

export default function AccountNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Account navigation" className="border border-border rounded-xl p-1 w-fit flex gap-0.5">
      {tabs.map(({ label, href, icon: Icon }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150
              ${active
                ? 'bg-fg text-bg shadow-sm'
                : 'text-muted hover:text-fg hover:bg-surface'
              }
            `}
            aria-current={active ? 'page' : undefined}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
