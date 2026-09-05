/**
 * app/api/admin/logout/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * POST  /api/admin/logout
 *
 * Clears the session cookie and redirects to /admin (login page).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextResponse } from 'next/server'
import { ADMIN_COOKIE_NAME } from '@/lib/admin-auth'

export async function POST() {
  const res = NextResponse.json({ success: true })
  res.cookies.set(ADMIN_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0, // immediately expire
  })
  return res
}
