/**
 * app/api/admin/login/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * POST  /api/admin/login
 * Body: { email: string, password: string, twoFactorCode?: string }
 *
 * Part 2.8 — Two-Factor Authentication flow:
 *   1. Verify email + password
 *   2. If 2FA is enabled for this admin, check for twoFactorCode
 *      - If no code provided: return { twoFactorRequired: true }
 *      - If code provided: verify TOTP code
 *
 * Part 2.9 — Recovery codes:
 *   - Recovery codes can be used as fallback when authenticator is unavailable
 *   - Format: XXXX-XXXX-XX (10 characters + hyphens)
 *   - Each recovery code is single-use
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
  requiresTwoFactor,
  verifyTwoFactor,
} from '@/lib/admin-auth'
import { verifyRecoveryCode } from '@/lib/admin-2fa'
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
    const twoFactorCode: string = (body?.twoFactorCode ?? '').trim()

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

    // Part 2.8 — Check if 2FA is required
    const twoFactorRequired = await requiresTwoFactor(email)
    if (twoFactorRequired) {
      if (!twoFactorCode) {
        // Password is correct, but 2FA code is needed
        return NextResponse.json(
          { twoFactorRequired: true },
          { status: 200 },
        )
      }

      // Part 2.9 — Try TOTP first, then recovery code
      const twoFactorValid = await verifyTwoFactor(email, twoFactorCode)
      if (twoFactorValid) {
        // Valid TOTP code
      } else {
        // Part 2.9 — Check if it's a recovery code (format: XXXX-XXXX-XX)
        const isRecoveryCodeFormat = /^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{2}$/.test(twoFactorCode)
        if (isRecoveryCodeFormat) {
          const recoveryValid = await verifyRecoveryCode(email, twoFactorCode)
          if (!recoveryValid) {
            await logLoginAttempt({ email, ip, userAgent, success: false, reason: 'invalid_recovery_code' })
            return NextResponse.json(
              { error: 'Invalid two-factor authentication code or recovery code.' },
              { status: 401 },
            )
          }
          // Valid recovery code — log and continue
        } else {
          await logLoginAttempt({ email, ip, userAgent, success: false, reason: 'invalid_2fa_code' })
          return NextResponse.json(
            { error: 'Invalid two-factor authentication code.' },
            { status: 401 },
          )
        }
      }
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