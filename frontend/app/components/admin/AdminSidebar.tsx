'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { IconGrid, IconUsers, IconTicket, IconShield, IconStar } from '@/app/components/icons'

const NAV_ITEMS = [
  { label: 'Dashboard',     href: '/admin',                  icon: IconGrid   },
  { label: 'Users',         href: '/admin/users',            icon: IconUsers  },
  { label: 'Registrations', href: '/admin/registrations',    icon: IconTicket },
  { label: 'Sponsorships',  href: '/admin/sponsorships',     icon: IconStar   },
]

export default function AdminSidebar() {
  const pathname = usePathname()

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 shrink-0 border-r border-border bg-surface min-h-[calc(100vh-5rem)] sticky top-20">
        {/* Branding strip */}
        <div className="px-5 py-5 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-fg flex items-center justify-center">
              <IconShield className="w-3.5 h-3.5 text-bg" />
            </div>
            <div>
              <p className="text-xs font-semibold text-fg leading-none">Admin</p>
              <p className="text-[0.65rem] font-mono text-muted leading-none mt-0.5">Fendo Golf</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-0.5 p-3 flex-1" aria-label="Admin navigation">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const active = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`
                  flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
                  ${active
                    ? 'bg-fg text-bg shadow-sm'
                    : 'text-muted hover:text-fg hover:bg-bg'
                  }
                `}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Footer link */}
        <div className="p-3 border-t border-border">
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted hover:text-fg transition-colors duration-150"
          >
            ← Back to site
          </Link>
        </div>
      </aside>

      {/* Mobile top nav */}
      <div className="lg:hidden border-b border-border bg-surface px-4 py-2 flex items-center gap-1 overflow-x-auto">
        <div className="flex items-center gap-2 mr-4 shrink-0">
          <div className="w-6 h-6 rounded-md bg-fg flex items-center justify-center">
            <IconShield className="w-3 h-3 text-bg" />
          </div>
          <span className="text-xs font-semibold text-fg">Admin</span>
        </div>
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const active = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-150 shrink-0
                ${active
                  ? 'bg-fg text-bg shadow-sm'
                  : 'text-muted hover:text-fg hover:bg-bg'
                }
              `}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </Link>
          )
        })}
      </div>
    </>
  )
}
