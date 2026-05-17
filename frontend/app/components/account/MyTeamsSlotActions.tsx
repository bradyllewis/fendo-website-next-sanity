'use client'

import { useState } from 'react'
import { getBaseUrl } from '@/lib/email/resend'

export default function MyTeamsSlotActions({ token }: { token: string }) {
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [copied, setCopied] = useState(false)

  async function handleResend() {
    setResendState('sending')
    try {
      const res = await fetch(`/api/registration-slots/${token}/resend`, { method: 'POST' })
      setResendState(res.ok ? 'sent' : 'error')
      if (res.ok) setTimeout(() => setResendState('idle'), 3000)
    } catch {
      setResendState('error')
    }
  }

  async function handleCopy() {
    const url = `${window.location.origin}/compete/invite/${token}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      <button
        onClick={handleCopy}
        className="btn-ghost text-xs px-2.5 py-1.5"
        title="Copy invite link"
      >
        {copied ? '✓ Copied' : 'Copy Link'}
      </button>
      <button
        onClick={handleResend}
        disabled={resendState === 'sending' || resendState === 'sent'}
        className="btn-ghost text-xs px-2.5 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
        title="Resend invite email"
      >
        {resendState === 'sending'
          ? 'Sending…'
          : resendState === 'sent'
          ? '✓ Sent'
          : resendState === 'error'
          ? 'Failed'
          : 'Resend'}
      </button>
    </div>
  )
}
