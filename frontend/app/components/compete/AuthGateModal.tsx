'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { IconLoader } from '@/app/components/icons'

type View = 'sign-in' | 'sign-up' | 'check-email'

interface AuthGateModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  eventTitle: string
}

export default function AuthGateModal({
  isOpen,
  onClose,
  onSuccess,
  eventTitle,
}: AuthGateModalProps) {
  const [view, setView] = useState<View>('sign-in')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (isOpen) {
      dialog.showModal()
    } else {
      if (dialog.open) dialog.close()
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      setView('sign-in')
      setError(null)
    }
  }, [isOpen])

  async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    setIsLoading(false)

    if (authError) {
      setError(authError.message)
      return
    }

    onSuccess()
  }

  async function handleSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const fullName = formData.get('full_name') as string

    const supabase = createClient()
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    setIsLoading(false)

    if (authError) {
      setError(authError.message)
      return
    }

    // When email confirmation is disabled, Supabase returns a session immediately.
    // In that case, proceed directly to checkout instead of showing check-email.
    if (data.session) {
      onSuccess()
    } else {
      setView('check-email')
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="bg-transparent p-0 max-w-md w-full m-auto backdrop:bg-fg/60 backdrop:backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-bg rounded-2xl border border-border shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
          <div>
            <p className="label-mono-accent text-xs mb-0.5">Registration</p>
            <h2 className="font-semibold text-fg tracking-tight text-base">
              {view === 'check-email' ? 'Check your email' : 'Sign in to register'}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-muted hover:text-fg transition-colors p-1.5 rounded-lg hover:bg-surface"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {view === 'check-email' ? (
          <div className="px-6 py-8 text-center">
            <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>
            <h3 className="font-semibold text-fg mb-2">Verify your email</h3>
            <p className="text-sm text-muted leading-relaxed">
              We sent a verification link to your inbox. Click it to activate your account,
              then come back and sign in to complete your registration for{' '}
              <strong className="text-fg">{eventTitle}</strong>.
            </p>
            <button
              onClick={() => setView('sign-in')}
              className="mt-6 btn-ghost text-sm"
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <div className="px-6 py-5">
            {/* Tab switcher */}
            <div className="flex gap-1 p-1 bg-surface rounded-xl mb-5 border border-border">
              <button
                type="button"
                onClick={() => { setView('sign-in'); setError(null) }}
                className={`flex-1 text-sm font-medium py-2 rounded-lg transition-colors duration-160 ${
                  view === 'sign-in'
                    ? 'bg-fg text-bg shadow-sm'
                    : 'text-muted hover:text-fg'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setView('sign-up'); setError(null) }}
                className={`flex-1 text-sm font-medium py-2 rounded-lg transition-colors duration-160 ${
                  view === 'sign-up'
                    ? 'bg-fg text-bg shadow-sm'
                    : 'text-muted hover:text-fg'
                }`}
              >
                Create Account
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-xl bg-danger/10 border border-danger/20 px-4 py-3 text-sm text-danger">
                {error}
              </div>
            )}

            {view === 'sign-in' ? (
              <form onSubmit={handleSignIn} className="flex flex-col gap-4">
                <ModalInput
                  id="modal-email"
                  name="email"
                  type="email"
                  label="Email"
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
                <ModalInput
                  id="modal-password"
                  name="password"
                  type="password"
                  label="Password"
                  placeholder="Your password"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`btn-accent w-full justify-center ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <IconLoader className="w-4 h-4" />
                      Signing in…
                    </span>
                  ) : (
                    'Sign In & Continue'
                  )}
                </button>
                <p className="text-center text-xs text-muted">
                  After signing in you&apos;ll be taken to the secure checkout page.
                </p>
              </form>
            ) : (
              <form onSubmit={handleSignUp} className="flex flex-col gap-4">
                <ModalInput
                  id="modal-name"
                  name="full_name"
                  type="text"
                  label="Full Name"
                  placeholder="Your name"
                  required
                  autoComplete="name"
                />
                <ModalInput
                  id="modal-email-up"
                  name="email"
                  type="email"
                  label="Email"
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
                <ModalInput
                  id="modal-password-up"
                  name="password"
                  type="password"
                  label="Password"
                  placeholder="Minimum 6 characters"
                  required
                  autoComplete="new-password"
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`btn-accent w-full justify-center ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <IconLoader className="w-4 h-4" />
                      Creating account…
                    </span>
                  ) : (
                    'Create Account & Continue'
                  )}
                </button>
                <p className="text-center text-xs text-muted">
                  You&apos;ll verify your email first, then sign in to complete checkout.
                </p>
              </form>
            )}
          </div>
        )}
      </div>
    </dialog>
  )
}

function ModalInput({
  id,
  name,
  type = 'text',
  label,
  placeholder,
  required,
  autoComplete,
}: {
  id: string
  name: string
  type?: string
  label: string
  placeholder?: string
  required?: boolean
  autoComplete?: string
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-fg mb-1.5">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm transition-colors placeholder:text-muted-2 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
      />
    </div>
  )
}
