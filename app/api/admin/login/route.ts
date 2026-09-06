/**
 * app/api/admin/login/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * POST  /api/admin/login
 * Body: { email: string, password: string }
 *
 * On success → sets an httpOnly session cookie, registers the session in the
 * active-sessions store (lib/admin-security.ts), logs the successful attempt,
 * and returns { success: true }.
 * On failure → logs the failed attempt (email/IP/timestamp) and returns 401
 * with a generic error message.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  verifyAdminCredentials,
  createSessionToken,
  ADMIN_COOKIE_NAME,
  SESSION_DURATION_MS,
} from '@/lib/admin-auth'
import { logLoginAttempt, registerSession } from '@/lib/admin-security'

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const userAgent = req.headers.get('user-agent') ?? 'unknown'

  try {
    const body = await req.json()
    const email: string = (body?.email ?? '').trim()
    const password: string = (body?.password ?? '').trim()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required.' },
        { status: 400 },
      )
    }

    const valid = await verifyAdminCredentials(email, password)
    if (!valid) {
      await logLoginAttempt({ email, ip, userAgent, success: false, reason: 'invalid_credentials' })
      // Generic message — do not reveal which field was wrong
      return NextResponse.json(
        { error: 'Invalid credentials.' },
        { status: 401 },
      )
    }

    const sid = await registerSession({ email, ip, userAgent })
    const { token } = createSessionToken(email, sid)
    await logLoginAttempt({ email, ip, userAgent, success: true, reason: 'success' })

    const res = NextResponse.json({ success: true })

    res.cookies.set(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: SESSION_DURATION_MS / 1000, // seconds
    })

    return res
  } catch {
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 },
    )
  }
}