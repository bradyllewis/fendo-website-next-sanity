import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { DEFAULT_REDIRECT, safeRedirectPath } from '@/lib/safeRedirect'

const PROTECTED_ROUTES = ['/collective', '/account', '/admin']
const AUTH_ROUTES = ['/auth/sign-in', '/auth/sign-up', '/auth/forgot-password']

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — MUST use getUser() for server-side validation
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Protect authenticated routes
  if (!user && PROTECTED_ROUTES.some((route) => pathname.startsWith(route))) {
    // Capture the query string alongside the path so a deep link survives the round trip,
    // minus `_rsc` — Next appends that to client-side navigation fetches, and replaying it
    // on the eventual redirect would return an RSC payload instead of a document.
    const params = new URLSearchParams(request.nextUrl.search)
    params.delete('_rsc')
    const query = params.toString()

    // Built from the origin rather than cloning nextUrl, which would carry the protected
    // page's own params onto the sign-in URL alongside `next`.
    const url = new URL('/auth/sign-in', request.nextUrl.origin)
    url.searchParams.set('next', query ? `${pathname}?${query}` : pathname)
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from auth pages, honouring ?next= so a deep link
  // (e.g. an event registration) still lands where it intended instead of the dashboard.
  if (user && AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
    // `next` is attacker-controllable, so it has to be constrained before it becomes a
    // redirect target. /auth/* destinations are refused as well: they would bounce straight
    // back through this branch.
    const target = safeRedirectPath(request.nextUrl.searchParams.get('next'))
    const destination = target.startsWith('/auth/') ? DEFAULT_REDIRECT : target
    // Built from the origin rather than cloning nextUrl, which would carry the auth page's
    // own query string (?next=…, ?email=…) through to the destination.
    return NextResponse.redirect(new URL(destination, request.nextUrl.origin))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|images|api/draft-mode|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
