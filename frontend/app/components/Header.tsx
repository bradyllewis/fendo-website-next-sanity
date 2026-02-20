'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'

const NAV_LINKS = [
  { label: 'Compete', href: '/compete' },
  { label: 'Playbook', href: '/playbook' },
  { label: 'Collective', href: '/collective' },
  { label: 'Gear', href: '/gear' },
]

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)

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
            {/* CTA — desktop only */}
            <Link
              href="/collective"
              className="hidden md:inline-flex btn-accent text-sm px-4 py-2.5 rounded-xl"
            >
              Get First Access
            </Link>

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

            {/* Mobile CTA */}
            <div className="pt-5 pb-2">
              <Link
                href="/collective"
                className="btn-accent w-full justify-center text-base py-3.5 rounded-xl"
                onClick={closeMenu}
              >
                Get First Access
              </Link>
            </div>
          </nav>
        </div>
      </div>
    </>
  )
}
