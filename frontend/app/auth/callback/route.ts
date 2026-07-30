import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { safeRedirectPath } from '@/lib/safeRedirect'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeRedirectPath(searchParams.get('next'))

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Auth code error — redirect to sign-in with error
  return NextResponse.redirect(`${origin}/auth/sign-in?error=auth-code-error`)
}
