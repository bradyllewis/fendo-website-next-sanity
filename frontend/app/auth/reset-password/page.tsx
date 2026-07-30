import Link from 'next/link'
import AuthFormCard from '@/app/components/auth/AuthFormCard'
import { createClient } from '@/lib/supabase/server'
import ResetPasswordForm from './ResetPasswordForm'

export default async function ResetPasswordPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Reaching this page without a session means the recovery link was never redeemed
  // (expired, already used, or opened directly).
  if (!user) {
    return (
      <AuthFormCard
        tag="Security"
        heading="Link Expired"
        description="This password reset link is no longer valid. Reset links expire one hour after they're sent and can only be used once."
      >
        <div className="flex flex-col gap-3">
          <Link href="/auth/forgot-password" className="btn-accent w-full justify-center">
            Request a New Link
          </Link>
          <Link href="/auth/sign-in" className="btn-ghost text-sm text-center">
            Back to sign in
          </Link>
        </div>
      </AuthFormCard>
    )
  }

  return (
    <AuthFormCard
      tag="Security"
      heading="Set New Password"
      description="Choose a strong password for your account."
    >
      <ResetPasswordForm />
    </AuthFormCard>
  )
}
