'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/components/auth/useAuth'
import AuthGateModal from './AuthGateModal'
import { IconLoader } from '@/app/components/icons'

interface RegisterButtonProps {
  event: {
    _id: string
    slug: string
    title: string
    entryFee: number | null
    status: string | null
    spotsTotal: number | null
    requiresRegistration: boolean | null
  }
  paidCount: number
  userRegistration: { id: string; status: string } | null
  className?: string
}

export default function RegisterButton({
  event,
  paidCount,
  userRegistration,
  className = '',
}: RegisterButtonProps) {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isFull = event.spotsTotal != null && paidCount >= event.spotsTotal
  const isRegistered = userRegistration?.status === 'paid'
  const isComplete = event.status === 'completed' || event.status === 'cancelled'

  const startCheckout = useCallback(async () => {
    setError(null)
    setIsCheckingOut(true)

    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventSlug: event.slug }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.alreadyRegistered) {
          router.refresh()
          return
        }
        setError(data.error || 'Unable to start checkout. Please try again.')
        return
      }

      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setIsCheckingOut(false)
    }
  }, [event.slug, router])

  const handleRegisterClick = useCallback(() => {
    if (!user) {
      setShowAuthModal(true)
    } else {
      startCheckout()
    }
  }, [user, startCheckout])

  const handleAuthSuccess = useCallback(() => {
    setShowAuthModal(false)
    startCheckout()
  }, [startCheckout])

  if (isComplete) {
    return (
      <div className={`pt-4 border-t border-border ${className}`}>
        <p className="text-sm text-muted-2 font-mono italic text-center">
          This event has ended
        </p>
      </div>
    )
  }

  if (isRegistered) {
    return (
      <div className={`pt-4 border-t border-border ${className}`}>
        <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-green/10 border border-green/20">
          <svg className="w-4 h-4 text-green" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
          </svg>
          <span className="text-sm font-medium text-green">You&apos;re registered</span>
        </div>
      </div>
    )
  }

  if (isFull) {
    return (
      <div className={`pt-4 border-t border-border ${className}`}>
        <p className="text-sm text-muted-2 font-mono italic text-center">
          {event.status === 'waitlist' ? 'Waitlist only — contact us to join' : 'No spots remaining'}
        </p>
      </div>
    )
  }

  const isDisabled = isCheckingOut || authLoading
  const buttonLabel = isCheckingOut
    ? 'Please wait…'
    : event.status === 'waitlist'
      ? 'Join Waitlist'
      : 'Register Now'

  return (
    <>
      <div className={className}>
        {error && (
          <p className="mb-3 text-xs text-danger text-center">{error}</p>
        )}
        <button
          onClick={handleRegisterClick}
          disabled={isDisabled}
          className={`btn-accent w-full justify-center ${isDisabled ? 'opacity-70 cursor-not-allowed' : ''}`}
          aria-label={`Register for ${event.title}`}
        >
          {isDisabled ? (
            <span className="flex items-center gap-2">
              <IconLoader className="w-4 h-4" />
              <span>{buttonLabel}</span>
            </span>
          ) : (
            buttonLabel
          )}
        </button>
      </div>

      <AuthGateModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
        eventTitle={event.title}
      />
    </>
  )
}
