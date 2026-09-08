/**
 * app/api/admin/security/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Part 2.6 — Security & Session
 * Part 2.9 — Added IP geolocation for sessions
 * ---------------------------------------------------------------------------
 * GET  /api/admin/security
 *   Returns the current admin's active sessions (with geolocation info),
 *   the full login attempt log, and storage status.
 *
 * POST /api/admin/security/logout-all
 *   Body: {} — revokes every session for the CURRENTLY authenticated
 *   admin's email (not other admins). Clears the caller's own cookie too,
 *   since their current session is revoked along with the rest.
 *
 * PUT  /api/admin/security/password
 *   Body: { currentPassword: string, newPassword: string }
 *   Verifies currentPassword against the effective password (override or
 *   .env), then writes a new override so future logins use the new
 *   password — no .env edit or redeploy required.
 *
 * All three actions require a valid, non-revoked session — enforced the
 * same way as every other /api/admin/* route: reading + verifying the
 * ADMIN_COOKIE_NAME cookie server-side via verifySessionTokenWithRevocation.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  ADMIN_COOKIE_NAME,
  verifySessionTokenWithRevocation,
  verifyCurrentPassword,
  isKnownAdminEmail,
} from '@/lib/admin-auth'
import {
  getActiveSessions,
  getLoginAttempts,
  revokeAllSessions,
  setPasswordOverride,
  getSecurityStorageStatus,
} from '@/lib/admin-security'
import { batchGetGeoLocations } from '@/lib/ip-geolocation'

async function getSession(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value
  if (!token) return null
  return verifySessionTokenWithRevocation(token)
}

// ─── GET — sessions + login log + geolocation ──────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getSession(req)
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }

  const [allSessions, loginAttempts] = await Promise.all([
    getActiveSessions(),
    getLoginAttempts({ limit: 100 }),
  ])

  // Only show the current admin's own sessions on the "active sessions"
  // list, since that's what "your" active sessions should mean — but the
  // login attempt log stays global so failed attempts against ANY admin
  // account are visible for auditing.
  const mySessions = allSessions.filter(s => s.email === session.email)

  // Part 2.9 — Get geolocation for session IPs (batch lookup with caching)
  const sessionIps = [...new Set(mySessions.map(s => s.ip))]
  const geoLocations = await batchGetGeoLocations(sessionIps)

  // Attach geolocation to each session
  const sessionsWithGeo = mySessions.map(s => ({
    ...s,
    location: geoLocations[s.ip] || null,
  }))

  return NextResponse.json({
    sessions: sessionsWithGeo,
    currentSessionId: session.sid,
    loginAttempts,
    storage: getSecurityStorageStatus(),
  })
}

// ─── POST — force logout all sessions ───────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getSession(req)
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }

  const revokedCount = await revokeAllSessions(session.email)

  const res = NextResponse.json({ success: true, revokedCount })
  // The caller's own session was just revoked too — clear their cookie so
  // the client-side redirect to /admin doesn't bounce through a stale
  // "still logged in" state.
  res.cookies.set(ADMIN_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  })
  return res
}

// ─── PUT — change password ───────────────────────────────────────────────────

export async function PUT(req: NextRequest) {
  const session = await getSession(req)
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const currentPassword: string = (body?.currentPassword ?? '').trim()
    const newPassword: string = (body?.newPassword ?? '').trim()

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Current and new password are required.' },
        { status: 400 },
      )
    }
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'New password must be at least 8 characters.' },
        { status: 400 },
      )
    }
    if (newPassword === currentPassword) {
      return NextResponse.json(
        { error: 'New password must be different from the current password.' },
        { status: 400 },
      )
    }
    if (!isKnownAdminEmail(session.email)) {
      // Defensive — session email should always match a configured admin.
      return NextResponse.json({ error: 'Account not recognised.' }, { status: 403 })
    }

    const currentValid = await verifyCurrentPassword(session.email, currentPassword)
    if (!currentValid) {
      return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 401 })
    }

    await setPasswordOverride(session.email, newPassword)

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}