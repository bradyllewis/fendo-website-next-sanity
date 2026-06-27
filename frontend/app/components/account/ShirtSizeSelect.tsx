'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SHIRT_SIZES, isShirtSize } from '@/lib/shirt-sizes'

type Status = 'idle' | 'saving' | 'saved' | 'error'

export default function ShirtSizeSelect({
  token,
  shirtSize,
}: {
  token: string
  shirtSize: string | null
}) {
  const router = useRouter()
  const [status, setStatus] = useState<Status>('idle')
  const [value, setValue] = useState(shirtSize ?? '')

  async function handleChange(next: string) {
    if (next === value) return
    if (!isShirtSize(next)) return
    setValue(next)
    setStatus('saving')
    try {
      const res = await fetch(`/api/registration-slots/${token}/shirt-size`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shirtSize: next }),
      })
      if (!res.ok) {
        setStatus('error')
        setValue(shirtSize ?? '')
        setTimeout(() => setStatus('idle'), 2500)
        return
      }
      setStatus('saved')
      router.refresh()
      setTimeout(() => setStatus('idle'), 2000)
    } catch {
      setStatus('error')
      setValue(shirtSize ?? '')
      setTimeout(() => setStatus('idle'), 2500)
    }
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      <label className="text-[0.65rem] font-mono text-muted-2 hidden sm:block">Shirt</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          disabled={status === 'saving'}
          className={`appearance-none bg-surface border rounded-md pl-2.5 pr-7 py-1 text-xs font-mono font-medium tracking-wide cursor-pointer transition-colors focus:outline-none focus:ring-1 ${
            status === 'error'
              ? 'border-danger text-danger'
              : status === 'saved'
                ? 'border-green/40 text-green'
                : value
                  ? 'border-border text-fg hover:border-fg/30'
                  : 'border-border text-muted-2'
          } disabled:opacity-60 disabled:cursor-not-allowed`}
          title="Change shirt size"
        >
          {!value && <option value="">—</option>}
          {SHIRT_SIZES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-2"
          fill="none"
          viewBox="0 0 12 12"
          aria-hidden="true"
        >
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <span className="text-[0.6rem] font-mono w-4" aria-live="polite">
        {status === 'saving' && '…'}
        {status === 'saved' && '✓'}
        {status === 'error' && '⚠'}
      </span>
    </div>
  )
}
