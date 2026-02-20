import Image from 'next/image'
import Link from 'next/link'

import EmailCaptureForm from '@/app/components/EmailCaptureForm'

const FOOTER_LINKS = {
  Compete: [
    {label: 'Events', href: '/compete'},
    {label: 'Tournaments', href: '/compete/tournaments'},
    {label: 'Clinics', href: '/compete/clinics'},
    {label: 'Leaderboard', href: '/compete/leaderboard'},
  ],
  Learn: [
    {label: 'The Playbook', href: '/playbook'},
    {label: 'Short Game Tips', href: '/playbook/short-game'},
    {label: 'Habit Science', href: '/playbook/habits'},
    {label: 'Prep Routines', href: '/playbook/routines'},
  ],
  Community: [
    {label: 'The Collective', href: '/collective'},
    {label: 'Challenges', href: '/collective/challenges'},
    {label: 'Meetups', href: '/collective/meetups'},
    {label: 'Sponsorships', href: '/sponsors'},
  ],
  Gear: [
    {label: 'GS1 Groove System', href: '/gear/gs1'},
    {label: 'Apparel', href: '/gear/apparel'},
    {label: 'Bulk & Custom Orders', href: '/gear/bulk'},
    {label: 'FAQs', href: '/faqs'},
  ],
}

export default function Footer() {
  return (
    <footer className="bg-fg text-bg">

      {/* Email Capture */}
      <div className="border-b border-bg/10">
        <div className="container py-16 lg:py-20">
          <div className="max-w-2xl">
            <p className="label-mono text-bg/40 mb-4">Stay Sharp</p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-bg mb-3">
              Get it first.
            </h2>
            <p className="text-bg/50 text-base mb-8 leading-relaxed">
              Short game frameworks, event drops, and Collective-only perks — delivered before anyone else.
            </p>
            <EmailCaptureForm />
          </div>
        </div>
      </div>

      {/* Links Grid */}
      <div className="container py-16">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-10">

          {/* Brand column */}
          <div className="col-span-2 lg:col-span-1">
            <Link href="/" aria-label="Fendo Golf — Home">
              <Image
                src="/images/Fendo-golf-blue-logo.webp"
                alt="Fendo Golf"
                width={100}
                height={28}
                className="h-6 w-auto brightness-0 invert mb-5"
              />
            </Link>
            <p className="text-bg/40 text-xs leading-relaxed max-w-[180px]">
              Performance starts before the swing. Scoring is decided inside 160 yards.
            </p>
          </div>

          {/* Nav columns */}
          {Object.entries(FOOTER_LINKS).map(([category, links]) => (
            <div key={category}>
              <p className="text-xs font-semibold text-bg/30 uppercase tracking-[0.14em] mb-4">
                {category}
              </p>
              <ul className="space-y-3">
                {links.map(({label, href}) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="text-sm text-bg/60 hover:text-bg transition-colors duration-200"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-bg/10">
        <div className="container py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-bg/30 text-xs">
            &copy; {new Date().getFullYear()} Fendo Golf. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="text-xs text-bg/30 hover:text-bg/60 transition-colors duration-200">
              Privacy
            </Link>
            <Link href="/terms" className="text-xs text-bg/30 hover:text-bg/60 transition-colors duration-200">
              Terms
            </Link>
          </div>
        </div>
      </div>

    </footer>
  )
}
