'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import AuthFormCard from '@/app/components/auth/AuthFormCard'
import FormInput from '@/app/components/auth/FormInput'
import SubmitButton from '@/app/components/auth/SubmitButton'
import { signUp } from '@/app/auth/actions'
import { createClient } from '@/lib/supabase/client'

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  )
}

function SignUpForm() {
  const searchParams = useSearchParams()
  const claimToken = searchParams.get('claimToken')
  const prefillEmail = searchParams.get('email') ?? ''

  const [error, setError] = useState<string | null>(null)
  const [existingEmail, setExistingEmail] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  const signInHref = claimToken ? `/auth/sign-in?next=/account/claim/${claimToken}` : '/auth/sign-in'

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setExistingEmail(null)
    setIsPending(true)

    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const confirm = formData.get('confirm_password') as string

    if (password !== confirm) {
      setError('Passwords do not match')
      setIsPending(false)
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      setIsPending(false)
      return
    }

    const result = await signUp(formData)
    if (result?.error) {
      if (result.code === 'email_exists') {
        setExistingEmail(email)
      } else {
        setError(result.error)
      }
      setIsPending(false)
      return
    }

    // Sign in on the browser client so onAuthStateChange fires → header updates immediately
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      setError(signInError.message)
      setIsPending(false)
      return
    }

    window.location.href = claimToken ? `/account/claim/${claimToken}` : '/collective'
  }

  return (
    <AuthFormCard
      tag={claimToken ? 'Claim Your Spot' : 'Join the Collective'}
      heading="Create Your Account"
      description={
        claimToken
          ? 'Create a Fendo Golf account to claim your tournament spot.'
          : 'Join a community of golfers who play with intention.'
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {existingEmail && (
          <div className="rounded-xl bg-mustard/10 border border-mustard/30 px-4 py-3 text-sm">
            <p className="font-semibold text-fg">You already have an account</p>
            <p className="text-muted mt-1 leading-relaxed">
              <span className="text-fg font-medium">{existingEmail}</span> is already registered
              with Fendo Golf. Sign in instead, or reset your password if you&apos;ve forgotten it.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
              <Link
                href={`${signInHref}${signInHref.includes('?') ? '&' : '?'}email=${encodeURIComponent(existingEmail)}`}
                className="text-fg font-medium underline underline-offset-2 hover:text-accent transition-colors"
              >
                Sign in
              </Link>
              <Link
                href={`/auth/forgot-password?email=${encodeURIComponent(existingEmail)}`}
                className="text-fg font-medium underline underline-offset-2 hover:text-accent transition-colors"
              >
                Reset your password
              </Link>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        <FormInput
          id="full_name"
          name="full_name"
          label="Full Name"
          placeholder="Jordan Reed"
          required
          autoComplete="name"
        />

        <FormInput
          id="email"
          name="email"
          type="email"
          label="Email"
          placeholder="you@example.com"
          defaultValue={prefillEmail}
          readOnly={!!prefillEmail}
          required
          autoComplete="email"
        />

        <FormInput
          id="password"
          name="password"
          type="password"
          label="Password"
          placeholder="At least 6 characters"
          required
          autoComplete="new-password"
        />

        <FormInput
          id="confirm_password"
          name="confirm_password"
          type="password"
          label="Confirm Password"
          placeholder="Repeat your password"
          required
          autoComplete="new-password"
        />

        <SubmitButton pending={isPending}>Create Account</SubmitButton>

        <p className="text-center text-sm text-muted">
          Already have an account?{' '}
          <Link
            href={signInHref}
            className="text-fg font-medium hover:text-accent transition-colors"
          >
            Sign in
          </Link>
        </p>
      </form>
    </AuthFormCard>
  )
}
