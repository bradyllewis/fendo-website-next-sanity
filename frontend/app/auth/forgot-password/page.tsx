'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import AuthFormCard from '@/app/components/auth/AuthFormCard'
import FormInput from '@/app/components/auth/FormInput'
import SubmitButton from '@/app/components/auth/SubmitButton'
import { forgotPassword } from '@/app/auth/actions'

export default function ForgotPasswordPage() {
  const [state, formAction] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      const result = await forgotPassword(formData)
      return result ?? null
    },
    null
  )

  return (
    <AuthFormCard
      tag="Password Reset"
      heading="Forgot Your Password?"
      description="Enter your email and we'll send you a link to reset it."
    >
      <form action={formAction} className="flex flex-col gap-4">
        {state?.error && (
          <div className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-3 text-sm text-danger">
            {state.error}
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

        <SubmitButton>Send Reset Link</SubmitButton>

        <p className="text-center text-sm text-muted">
          <Link href="/auth/sign-in" className="text-fg font-medium hover:text-accent transition-colors">
            Back to sign in
          </Link>
        </p>
      </form>
    </AuthFormCard>
  )
}
