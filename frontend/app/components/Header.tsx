'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useAuth } from '@/app/components/auth/useAuth'
import UserMenu from '@/app/components/auth/UserMenu'
import UserAvatar from '@/app/components/auth/UserAvatar'
import { IconUser, IconLogOut, IconShield } from '@/app/components/icons'
import { signOut } from '@/app/auth/actions'

const NAV_LINKS = [
  { label: 'Compete', href: '/compete' },
  { label: 'Playbook', href: '/playbook' },
  { label: 'Collective', href: '/collective' },
  { label: 'Gear', href: '/gear' },
]

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user, profile, isLoading } = useAuth()

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  const closeMenu = () => setMobileOpen(false)

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-50 h-20 bg-bg/90 backdrop-blur-xl border-b border-border/60">
        <div className="container h-full flex items-center justify-between gap-6">

          {/* Logo */}
          <Link
            href="/"
            className="flex items-center shrink-0"
            aria-label="Fendo Golf — Home"
            onClick={closeMenu}
          >
            <Image
              src="/images/Fendo-golf-blue-logo.webp"
              alt="Fendo Golf"
              width={240}
              height={64}
              className="h-18 w-auto"
              priority
            />
          </Link>

          {/* Desktop nav */}
          <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className="text-sm font-medium text-muted hover:text-fg transition-colors duration-200"
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Desktop auth area */}
            <div className="hidden md:flex items-center">
              {isLoading ? (
                <div className="w-8 h-8 rounded-full bg-surface animate-pulse" />
              ) : user ? (
                <UserMenu profile={profile} />
              ) : (
                <Link
                  href="/auth/sign-in"
                  className="btn-accent text-sm px-4 py-2.5 rounded-xl"
                >
                  Sign In
                </Link>
              )}
            </div>

            {/* Hamburger — mobile only */}
            <button
              className="md:hidden flex flex-col justify-center items-center w-10 h-10 gap-[5px] rounded-lg hover:bg-surface transition-colors duration-200 shrink-0"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
              aria-controls="mobile-menu"
              onClick={() => setMobileOpen((prev) => !prev)}
            >
              <span
                className={`block h-[2px] bg-fg rounded-full transition-all duration-200 ease-in-out origin-center ${
                  mobileOpen ? 'w-5 translate-y-[7px] rotate-45' : 'w-5'
                }`}
              />
              <span
                className={`block h-[2px] bg-fg rounded-full transition-all duration-200 ease-in-out ${
                  mobileOpen ? 'w-0 opacity-0' : 'w-5'
                }`}
              />
              <span
                className={`block h-[2px] bg-fg rounded-full transition-all duration-200 ease-in-out origin-center ${
                  mobileOpen ? 'w-5 -translate-y-[7px] -rotate-45' : 'w-5'
                }`}
              />
            </button>
          </div>

        </div>
      </header>

      {/* Mobile menu */}
      <div
        id="mobile-menu"
        className={`fixed inset-0 z-40 md:hidden transition-all duration-300 ease-in-out ${
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!mobileOpen}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-fg/30 backdrop-blur-sm"
          onClick={closeMenu}
          aria-hidden="true"
        />

        {/* Slide-down panel */}
        <div
          className={`absolute top-20 inset-x-0 bg-bg border-b border-border shadow-layer transition-transform duration-300 ease-in-out ${
            mobileOpen ? 'translate-y-0' : '-translate-y-3'
          }`}
        >
          <nav aria-label="Mobile navigation" className="container py-4 flex flex-col">
            {/* User info (mobile) */}
            {user && profile && (
              <div className="flex items-center gap-3 pb-4 mb-2 border-b border-border/50">
                <UserAvatar
                  avatarUrl={profile.avatar_url}
                  fullName={profile.full_name}
                  size="sm"
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-fg truncate">
                    {profile.display_name || profile.full_name || 'Member'}
                  </p>
                  <p className="text-xs text-muted truncate">{profile.email}</p>
                </div>
              </div>
            )}

            {NAV_LINKS.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center justify-between py-4 text-base font-semibold text-fg border-b border-border/50 hover:text-accent transition-colors duration-200 group"
                onClick={closeMenu}
              >
                <span>{label}</span>
                <svg
                  className="w-4 h-4 text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all duration-200"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}

            {/* Auth links (mobile) */}
            {user ? (
              <>
                <Link
                  href="/account"
                  className="flex items-center gap-3 py-4 text-base font-semibold text-fg border-b border-border/50 hover:text-accent transition-colors duration-200"
                  onClick={closeMenu}
                >
                  <IconUser className="w-4 h-4" />
                  My Profile
                </Link>
                {profile?.role === 'admin' && (
                  <Link
                    href="/admin"
                    className="flex items-center gap-3 py-4 text-base font-semibold text-fg border-b border-border/50 hover:text-accent transition-colors duration-200"
                    onClick={closeMenu}
                  >
                    <IconShield className="w-4 h-4" />
                    Admin Panel
                  </Link>
                )}
                <div className="pt-5 pb-2">
                  <form action={signOut}>
                    <button
                      type="submit"
                      onClick={closeMenu}
                      className="btn-outline w-full justify-center text-base py-3.5 rounded-xl flex items-center gap-2"
                    >
                      <IconLogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <div className="pt-5 pb-2 flex flex-col gap-3">
                <Link
                  href="/auth/sign-in"
                  className="btn-accent w-full justify-center text-base py-3.5 rounded-xl"
                  onClick={closeMenu}
                >
                  Sign In
                </Link>
                <Link
                  href="/auth/sign-up"
                  className="btn-outline w-full justify-center text-base py-3.5 rounded-xl"
                  onClick={closeMenu}
                >
                  Create Account
                </Link>
              </div>
            )}
          </nav>
        </div>
      </div>
    </>
  )
}
