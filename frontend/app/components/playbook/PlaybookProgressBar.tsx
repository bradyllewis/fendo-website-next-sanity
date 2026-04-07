'use client'

import {useEffect, useState} from 'react'

export default function PlaybookProgressBar() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const update = () => {
      const el = document.documentElement
      const scrolled = el.scrollTop
      const total = el.scrollHeight - el.clientHeight
      setProgress(total > 0 ? Math.min(100, (scrolled / total) * 100) : 0)
    }
    window.addEventListener('scroll', update, {passive: true})
    update()
    return () => window.removeEventListener('scroll', update)
  }, [])

  return (
    <div
      className="fixed top-0 left-0 z-50 h-[2px] bg-accent origin-left"
      style={{width: `${progress}%`, transition: 'width 80ms linear'}}
      aria-hidden="true"
    />
  )
}
