/**
 * app/api/admin/security/logout-all-except/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Part 3.2 — Logout all sessions except current device
 * ---------------------------------------------------------------------------
 * POST /api/admin/security/logout-all-except
 *   Body: {} — revokes every session for the current admin EXCEPT the
 *   current session. Does NOT clear the caller's cookie.
 *
 * Requires a valid, non-revoked session.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_COOKIE_NAME, verifySessionTokenWithRevocation } from '@/lib/admin-auth'
import { revokeAllSessionsExcept } from '@/lib/admin-security'

export async function POST(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }

  const session = await verifySessionTokenWithRevocation(token)
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }

  try {
    const revokedCount = await revokeAllSessionsExcept(session.email, session.sid)
    return NextResponse.json({ success: true, revokedCount })
  } catch (error) {
    console.error('Error revoking other sessions:', error)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}