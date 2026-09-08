/**
 * app/api/admin/2fa/recovery/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Part 2.9 — Recovery Code Regeneration
 * ---------------------------------------------------------------------------
 * POST /api/admin/2fa/recovery
 * Body: { code: string } — verifies current TOTP code, then regenerates
 * recovery codes. Returns new plaintext codes (displayed once).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_COOKIE_NAME, verifySessionTokenWithRevocation } from '@/lib/admin-auth'
import {
  verifyTwoFactorCode,
  regenerateRecoveryCodes,
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
        { error: 'Enter your current 6-digit code to regenerate recovery codes.' },
        { status: 400 },
      )
    }

    // Verify current TOTP code before regenerating
    const valid = await verifyTwoFactorCode(session.email, code)
    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid code. Recovery codes were not regenerated.' },
        { status: 401 },
      )
    }

    // Regenerate recovery codes and get new plaintext codes
    const newRecoveryCodes = await regenerateRecoveryCodes(session.email)

    const ip = getClientIp(req)
    const userAgent = req.headers.get('user-agent') ?? 'unknown'
    await logLoginAttempt({
      email: session.email,
      ip,
      userAgent,
      success: true,
      reason: 'recovery_codes_regenerated',
    })

    // Return the new codes in the response
    return NextResponse.json({
      success: true,
      recoveryCodes: newRecoveryCodes, // Plaintext — displayed once
    })
  } catch {
    return NextResponse.json(
      { error: 'Failed to regenerate recovery codes. Please try again.' },
      { status: 500 },
    )
  }
}