'use client'

import { useActionState } from 'react'
import AuthFormCard from '@/app/components/auth/AuthFormCard'
import FormInput from '@/app/components/auth/FormInput'
import SubmitButton from '@/app/components/auth/SubmitButton'
import { resetPassword } from '@/app/auth/actions'

export default function ResetPasswordPage() {
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
      const result = await resetPassword(formData)
      return result ?? null
    },
    null
  )

  return (
    <AuthFormCard
      tag="Security"
      heading="Set New Password"
      description="Choose a strong password for your account."
    >
      <form action={formAction} className="flex flex-col gap-4">
        {state?.error && (
          <div className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-3 text-sm text-danger">
            {state.error}
          </div>
        )}

        <FormInput
          id="password"
          name="password"
          type="password"
          label="New Password"
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

        <SubmitButton>Update Password</SubmitButton>
      </form>
    </AuthFormCard>
  )
}
