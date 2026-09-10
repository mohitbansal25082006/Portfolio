/**
 * proxy.ts — Next.js 16 Proxy (replaces middleware.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 * Protects all /admin/* routes except the login page (/admin) and the
 * login/logout API routes.
 *
 * Part 3.3 — Also records a hashed-IP page view for every PUBLIC (non-admin,
 * non-API, non-static) request, via lib/site-analytics.ts, so the Analytics
 * dashboard's Total Page Views, Unique Visitors, Visit Trend, Device
 * Breakdown, and Top Referrers panels are all scoped to the deployed
 * portfolio site only, with visitors deduped by real IP address instead of
 * Vercel's cookieless fingerprint. We now also forward the request's
 * User-Agent and Referer header (plus our own host, so same-site navigation
 * isn't miscounted as an external referrer) so device type and referrer can
 * be classified per-visit. Recording is fire-and-forget (not awaited) so it
 * never adds latency to the actual page response, and any failure inside it
 * is swallowed by site-analytics.ts itself.
 *
 * Note: recordSiteVisit (lib/site-analytics.ts) uses Node's `crypto` module
 * for SHA-256 IP hashing. This is safe here because Proxy (proxy.ts) always
 * runs on the Node.js runtime in Next.js — unlike the old middleware.ts,
 * which ran on Edge and required a `runtime` config export to opt into
 * Node.js. Proxy has no such export: Node.js is the only runtime, and
 * declaring `runtime` in `config` is a build error ("Route segment config
 * is not allowed in Proxy file"). verifySessionTokenEdge from
 * lib/admin-auth-edge.ts (Web Crypto API) still works fine here too, since
 * Web Crypto is also available under Node.js.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifySessionTokenEdge, ADMIN_COOKIE_NAME } from '@/lib/admin-auth-edge'
import { recordSiteVisit } from '@/lib/site-analytics'

/** Best-effort client IP extraction, standard proxy header fallback chain. */
function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    // x-forwarded-for can be a comma-separated list; the first entry is the client.
    return forwardedFor.split(',')[0].trim()
  }
  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  // @ts-expect-error — `ip` exists on the Vercel edge request at runtime
  return request.ip ?? 'unknown'
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Part 3.3 — record public-site visits (never awaited, never blocks the
  // response, and internally scoped to skip /admin, /api, and static assets).
  if (!pathname.startsWith('/admin') && !pathname.startsWith('/api')) {
    void recordSiteVisit(
      pathname,
      getClientIp(request),
      request.headers.get('user-agent') ?? '',
      request.headers.get('referer'),
      request.nextUrl.host,
    )
  }

  // Only gate paths under /admin
  if (!pathname.startsWith('/admin')) {
    return NextResponse.next()
  }

  // Public admin paths that don't require a session
  const isLoginPage = pathname === '/admin'
  const isPublicApi =
    pathname === '/api/admin/login' ||
    pathname.startsWith('/api/admin/login/') ||
    pathname === '/api/admin/logout' ||
    pathname.startsWith('/api/admin/logout/')

  if (isPublicApi) {
    return NextResponse.next()
  }

  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value
  const sessionValid = token ? await verifySessionTokenEdge(token) : false

  // Already logged in + visiting login page → redirect to dashboard
  if (isLoginPage && sessionValid) {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url))
  }

  // Not logged in + visiting a protected route → redirect to login
  if (!isLoginPage && !sessionValid) {
    const loginUrl = new URL('/admin', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  // Two matcher entries, non-overlapping in intent:
  //  1. Everything except Next internals/static assets/common static files
  //     — this is what lets recordSiteVisit() fire on real page loads
  //     (/, /about, etc). A single combined regex here previously failed
  //     to match public routes correctly, which silently stopped writes
  //     to site-analytics — that's why Total Views / Unique Visitors /
  //     Device Breakdown / Top Referrers all went empty even though
  //     /admin/analytics itself loaded fine.
  //  2. This pattern already includes /admin/* and /api/admin/* (proxy()
  //     branches internally on pathname for those), so no separate
  //     /admin or /api/admin entries are declared — duplicate entries
  //     matching the same path previously caused a 404 on /admin/*.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|map|txt|xml)$).*)',
  ],
}