'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { IconLoader } from '@/app/components/icons'

interface UnregisterButtonProps {
  registrationId: string
  eventTitle: string
}

export default function UnregisterButton({ registrationId, eventTitle }: UnregisterButtonProps) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleUnregister = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/registrations/${registrationId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to cancel. Please try again.')
        setConfirming(false)
        return
      }
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
      setConfirming(false)
    } finally {
      setIsLoading(false)
    }
  }, [registrationId, router])

  if (confirming) {
    return (
      <div className="flex flex-col items-end gap-1.5 mt-2">
        <p className="text-[0.65rem] font-mono text-muted">
          Cancel your spot for &ldquo;{eventTitle}&rdquo;?
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setConfirming(false)}
            disabled={isLoading}
            className="btn-ghost text-xs px-3 py-1.5"
          >
            Keep it
          </button>
          <button
            onClick={handleUnregister}
            disabled={isLoading}
            className="btn-ghost text-xs px-3 py-1.5 text-danger hover:text-danger"
          >
            {isLoading ? (
              <span className="flex items-center gap-1.5">
                <IconLoader className="w-3 h-3" />
                <span>Cancelling…</span>
              </span>
            ) : (
              'Yes, cancel'
            )}
          </button>
        </div>
        {error && <p className="text-[0.65rem] font-mono text-danger">{error}</p>}
      </div>
    )
  }

  return (
    <div className="mt-1.5">
      {error && <p className="text-[0.65rem] font-mono text-danger mb-1 text-right">{error}</p>}
      <button
        onClick={() => setConfirming(true)}
        className="text-[0.65rem] font-mono text-muted hover:text-danger transition-colors duration-160 block ml-auto"
      >
        Cancel registration
      </button>
    </div>
  )
}
