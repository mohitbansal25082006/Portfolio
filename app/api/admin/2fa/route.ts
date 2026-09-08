/**
 * app/api/admin/2fa/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Part 2.8 — Two-Factor Authentication API
 * Part 2.9 — Added recovery code management endpoints
 * ---------------------------------------------------------------------------
 * Base endpoint for 2FA management:
 *
 * GET    /api/admin/2fa           — Returns 2FA status + recovery code info
 * DELETE /api/admin/2fa           — Disables 2FA (requires current code)
 * POST   /api/admin/2fa/recovery  — Regenerates recovery codes
 *
 * Sub-routes (separate files):
 * POST   /api/admin/2fa/setup     — Generates new secret + recovery codes
 * POST   /api/admin/2fa/verify    — Verifies code and enables 2FA
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_COOKIE_NAME, verifySessionTokenWithRevocation } from '@/lib/admin-auth'
import {
  getTwoFactorConfig,
  disableTwoFactor,
  generateOTPAuthURI,
  verifyTwoFactorCode,
  getTwoFactorStorageStatus,
  getRecoveryCodeStatus,
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

// ─── GET — current 2FA status + recovery code info ─────────────────────────

export async function GET(req: NextRequest) {
  const session = await getSession(req)
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }

  const config = await getTwoFactorConfig(session.email)
  const recoveryStatus = await getRecoveryCodeStatus(session.email)

  if (!config || !config.enabled) {
    // If there's a pending setup (secret generated but not verified),
    // return it so the UI can show the QR code again
    if (config && !config.enabled && config.secret) {
      return NextResponse.json({
        enabled: false,
        pendingSetup: true,
        secret: config.secret,
        otpauthURI: generateOTPAuthURI(session.email, config.secret),
        storage: getTwoFactorStorageStatus(),
      })
    }

    return NextResponse.json({
      enabled: false,
      pendingSetup: false,
      storage: getTwoFactorStorageStatus(),
    })
  }

  return NextResponse.json({
    enabled: true,
    enabledAt: config.enabledAt,
    recoveryCodes: recoveryStatus, // Only counts + dates, never actual codes
    storage: getTwoFactorStorageStatus(),
  })
}

// ─── DELETE — disable 2FA ────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const session = await getSession(req)
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const code: string = (body?.code ?? '').trim()

    if (!code || !/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { error: 'Enter your current 6-digit code to disable 2FA.' },
        { status: 400 },
      )
    }

    // Verify the code before disabling
    const valid = await verifyTwoFactorCode(session.email, code)
    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid code. 2FA was not disabled.' },
        { status: 401 },
      )
    }

    await disableTwoFactor(session.email)

    const ip = getClientIp(req)
    const userAgent = req.headers.get('user-agent') ?? 'unknown'
    await logLoginAttempt({
      email: session.email,
      ip,
      userAgent,
      success: true,
      reason: '2fa_disabled',
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: 'Failed to disable 2FA. Please try again.' },
      { status: 500 },
    )
  }
}