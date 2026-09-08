/**
 * app/api/admin/2fa/setup/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Part 2.8 — Two-Factor Authentication Setup
 * Part 2.9 — Added recovery code generation alongside QR setup
 * ---------------------------------------------------------------------------
 * POST /api/admin/2fa/setup
 * Body: {} — generates a new TOTP secret AND recovery codes, returns them
 * with otpauth URI for QR code display. Does NOT enable 2FA yet.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_COOKIE_NAME, verifySessionTokenWithRevocation } from '@/lib/admin-auth'
import {
  generateTwoFactorSetup,
  generateOTPAuthURI,
} from '@/lib/admin-2fa'

async function getSession(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value
  if (!token) return null
  return verifySessionTokenWithRevocation(token)
}

export async function POST(req: NextRequest) {
  const session = await getSession(req)
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }

  try {
    const { secret, recoveryCodes } = await generateTwoFactorSetup(session.email)
    const otpauthURI = generateOTPAuthURI(session.email, secret)

    return NextResponse.json({
      success: true,
      secret,
      otpauthURI,
      recoveryCodes, // Plaintext codes — displayed once, never stored
    })
  } catch {
    return NextResponse.json(
      { error: 'Failed to generate 2FA setup. Please try again.' },
      { status: 500 },
    )
  }
}