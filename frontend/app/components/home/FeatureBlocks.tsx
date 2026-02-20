import Link from 'next/link'

import {IconArrow, IconCheck} from '@/app/components/icons'

function CompeteBlock() {
  return (
    <section className="border-b border-border" aria-labelledby="compete-heading">
      <div className="lg:grid lg:grid-cols-2">

        {/* Visual */}
        <div className="relative bg-fg min-h-72 lg:min-h-[520px] overflow-hidden order-last lg:order-first">
          <div
            className="absolute inset-0 opacity-[0.05]"
            style={{backgroundImage: 'url(/images/tile-grid-white.png)', backgroundSize: '20px'}}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full p-12 lg:p-16 flex flex-col justify-between">
            <span className="label-mono text-white/30">01 — Compete</span>
            <div className="flex flex-col gap-3">
              {['Local Clinics', 'Sponsored Championships', 'Peer Challenges'].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <span className="text-accent">
                    <IconCheck className="w-3.5 h-3.5" />
                  </span>
                  <span className="text-white/60 text-sm font-medium">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <span
            className="absolute bottom-6 right-8 font-mono text-[9rem] font-semibold text-white/[0.05] leading-none select-none pointer-events-none"
            aria-hidden="true"
          >
            01
          </span>
        </div>

        {/* Content */}
        <div className="p-12 lg:p-16 xl:p-20 flex flex-col justify-center">
          <p className="label-mono-accent mb-5">Compete</p>
          <h2 id="compete-heading" className="display-md text-fg mb-5">
            Real People.<br />Real Stakes.<br />Real Growth.
          </h2>
          <p className="text-muted leading-relaxed mb-8 max-w-[42ch]">
            From local clinics to sponsored championships, Fendo events put your preparation to the test. Compete with peers, build accountability, and measure progress where it actually matters — on the course.
          </p>
          <Link href="/compete" className="link-arrow">
            View Events <span className="arrow"><IconArrow className="w-4 h-4" /></span>
          </Link>
        </div>
      </div>
    </section>
  )
}

function LearnBlock() {
  return (
    <section className="border-b border-border" aria-labelledby="learn-heading">
      <div className="lg:grid lg:grid-cols-2">

        {/* Content */}
        <div className="p-12 lg:p-16 xl:p-20 flex flex-col justify-center">
          <p className="label-mono-accent mb-5">Learn</p>
          <h2 id="learn-heading" className="display-md text-fg mb-5">
            No Gimmicks.<br />Just Fundamentals.
          </h2>
          <p className="text-muted leading-relaxed mb-8 max-w-[42ch]">
            The Playbook cuts through the noise with short-game frameworks, preparation routines, and habit science built for real scoring improvement. Repeatable. Teachable. Results-driven.
          </p>
          <Link href="/playbook" className="link-arrow">
            Open the Playbook <span className="arrow"><IconArrow className="w-4 h-4" /></span>
          </Link>
        </div>

        {/* Visual */}
        <div className="relative bg-fg min-h-72 lg:min-h-[520px] overflow-hidden">
          <div
            className="absolute inset-0 opacity-[0.05]"
            style={{backgroundImage: 'url(/images/tile-1-black.png)', backgroundSize: '5px'}}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full p-12 lg:p-16 flex flex-col justify-between">
            <span className="label-mono text-white/30">02 — Learn</span>
            <div className="space-y-4">
              {['Preparation Routines', 'Short Game Frameworks', 'Habit Science', 'Scoring Systems'].map((item) => (
                <div key={item} className="border-b border-white/10 pb-3 last:border-0">
                  <span className="text-white/50 text-sm font-medium font-mono">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <span
            className="absolute bottom-6 right-8 font-mono text-[9rem] font-semibold text-white/[0.05] leading-none select-none pointer-events-none"
            aria-hidden="true"
          >
            02
          </span>
        </div>
      </div>
    </section>
  )
}

function ConnectBlock() {
  return (
    <section className="border-b border-border" aria-labelledby="connect-heading">
      <div className="lg:grid lg:grid-cols-2">

        {/* Visual */}
        <div className="relative bg-fg min-h-72 lg:min-h-[520px] overflow-hidden order-last lg:order-first">
          <div
            className="absolute inset-0 opacity-[0.05]"
            style={{backgroundImage: 'url(/images/tile-grid-white.png)', backgroundSize: '20px'}}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full p-12 lg:p-16 flex flex-col justify-between">
            <span className="label-mono text-white/30">03 — Connect</span>
            <div className="grid grid-cols-2 gap-3">
              {['Leaderboards', 'Challenges', 'Local Meetups', 'Beta Perks'].map((badge) => (
                <div
                  key={badge}
                  className="border border-white/10 rounded-lg px-3 py-2"
                >
                  <span className="text-white/50 text-xs font-mono font-medium">{badge}</span>
                </div>
              ))}
            </div>
          </div>
          <span
            className="absolute bottom-6 right-8 font-mono text-[9rem] font-semibold text-white/[0.05] leading-none select-none pointer-events-none"
            aria-hidden="true"
          >
            03
          </span>
        </div>

        {/* Content */}
        <div className="p-12 lg:p-16 xl:p-20 flex flex-col justify-center">
          <p className="label-mono-accent mb-5">Connect</p>
          <h2 id="connect-heading" className="display-md text-fg mb-5">
            Join the<br />Collective.
          </h2>
          <p className="text-muted leading-relaxed mb-8 max-w-[42ch]">
            The Fendo Collective is built for golfers who take the craft seriously. Challenges, leaderboards, meetups, and shared standards — because real improvement comes from shared goals and friendly competition.
          </p>
          <Link href="/collective" className="link-arrow">
            Get First Access <span className="arrow"><IconArrow className="w-4 h-4" /></span>
          </Link>
        </div>
      </div>
    </section>
  )
}

export default function FeatureBlocks() {
  return (
    <>
      <CompeteBlock />
      <LearnBlock />
      <ConnectBlock />
    </>
  )
}
