'use client'

import { useEffect, useRef } from 'react'

type ScrollRevealProps = {
  children: React.ReactNode
  direction?: 'left' | 'right'
  className?: string
}

/**
 * Wraps children in a div that slides in from `direction` when scrolled into view.
 * Uses IntersectionObserver — no external dependencies.
 * Respects prefers-reduced-motion.
 * Pass all layout/style classes via `className` so no extra wrapper breaks grid/flex layouts.
 */
export function ScrollReveal({ children, direction = 'left', className }: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Respect user's motion preference — skip animation entirely
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    // Apply hidden initial state via data attribute (set by JS, not SSR, so no flash)
    el.setAttribute('data-reveal', direction)

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.setAttribute('data-reveal', 'visible')
          observer.unobserve(el)
        }
      },
      {
        threshold: 0.1,
        // Trigger slightly before the element fully enters the viewport
        rootMargin: '0px 0px -40px 0px',
      }
    )

    // Double RAF ensures the hidden CSS state is painted before observing,
    // preventing the transition from being skipped on already-visible elements.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => observer.observe(el))
    })

    return () => observer.disconnect()
  }, [direction])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
