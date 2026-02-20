'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { IconArrow } from '@/app/components/icons'

/* ─── Golf Ball SVG ─────────────────────────────────────────────── */

function GolfBall({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <radialGradient id="fendo-ball-grad" cx="36%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#cccccc" />
        </radialGradient>
      </defs>
      {/* Main ball */}
      <circle cx="16" cy="16" r="15.5" fill="url(#fendo-ball-grad)" />
      <circle cx="16" cy="16" r="15.5" stroke="#bbbbbb" strokeWidth="0.5" />
      {/* Dimples */}
      <circle cx="10" cy="10" r="1.8" fill="rgba(0,0,0,0.10)" />
      <circle cx="17" cy="8"  r="1.8" fill="rgba(0,0,0,0.10)" />
      <circle cx="23" cy="13" r="1.8" fill="rgba(0,0,0,0.10)" />
      <circle cx="7"  cy="18" r="1.8" fill="rgba(0,0,0,0.10)" />
      <circle cx="14" cy="21" r="1.8" fill="rgba(0,0,0,0.10)" />
      <circle cx="22" cy="20" r="1.8" fill="rgba(0,0,0,0.10)" />
      <circle cx="11" cy="26" r="1.8" fill="rgba(0,0,0,0.10)" />
      <circle cx="20" cy="26" r="1.8" fill="rgba(0,0,0,0.10)" />
      {/* Specular highlight */}
      <ellipse cx="11" cy="10" rx="4" ry="3" fill="rgba(255,255,255,0.48)" />
    </svg>
  )
}

/* ─── Types ─────────────────────────────────────────────────────── */

type Phase = 'idle' | 'rolling' | 'dropping' | 'done'

interface BallCfg {
  size: number
  top: number
  startX: number
  targetX: number
}

/* ─── Component ─────────────────────────────────────────────────── */

export default function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const periodRef  = useRef<HTMLSpanElement>(null)

  const [phase, setPhase] = useState<Phase>('idle')
  const [ball,  setBall]  = useState<BallCfg>({ size: 32, top: 0, startX: -60, targetX: 0 })

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const measure = (): BallCfg | null => {
      const pr = periodRef.current?.getBoundingClientRect()
      const sr = sectionRef.current?.getBoundingClientRect()
      if (!pr || !sr) return null
      const size = Math.max(Math.round(pr.height * 0.45), 12)
      return {
        size,
        top:    pr.top  - sr.top  + (pr.height - size) / 2,
        startX: -(size + 16),
        targetX: pr.left - sr.left + (pr.width - size) / 2,
      }
    }

    const timers: ReturnType<typeof setTimeout>[] = []

    // Snapshot position once layout settles (fonts, hydration)
    timers.push(setTimeout(() => {
      const m = measure()
      if (m) setBall(m)
    }, 80))

    // Begin animation sequence after ~1.4s
    timers.push(setTimeout(() => {
      const m = measure()
      if (!m) return
      setBall(m)
      setPhase('rolling')

      // Roll → drop after 1.45s
      timers.push(setTimeout(() => {
        setPhase('dropping')
        // Remove element after drop completes
        timers.push(setTimeout(() => setPhase('done'), 420))
      }, 1450))
    }, 1400))

    return () => timers.forEach(clearTimeout)
  }, [])

  /* Outer wrapper style: controls position & drop-scale */
  const wrapStyle = (): React.CSSProperties => {
    const { size, top, startX, targetX } = ball
    const base: React.CSSProperties = {
      position: 'absolute',
      width: size,
      height: size,
      top,
      pointerEvents: 'none',
      zIndex: 20,
    }
    switch (phase) {
      case 'idle':
        return { ...base, left: startX, opacity: 0 }
      case 'rolling':
        return {
          ...base,
          left: targetX,
          opacity: 1,
          // Fast off the mark, decelerates hard into the cup — mimics real putt friction
          transition: 'left 1.45s cubic-bezier(0.2,0.9,0.4,1), opacity 0.1s ease',
        }
      case 'dropping':
        return {
          ...base,
          left: targetX,
          opacity: 0,
          // Sinks down into the cup as it shrinks
          transform: `translateY(${Math.round(ball.size * 0.55)}px) scale(0.05)`,
          transition: 'opacity 0.44s ease-in, transform 0.44s cubic-bezier(0.4,0,1,0.6)',
        }
      default:
        return { display: 'none' }
    }
  }

  return (
    <section
      ref={sectionRef}
      className="relative min-h-[calc(100vh-5rem)] flex items-center overflow-hidden"
    >
      {/* Background texture */}
      <div
        className="absolute inset-0 bg-[url(/images/tile-grid-black.png)] opacity-[0.028]"
        style={{ backgroundSize: '24px' }}
        aria-hidden="true"
      />

      {/* ── Mobile video background — full-section bleed, hidden on lg+ ── */}
      <div className="absolute inset-0 overflow-hidden lg:hidden" aria-hidden="true">
        <video
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          src="/videos/short_game_fendo_video_1.MOV"
        />
        {/* Heavy beige veil — keeps dark text readable over the video */}
        <div
          className="absolute inset-0"
          style={{ background: 'rgba(248,237,217,0.82)' }}
        />
        {/* Subtle bottom fade for depth */}
        <div
          className="absolute inset-x-0 bottom-0 h-40 pointer-events-none"
          style={{ background: 'linear-gradient(to top, rgba(248,237,217,0.6) 0%, transparent 100%)' }}
        />
      </div>

      {/* ── Right video panel — chevron-cut cinematic column ── */}
      {/*
        Pentagon chevron: top-left and bottom-left inset 13%,
        tip at (0%, 50%) points hard left at mid-height.
        Reads as an arrowhead aimed into the text column — kinetic, athletic.
      */}
      <div
        className="absolute right-0 top-0 bottom-0 hidden lg:block w-[42%]"
        style={{
          clipPath: 'polygon(13% 0%, 100% 0%, 100% 100%, 13% 100%, 0% 50%)',
          animation: 'hero-fade-up 1.4s cubic-bezier(0.16,1,0.3,1) 0.3s both',
        }}
        aria-hidden="true"
      >
        {/* Video */}
        <video
          className="absolute inset-0 w-full h-full object-cover scale-[1.06]"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          src="/videos/short_game_fendo_video_1.MOV"
        />

        {/* Chevron-edge whisper — narrow, softens the two angled cuts */}
        <div
          className="absolute inset-y-0 left-0 w-[14%] pointer-events-none"
          style={{
            background: 'linear-gradient(to right, rgba(248,237,217,0.5) 0%, transparent 100%)',
          }}
        />

        {/* Top depth */}
        <div
          className="absolute inset-x-0 top-0 h-32 pointer-events-none"
          style={{ background: 'linear-gradient(to bottom, rgba(4,15,44,0.5) 0%, transparent 100%)' }}
        />

        {/* Bottom depth */}
        <div
          className="absolute inset-x-0 bottom-0 h-44 pointer-events-none"
          style={{ background: 'linear-gradient(to top, rgba(4,15,44,0.65) 0%, transparent 100%)' }}
        />

        {/* Bottom-right label */}
        <div className="absolute bottom-25 right-7 text-right pointer-events-none">
          <span className="block font-mono text-[0.68rem] tracking-[0.24em] uppercase text-white/90 mb-1">
            Short Game
          </span>
          <span className="block font-mono text-[0.68rem] tracking-[0.24em] uppercase text-white/60">
            Fendo Golf
          </span>
        </div>

        {/* Live Culture — glassmorphism pill with pulsing dot */}
        <div className="absolute top-6 right-6 pointer-events-none">
          <div
            className="flex items-center gap-2 rounded-full border border-white/20 px-3.5 py-1.5"
            style={{ background: 'rgba(4,15,44,0.35)', backdropFilter: 'blur(12px)' }}
          >
            {/* Pulsing live dot */}
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-70 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            <span className="font-mono text-[0.65rem] tracking-[0.18em] uppercase text-white/90">
              Live Culture
            </span>
          </div>
        </div>
      </div>

      {/* ── Golf ball (absolute within section) ── */}
      {phase !== 'done' && (
        <div style={wrapStyle()} aria-hidden="true">
          <div
            style={{
              width: '100%',
              height: '100%',
              filter: 'drop-shadow(0 2px 8px rgba(12,28,35,0.32))',
              animation: phase === 'rolling' ? 'ball-spin 1.45s linear' : 'none',
            }}
          >
            <GolfBall size={ball.size} />
          </div>
        </div>
      )}

      <div className="container relative py-24 lg:py-32">
        <div className="lg:w-[58%]">

          {/* ── Label with highlighter sweep ── */}
          <p
            className="label-mono mb-8"
            style={{ animation: 'hero-fade-up 0.6s cubic-bezier(0.16,1,0.3,1) 0.1s both' }}
          >
            <span className="relative inline-block">
              {/* Highlighter mark — sweeps left→right after 0.8s */}
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: '-1px',
                  right: '-5px',
                  bottom: '-2px',
                  left: '-5px',
                  background: 'rgba(189,88,70,0.30)',
                  borderRadius: '2px',
                  transformOrigin: 'left center',
                  animation: 'highlight-sweep 0.52s cubic-bezier(0.4,0,0.2,1) 0.8s both',
                }}
              />
              {/* Text sits above the highlight via stacking order */}
              <span className="relative">Compete · Learn · Elevate</span>
            </span>
          </p>

          {/* ── Hero headline — each line staggers in ── */}
          <h1 className="display-xl text-fg mb-8">
            <span style={{ display: 'block', animation: 'hero-fade-up 0.7s cubic-bezier(0.16,1,0.3,1) 0.2s both' }}>
              Short
            </span>
            <span style={{ display: 'block', animation: 'hero-fade-up 0.7s cubic-bezier(0.16,1,0.3,1) 0.35s both' }}>
              Game
            </span>
            <span style={{ display: 'block', animation: 'hero-fade-up 0.7s cubic-bezier(0.16,1,0.3,1) 0.5s both' }}>
              <span className="italic">Vibes</span>
              {/* Period doubles as the golf "cup" */}
              <span
                ref={periodRef}
                style={{
                  display: 'inline-block',
                  animation: phase === 'dropping' ? 'cup-ripple 0.42s ease-out' : 'none',
                }}
              >.</span>
            </span>
          </h1>

          {/* ── Body copy ── */}
          <p
            className="text-lg md:text-xl text-muted leading-relaxed max-w-[44ch] mb-12"
            style={{ animation: 'hero-fade-up 0.7s cubic-bezier(0.16,1,0.3,1) 0.65s both' }}
          >
            A community built for golfers obsessed with precision, habits, and measurable improvement.
          </p>

          {/* ── CTAs ── */}
          <div
            className="flex items-center gap-4 flex-wrap"
            style={{ animation: 'hero-fade-up 0.7s cubic-bezier(0.16,1,0.3,1) 0.8s both' }}
          >
            <Link href="/collective" className="btn-primary">
              Join the Collective
            </Link>
            <Link href="/playbook" className="btn-ghost group">
              Explore the Playbook
              <span className="group-hover:translate-x-1 transition-transform duration-200">
                <IconArrow />
              </span>
            </Link>
          </div>

          {/* ── Tagline ── */}
          <div
            className="mt-14 flex items-center gap-3 text-xs text-muted-2 font-mono"
            style={{ animation: 'hero-fade-up 0.7s cubic-bezier(0.16,1,0.3,1) 0.95s both' }}
          >
            <span className="inline-block w-5 h-px bg-border" />
            <span>Performance. Habits. Community.</span>
          </div>

        </div>
      </div>
    </section>
  )
}
