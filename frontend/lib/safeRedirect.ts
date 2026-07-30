/**
 * Constrains a caller-supplied post-auth redirect (`?next=…`) to a same-origin path.
 *
 * `next` reaches us from the query string, so it is attacker-controllable: a phishing link
 * to our own sign-in page can hand the victim off to another host after a legitimate login.
 * Two distinct vectors have to be closed, which is why this is centralised rather than
 * open-coded at each call site:
 *
 *   - Consumers that navigate to the value directly (`window.location.assign(next)`) are
 *     exposed to `https://evil.com` and to protocol-relative `//evil.com`.
 *   - Consumers that interpolate it (`` `${origin}${next}` ``) are exposed to the URL
 *     userinfo trick: `https://our.site@evil.com` has host `evil.com`.
 *
 * Returns `fallback` for anything that is not a plain root-relative path.
 */

const BASE = 'https://fendo.invalid'

export const DEFAULT_REDIRECT = '/collective'

export function safeRedirectPath(
  value: string | null | undefined,
  fallback: string = DEFAULT_REDIRECT
): string {
  const trimmed = value?.trim()
  if (!trimmed) return fallback

  let path: string
  try {
    // Resolving against an opaque base collapses every escape attempt into an origin
    // mismatch: absolute URLs, protocol-relative hosts and `javascript:` all leave BASE.
    const url = new URL(trimmed, BASE)
    if (url.origin !== BASE) return fallback
    path = `${url.pathname}${url.search}${url.hash}`
  } catch {
    return fallback
  }

  // WHATWG parsing normalises `/\evil.com` to `//evil.com`, which a browser then reads as
  // protocol-relative. Re-check the resolved path rather than trusting the input shape.
  if (!path.startsWith('/') || path.startsWith('//')) return fallback

  return path
}
