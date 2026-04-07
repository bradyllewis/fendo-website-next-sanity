import Link from 'next/link'
import { IconMail } from '@/app/components/icons'

export default function CheckEmailPage() {
  return (
    <section className="relative min-h-[calc(100vh-5rem)] flex items-center justify-center py-16">
      <div
        className="absolute inset-0 bg-[url('/images/tile-grid-black.png')] opacity-[0.025]"
        style={{ backgroundSize: '24px' }}
        aria-hidden="true"
      />

      <div className="container relative w-full max-w-md text-center">
        <div className="mx-auto mb-6 w-16 h-16 rounded-full bg-green/10 flex items-center justify-center">
          <IconMail className="w-7 h-7 text-green" />
        </div>

        <span className="label-mono-accent">Almost There</span>
        <h1 className="display-md mt-3">Check Your Inbox</h1>
        <p className="text-muted mt-4 text-sm leading-relaxed max-w-sm mx-auto">
          We sent you an email with a confirmation link.
          Click the link to verify your account and get started.
        </p>

        <div className="mt-8 flex flex-col gap-3 items-center">
          <Link href="/auth/sign-in" className="btn-outline text-sm">
            Back to Sign In
          </Link>
          <p className="text-xs text-muted-2">
            Didn&apos;t receive it? Check your spam folder.
          </p>
        </div>
      </div>
    </section>
  )
}
