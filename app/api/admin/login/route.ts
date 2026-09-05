/**
 * app/api/admin/login/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * POST  /api/admin/login
 * Body: { email: string, password: string }
 *
 * On success → sets an httpOnly session cookie and returns { success: true }.
 * On failure → returns 401 with a generic error message.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  verifyAdminCredentials,
  createSessionToken,
  ADMIN_COOKIE_NAME,
  SESSION_DURATION_MS,
} from '@/lib/admin-auth'

export async function POST(req: NextRequest) {
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

    const valid = verifyAdminCredentials(email, password)
    if (!valid) {
      // Generic message — do not reveal which field was wrong
      return NextResponse.json(
        { error: 'Invalid credentials.' },
        { status: 401 },
      )
    }

    const token = createSessionToken(email)
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
