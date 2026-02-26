import Link from 'next/link'

import {IconArrow, IconCheck, IconTarget, IconUsers} from '@/app/components/icons'
import {ScrollReveal} from '@/app/components/ScrollReveal'

function CompeteBlock() {
  return (
    <section className="my-12" aria-labelledby="compete-heading">
      <div className="lg:grid lg:grid-cols-2">

        {/* Visual — slides in from the left */}
        <ScrollReveal direction="left" className="relative shadow-lg bg-bg min-h-72 lg:min-h-[520px] overflow-hidden order-last lg:order-first rounded-tr-4xl rounded-br-4xl">
          <div
            className="absolute inset-0  bg-[center_68%] bg-cover opacity-70"
            style={{ backgroundImage: "url(/images/fendo_golf_tournament_1.jpg)" }}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full p-12 pt-8 lg:p-16 lg:pt-10 flex flex-col justify-between">
            <span className="label-mono text-fg/80 font-bold md:text-2xl">01 — Compete</span>
            <div className="flex flex-col gap-3">
              {['Local Clinics', 'Sponsored Championships', 'Peer Challenges'].map((item) => (
                <div key={item} className="flex items-center gap-3 bg-fg/65 border-accent rounded-full px-4 py-1 pb-2 w-fit">
                  <span className="text-green-300">
                    <IconCheck className="w-3.5 h-3.5" />
                  </span>
                  <span className="text-white/60 text-sm font-medium">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <span
            className="absolute bottom-6 right-8 font-mono text-[9rem] font-semibold text-bg/85 leading-none select-none pointer-events-none"
            aria-hidden="true"
          >
            01
          </span>
        </ScrollReveal>

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
    <section className="my-12" aria-labelledby="learn-heading">
      <div className="lg:grid lg:grid-cols-2">

        {/* Content */}
        <div className="p-12 lg:p-16 xl:p-20 flex flex-col justify-center items-end text-right">
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

        {/* Visual — slides in from the right */}
        <ScrollReveal direction="right" className="relative shadow-lg bg-bg min-h-72 lg:min-h-[520px] overflow-hidden rounded-tl-4xl rounded-bl-4xl">
          <div
            className="absolute inset-0 bg-[center_68%] bg-cover opacity-70"
            style={{ backgroundImage: "url(/images/fendo_golf_long_putt.jpg)" }}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full p-12 pt-8 lg:p-16 lg:pt-10 flex flex-col justify-between">
            <span className="label-mono text-fg/80 font-bold md:text-2xl">02 — Learn</span>
            <div className="space-y-4">
              {['Preparation Routines', 'Short Game Frameworks', 'Habit Science', 'Scoring Systems'].map((item) => (
                <div key={item} className="flex items-center gap-3 bg-fg/65 border-accent rounded-full px-4 py-1 pb-2 w-fit">
                  <span className="text-green-300">
                    <IconTarget className="w-3.5 h-3.5" />
                  </span>
                  <span className="text-white/60 text-sm font-medium">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <span
            className="absolute bottom-6 right-8 font-mono text-[9rem] font-semibold text-bg/85 leading-none select-none pointer-events-none"
            aria-hidden="true"
          >
            02
          </span>
        </ScrollReveal>
      </div>
    </section>
  )
}

function ConnectBlock() {
  return (
    <section className="my-12" aria-labelledby="connect-heading">
      <div className="lg:grid lg:grid-cols-2">

        {/* Visual — slides in from the left */}
        <ScrollReveal direction="left" className="relative shadow-lg bg-bg min-h-72 lg:min-h-[520px] overflow-hidden order-last lg:order-first rounded-tr-4xl rounded-br-4xl">
          <div
            className="absolute inset-0 bg-[center_70%] bg-cover opacity-70"
            style={{ backgroundImage: "url(/images/fendo_golf_friends_vintage.jpg)" }}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full p-12 pt-8 lg:p-16 lg:pt-10 flex flex-col justify-between">
            <span className="label-mono text-fg/80 font-bold md:text-2xl text-right">03 — Connect</span>
            <div className="grid grid-cols-2 gap-3">
              {['Leaderboards', 'Challenges', 'Local Meetups', 'Beta Perks'].map((badge) => (
                <div key={badge} className="flex items-center gap-3 bg-fg/65 border-accent rounded-full px-4 py-1 pb-2 w-fit">
                  <span className="text-green-300">
                    <IconUsers className="w-3.5 h-3.5" />
                  </span>
                  <span className="text-white/60 text-sm font-medium">{badge}</span>
                </div>
              ))}
            </div>
          </div>
          <span
            className="absolute bottom-6 right-8 font-mono text-[9rem] font-semibold text-bg/85 leading-none select-none pointer-events-none"
            aria-hidden="true"
          >
            03
          </span>
        </ScrollReveal>

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
