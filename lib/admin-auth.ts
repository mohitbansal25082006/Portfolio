/**
 * lib/admin-auth.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Server-only utilities for admin authentication.
 *
 * Credentials are read from environment variables following the convention:
 *   ADMIN_MAIL1 / ADMIN_PASSWORD1
 *   ADMIN_MAIL2 / ADMIN_PASSWORD2
 *   … (unlimited)
 *
 * Sessions are HMAC-SHA256 signed tokens stored in an httpOnly cookie.
 * No external JWT library is required — we use Node's built-in `crypto`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createHmac, timingSafeEqual } from 'crypto'
// Re-export so server-side code can import ADMIN_COOKIE_NAME from here
export { ADMIN_COOKIE_NAME } from '@/lib/admin-auth-edge'

// ─── Constants ───────────────────────────────────────────────────────────────

export const SESSION_DURATION_MS = 8 * 60 * 60 * 1000 // 8 hours


// ─── Credential helpers ───────────────────────────────────────────────────────

/** Reads all ADMIN_MAILn / ADMIN_PASSWORDn pairs from process.env. */
export function getAdminCredentials(): Array<{ email: string; password: string }> {
  const creds: Array<{ email: string; password: string }> = []
  let i = 1
  while (true) {
    const email = process.env[`ADMIN_MAIL${i}`]?.trim()
    const password = process.env[`ADMIN_PASSWORD${i}`]?.trim()
    if (!email || !password) break
    creds.push({ email: email.toLowerCase(), password })
    i++
  }
  return creds
}

/** Returns true if the supplied email+password match any configured admin. */
export function verifyAdminCredentials(email: string, password: string): boolean {
  const creds = getAdminCredentials()
  if (creds.length === 0) return false

  for (const cred of creds) {
    try {
      const emailMatch = timingSafeEqual(
        Buffer.from(email.toLowerCase().trim()),
        Buffer.from(cred.email),
      )
      const passMatch = timingSafeEqual(
        Buffer.from(password),
        Buffer.from(cred.password),
      )
      if (emailMatch && passMatch) return true
    } catch {
      // timingSafeEqual throws if buffers differ in length — that means no match
    }
  }
  return false
}

// ─── Session token helpers ────────────────────────────────────────────────────

function getSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET
  if (!secret || secret.length < 16) {
    throw new Error('ADMIN_SESSION_SECRET env var is missing or too short (min 16 chars).')
  }
  return secret
}

/** Payload stored inside the signed token. */
interface TokenPayload {
  email: string
  exp: number // Unix timestamp (ms)
}

/** Creates a signed session token string: base64Payload.signature */
export function createSessionToken(email: string): string {
  const payload: TokenPayload = {
    email: email.toLowerCase().trim(),
    exp: Date.now() + SESSION_DURATION_MS,
  }
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', getSecret()).update(payloadB64).digest('base64url')
  return `${payloadB64}.${sig}`
}

/** Verifies token signature + expiry. Returns the payload on success, null on failure. */
export function verifySessionToken(token: string): TokenPayload | null {
  try {
    const [payloadB64, sig] = token.split('.')
    if (!payloadB64 || !sig) return null

    const expectedSig = createHmac('sha256', getSecret())
      .update(payloadB64)
      .digest('base64url')

    // Constant-time comparison
    const sigBuf = Buffer.from(sig)
    const expectedBuf = Buffer.from(expectedSig)
    if (sigBuf.length !== expectedBuf.length) return null
    if (!timingSafeEqual(sigBuf, expectedBuf)) return null

    const payload: TokenPayload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString())
    if (payload.exp < Date.now()) return null // expired

    return payload
  } catch {
    return null
  }
}

