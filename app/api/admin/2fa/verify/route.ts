/**
 * app/api/admin/2fa/verify/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Part 2.8 — Two-Factor Authentication Verification
 * ---------------------------------------------------------------------------
 * POST /api/admin/2fa/verify
 * Body: { code: string } — verifies the TOTP code from setup and enables 2FA.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_COOKIE_NAME, verifySessionTokenWithRevocation } from '@/lib/admin-auth'
import {
  enableTwoFactor,
} from '@/lib/admin-2fa'
import { logLoginAttempt } from '@/lib/admin-security'

async function getSession(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value
  if (!token) return null
  return verifySessionTokenWithRevocation(token)
}

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

export async function POST(req: NextRequest) {
  const session = await getSession(req)
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const code: string = (body?.code ?? '').trim()

    if (!code || !/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { error: 'Enter the 6-digit code from your authenticator app.' },
        { status: 400 },
      )
    }

    const enabled = await enableTwoFactor(session.email, code)
    if (!enabled) {
      return NextResponse.json(
        { error: 'Invalid code. Please try again.' },
        { status: 401 },
      )
    }

    const ip = getClientIp(req)
    const userAgent = req.headers.get('user-agent') ?? 'unknown'
    await logLoginAttempt({
      email: session.email,
      ip,
      userAgent,
      success: true,
      reason: '2fa_enabled',
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: 'Failed to verify 2FA code. Please try again.' },
      { status: 500 },
    )
  }
}