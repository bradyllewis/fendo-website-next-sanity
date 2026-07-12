'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

const IMAGES = [
  '/images/Golf Fendo 212.webp',
  '/images/Golf 2025-122.webp',
  '/images/Golf 2025-133.webp',
]

const HOLD_MS = 4800
const TRANSITION_MS = 3400
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'

const reducedMotionQuery = '(prefers-reduced-motion: reduce)'

function subscribePrefersReducedMotion(callback: () => void) {
  const mq = window.matchMedia(reducedMotionQuery)
  mq.addEventListener('change', callback)
  return () => mq.removeEventListener('change', callback)
}

function readPrefersReducedMotion() {
  return window.matchMedia(reducedMotionQuery).matches
}

type State = 'enter' | 'exit' | 'idle'

/**
 * Cinematic looping image carousel anchored to the bottom of the "What's Next"
 * section. One image at a time, low opacity, behind the text. Each image enters
 * with a slow focus-pull (overscale + blur rack into crisp) and exits with a
 * gentle pan + dissolve. Driven by CSS transitions for smooth, reliable
 * crossfades (distinct enter/exit motion emerges from differing target states).
 */
export function WhatsNextCarousel() {
  const reduced = useSyncExternalStore(
    subscribePrefersReducedMotion,
    readPrefersReducedMotion,
    () => false
  )

  const [index, setIndex] = useState(0)
  const [prev, setPrev] = useState<number | null>(null)
  const indexRef = useRef(0)

  useEffect(() => {
    if (reduced) return
    const id = setInterval(() => {
      setPrev(indexRef.current)
      const next = (indexRef.current + 1) % IMAGES.length
      indexRef.current = next
      setIndex(next)
    }, HOLD_MS + TRANSITION_MS)
    return () => clearInterval(id)
  }, [reduced])

  function stateFor(i: number): State {
    if (i === index) return 'enter'
    if (i === prev) return 'exit'
    return 'idle'
  }

  // Rest state (active image) vs hidden targets.
  // Enter: comes IN from the "idle/exit-ish" big+blurry pose to rest.
  // Exit: leaves rest toward a panned, slightly larger, blurred, faded pose.
  const enterStyle = {
    opacity: 1,
    transform: 'scale(1.04) translateX(0)',
    filter: 'blur(0px) brightness(1)',
  }
  const exitStyle = {
    opacity: 0,
    transform: 'scale(1.14) translateX(-5%)',
    filter: 'blur(10px) brightness(0.85)',
  }
  const idleStyle = {
    opacity: 0,
    transform: 'scale(1.2) translateX(3%)',
    filter: 'blur(22px) brightness(0.5)',
  }

  function styleFor(state: State) {
    if (state === 'enter') return enterStyle
    if (state === 'exit') return exitStyle
    return idleStyle
  }

  return (
    <div
      className="absolute inset-x-0 bottom-0 h-full overflow-hidden pointer-events-none"
      aria-hidden="true"
    >
      {IMAGES.map((src, i) => {
        if (reduced) {
          if (i !== index) return null
          return (
            <div key={src} className="absolute inset-0">
              <img
                src={src}
                alt=""
                className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-full object-cover object-middle opacity-[0.22]"
              />
            </div>
          )
        }

        const state = stateFor(i)
        const zIndex = state === 'enter' ? 2 : state === 'exit' ? 1 : 0

        return (
          <div
            key={src}
            className="absolute inset-0"
            style={{
              zIndex,
              transition: `opacity ${TRANSITION_MS}ms ${EASE}, transform ${TRANSITION_MS}ms ${EASE}, filter ${TRANSITION_MS}ms ${EASE}`,
              ...styleFor(state),
            }}
          >
            <img
              src={src}
              alt=""
              className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-full object-cover object-middle opacity-[0.22]"
            />
            <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-bg via-bg/70 to-transparent opacity-[0.99]" />
          </div>
        )
      })}
      {/* Soft fade toward the top so the image dissolves into the section bg */}
      <div className="absolute inset-0 bg-gradient-to-t from-transparent via-bg/40 to-bg" />
    </div>
  )
}
