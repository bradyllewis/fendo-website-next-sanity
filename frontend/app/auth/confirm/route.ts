import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { safeRedirectPath } from '@/lib/safeRedirect'

/**
 * Redeems an email OTP (password recovery) and establishes the session cookie.
 *
 * We link here from our own emails using `hashed_token` rather than Supabase's
 * `action_link`, because that endpoint returns the session in a URL fragment which
 * never reaches the server.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = safeRedirectPath(searchParams.get('next'))

  if (tokenHash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/forgot-password?error=link-invalid`)
}
