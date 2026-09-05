/**
 * proxy.ts — Next.js 16 Proxy (replaces middleware.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 * Protects all /admin/* routes except the login page (/admin) and the
 * login/logout API routes.
 *
 * Imports ONLY from lib/admin-auth-edge.ts which uses the Web Crypto API —
 * no Node.js modules, fully compatible with the Edge Runtime.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifySessionTokenEdge, ADMIN_COOKIE_NAME } from '@/lib/admin-auth-edge'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

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
  matcher: ['/admin/:path*', '/api/admin/:path*'],
}
