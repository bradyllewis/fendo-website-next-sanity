'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useLenis } from 'lenis/react'

export default function ScrollToTop() {
  const pathname = usePathname()
  const lenis = useLenis()

  useEffect(() => {
    lenis?.scrollTo(0, { immediate: true })
  }, [pathname, lenis])

  return null
}
