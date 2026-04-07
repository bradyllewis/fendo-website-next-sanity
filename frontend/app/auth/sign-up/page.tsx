'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import AuthFormCard from '@/app/components/auth/AuthFormCard'
import FormInput from '@/app/components/auth/FormInput'
import SubmitButton from '@/app/components/auth/SubmitButton'
import { signUp } from '@/app/auth/actions'

export default function SignUpPage() {
  const [state, formAction] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      const password = formData.get('password') as string
      const confirm = formData.get('confirm_password') as string
      if (password !== confirm) {
        return { error: 'Passwords do not match' }
      }
      if (password.length < 6) {
        return { error: 'Password must be at least 6 characters' }
      }
      const result = await signUp(formData)
      return result ?? null
    },
    null
  )

  return (
    <AuthFormCard
      tag="Join the Collective"
      heading="Create Your Account"
      description="Join a community of golfers who play with intention."
    >
      <form action={formAction} className="flex flex-col gap-4">
        {state?.error && (
          <div className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-3 text-sm text-danger">
            {state.error}
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

        <SubmitButton>Create Account</SubmitButton>

        <p className="text-center text-sm text-muted">
          Already have an account?{' '}
          <Link href="/auth/sign-in" className="text-fg font-medium hover:text-accent transition-colors">
            Sign in
          </Link>
        </p>
      </form>
    </AuthFormCard>
  )
}
