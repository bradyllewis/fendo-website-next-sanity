'use client'

import { useState } from 'react'

export default function InvitePayButton({ token }: { token: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePay() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/stripe/slot-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.')
        setLoading(false)
        return
      }
      window.location.href = data.url
    } catch {
      setError('Unable to connect. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-3 text-sm text-danger text-center">
          {error}
        </div>
      )}
      <button
        onClick={handlePay}
        disabled={loading}
        className="btn-accent w-full text-base py-4 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? 'Redirecting to checkout…' : 'Pay My Spot →'}
      </button>
    </div>
  )
}
