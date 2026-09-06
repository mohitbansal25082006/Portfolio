/**
 * app/api/admin/logout/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * POST  /api/admin/logout
 *
 * Clears the session cookie and redirects to /admin (login page). Also
 * removes this session from the active-sessions tracking store so it no
 * longer shows up on the Security & Session page.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_COOKIE_NAME, verifySessionToken } from '@/lib/admin-auth'
import { removeSession } from '@/lib/admin-security'

export async function POST(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value
  if (token) {
    const payload = verifySessionToken(token)
    if (payload?.sid) {
      await removeSession(payload.sid)
    }
  }

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