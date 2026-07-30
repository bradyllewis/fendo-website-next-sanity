'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { signUp } from '@/app/auth/actions'
import { IconLoader } from '@/app/components/icons'

type View = 'sign-in' | 'sign-up'

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
  const [prefillEmail, setPrefillEmail] = useState('')
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
      setPrefillEmail('')
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

    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    // admin.createUser bypasses Supabase's password policy, so enforce the minimum here
    // (matches the /auth/sign-up page).
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setIsLoading(true)

    // Same server action the /auth/sign-up page uses — creates the user with the email
    // pre-confirmed and reliably reports an already-registered address.
    const result = await signUp(formData)

    if (result?.error) {
      setIsLoading(false)
      if (result.code === 'email_exists') {
        setPrefillEmail(email)
        setView('sign-in')
        setError(`${email} is already registered. Sign in below to continue your registration.`)
      } else {
        setError(result.error)
      }
      return
    }

    // Sign in on the browser client so the session cookie is set before checkout
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    setIsLoading(false)

    if (signInError) {
      setError(signInError.message)
      return
    }

    onSuccess()
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="bg-transparent p-0 w-[calc(100vw-2rem)] max-w-md m-auto max-h-[calc(100dvh-2rem)] overflow-y-auto backdrop:bg-fg/60 backdrop:backdrop-blur-sm"
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
              Sign in to register
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
                  key={prefillEmail}
                  id="modal-email"
                  name="email"
                  type="email"
                  label="Email"
                  placeholder="you@example.com"
                  defaultValue={prefillEmail}
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
                  After signing in you&apos;ll be taken to the secure checkout page for{' '}
                  <span className="text-fg font-medium">{eventTitle}</span>.
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
                  Your account is created instantly — you&apos;ll go straight to checkout.
                </p>
              </form>
            )}
        </div>
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
  defaultValue,
  required,
  autoComplete,
}: {
  id: string
  name: string
  type?: string
  label: string
  placeholder?: string
  defaultValue?: string
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
        defaultValue={defaultValue}
        required={required}
        autoComplete={autoComplete}
        className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-base sm:text-sm transition-colors placeholder:text-muted-2 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
      />
    </div>
  )
}
