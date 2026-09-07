/**
 * app/api/admin/2fa/setup/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Part 2.8 — Two-Factor Authentication Setup
 * ---------------------------------------------------------------------------
 * POST /api/admin/2fa/setup
 * Body: {} — generates a new TOTP secret and returns it with otpauth URI
 * for QR code display. Does NOT enable 2FA yet.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_COOKIE_NAME, verifySessionTokenWithRevocation } from '@/lib/admin-auth'
import {
  generateTwoFactorSecret,
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
    const secret = await generateTwoFactorSecret(session.email)
    const otpauthURI = generateOTPAuthURI(session.email, secret)

    return NextResponse.json({
      success: true,
      secret,
      otpauthURI,
    })
  } catch {
    return NextResponse.json(
      { error: 'Failed to generate 2FA setup. Please try again.' },
      { status: 500 },
    )
  }
}