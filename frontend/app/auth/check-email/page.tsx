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
          We sent a password reset link to your email address. Click that link to choose a new password — it only takes a second.
        </p>

        <div className="mt-6 rounded-xl border border-border bg-surface px-5 py-4 text-left space-y-2 max-w-sm mx-auto">
          <p className="text-xs font-semibold text-fg">What to look for:</p>
          <ul className="text-xs text-muted space-y-1 list-disc list-inside">
            <li>Subject: <span className="text-fg font-medium">Reset your Fendo Golf password</span></li>
            <li>Sent from: <span className="text-fg font-medium">noreply@fendogolf.com</span></li>
            <li>The link expires after <span className="text-fg font-medium">1 hour</span></li>
          </ul>
        </div>

        <div className="mt-6 flex flex-col gap-3 items-center">
          <Link href="/auth/sign-in" className="btn-outline text-sm">
            Back to Sign In
          </Link>
          <p className="text-xs text-muted-2">
            Can&apos;t find it? Check your <span className="font-medium text-muted">spam or junk folder</span>.
          </p>
        </div>
      </div>
    </section>
  )
}
