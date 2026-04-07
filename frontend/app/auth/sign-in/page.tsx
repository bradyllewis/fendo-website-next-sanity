'use client'

import { Suspense, useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import AuthFormCard from '@/app/components/auth/AuthFormCard'
import FormInput from '@/app/components/auth/FormInput'
import SubmitButton from '@/app/components/auth/SubmitButton'
import { signIn } from '@/app/auth/actions'

function SignInForm() {
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/collective'
  const authError = searchParams.get('error')

  const [state, formAction] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      const result = await signIn(formData)
      return result ?? null
    },
    null
  )

  const errorMessage =
    state?.error ||
    (authError === 'auth-code-error' ? 'There was a problem verifying your email. Please try again.' : null)

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />

      {errorMessage && (
        <div className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-3 text-sm text-danger">
          {errorMessage}
        </div>
      )}

      <FormInput
        id="email"
        name="email"
        type="email"
        label="Email"
        placeholder="you@example.com"
        required
        autoComplete="email"
      />

      <FormInput
        id="password"
        name="password"
        type="password"
        label="Password"
        placeholder="Your password"
        required
        autoComplete="current-password"
      />

      <SubmitButton>Sign In</SubmitButton>

      <div className="flex items-center justify-between text-sm">
        <Link
          href="/auth/forgot-password"
          className="text-muted hover:text-fg transition-colors"
        >
          Forgot password?
        </Link>
        <Link
          href="/auth/sign-up"
          className="text-fg font-medium hover:text-accent transition-colors"
        >
          Create account
        </Link>
      </div>
    </form>
  )
}

export default function SignInPage() {
  return (
    <AuthFormCard
      tag="Welcome Back"
      heading="Sign In"
      description="Pick up where you left off."
    >
      <Suspense>
        <SignInForm />
      </Suspense>
    </AuthFormCard>
  )
}
