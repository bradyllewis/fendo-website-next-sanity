'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// ─── Physics Timing ──────────────────────────────────────────────────────────
// Forward roll: impact momentum carries the ball; backspin fights it from the start.
// Delays increase — the ball decelerates continuously toward a stop.
const FORWARD_DELAYS = [52, 60, 70, 82, 96, 112, 130, 150, 172, 196, 222, 250, 280]

// Grip pause: dead stop — backspin has cancelled all forward momentum.
const GRIP_PAUSE = 520

// Suck-back: true bell-curve — starts near-still, accelerates to peak, fades to rest.
const BACKWARD_DELAYS = [340, 272, 210, 156, 110, 74, 50, 44, 50, 70, 102, 146, 202]

const EXTRA_O_COUNT = FORWARD_DELAYS.length

type Size = 'sm' | 'md' | 'lg' | 'xl'

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'text-2xl',
  md: 'text-3xl md:text-4xl',
  lg: 'text-4xl md:text-5xl lg:text-6xl',
  xl: 'text-5xl md:text-6xl lg:text-7xl',
}

// Typing speed per character (ms) — lower = faster
const TYPE_SPEED = 76

interface SpinSloganProps {
  /** Size variant controlling font scale */
  size?: Size
  /** Extra classes applied to the outer wrapper */
  className?: string
  /** Extra classes applied to the text span */
  textClassName?: string
  /** If false, animation only runs when triggered by click */
  autoPlay?: boolean
}

export default function SpinSlogan({
  size = 'lg',
  className = '',
  textClassName = '',
  autoPlay = true,
}: SpinSloganProps) {
  const [text, setText] = useState('')
  const [done, setDone] = useState(false)
  const [tick, setTick] = useState(0)
  const [inView, setInView] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)

  // Trigger once when the element enters the viewport
  useEffect(() => {
    if (!autoPlay) return
    const el = rootRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      },
      { threshold: 0.3 },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [autoPlay])

  const runAnimation = useCallback(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = []
    const go = (fn: () => void, delay: number) =>
      timeouts.push(setTimeout(fn, delay))

    setText('')
    setDone(false)

    let t = 600

    // Phase 1: Type "The Spin C"
    const prefix = 'The Spin C'
    for (let i = 1; i <= prefix.length; i++) {
      const snap = i
      go(() => setText(prefix.slice(0, snap)), t)
      t += TYPE_SPEED
    }

    // Phase 2: Land the 'o' — no impact pause, rolls immediately
    go(() => setText('The Spin Co'), t)
    t += TYPE_SPEED

    // Phase 3: Forward roll — extra o's (smooth, no pause before first extra)
    for (let k = 0; k < FORWARD_DELAYS.length; k++) {
      const oCount = k + 2
      go(() => setText(`The Spin C${'o'.repeat(oCount)}`), t)
      t += FORWARD_DELAYS[k]
    }

    // Phase 4: Grip pause
    t += GRIP_PAUSE

    // Phase 5: Backward roll — suck-back to single 'o'
    for (let k = 0; k < BACKWARD_DELAYS.length; k++) {
      const oCount = EXTRA_O_COUNT - k
      go(() => setText(`The Spin C${'o'.repeat(oCount)}`), t)
      t += BACKWARD_DELAYS[k]
    }

    // Phase 6: Settled pause
    t += 220

    // Phase 7: Continue typing "mpany"
    const suffix = 'mpany'
    for (let i = 1; i <= suffix.length; i++) {
      const snap = i
      go(() => setText(`The Spin Co${suffix.slice(0, snap)}`), t)
      t += TYPE_SPEED
    }

    go(() => setDone(true), t + 400)

    return () => timeouts.forEach(clearTimeout)
  }, [])

  // Start on in-view (autoPlay) or replay tick
  useEffect(() => {
    if (autoPlay && !inView) return
    if (!autoPlay && tick === 0) return
    const cleanup = runAnimation()
    return cleanup
  }, [tick, inView, runAnimation, autoPlay])

  const replay = () => {
    if (!done) return
    setTick((n) => n + 1)
  }

  return (
    <span
      ref={rootRef}
      className={`inline-flex items-center ${className}`}
      role="text"
      aria-label="The Spin Company"
    >
      <span
        onClick={done ? replay : undefined}
        className={[
          'leading-none whitespace-nowrap select-none',
          SIZE_CLASSES[size],
          textClassName,
          done ? 'cursor-pointer' : 'cursor-default',
        ]
          .filter(Boolean)
          .join(' ')}
        title={done ? 'Click to replay' : undefined}
      >
        {text}
      </span>
    </span>
  )
}
