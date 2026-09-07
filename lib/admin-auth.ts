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
 * Part 2.6 adds a runtime password-override layer (lib/admin-security.ts):
 * if an admin has changed their password from the dashboard, the override
 * hash takes priority over the .env value for that email — so "change
 * password without touching .env" works identically on serverless and
 * local dev, and survives redeploys.
 *
 * Part 2.8 adds two-factor authentication (2FA):
 * After successful password verification, if 2FA is enabled for the admin,
 * a TOTP code must be provided before a session is created.
 *
 * Sessions are HMAC-SHA256 signed tokens stored in an httpOnly cookie.
 * No external JWT library is required — we use Node's built-in `crypto`.
 * Part 2.6 also embeds a unique `sid` (session id) and `iat` (issued-at) in
 * the payload so individual sessions can be listed/revoked and so a global
 * "force logout all" cutoff can invalidate tokens issued before it, even
 * though their signature remains valid.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createHmac, timingSafeEqual, randomUUID } from 'crypto'
import { getPasswordOverride, verifyPasswordOverride, isRevoked } from '@/lib/admin-security'
import { isTwoFactorEnabled, verifyTwoFactorCode } from '@/lib/admin-2fa'
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

/**
 * Returns true if the supplied email+password match any configured admin.
 * If a runtime password override exists for the email (set via the
 * Security & Session page's "Change password" action), that override is
 * checked instead of the .env value — this is what lets a password change
 * take effect without editing .env or redeploying.
 */
export async function verifyAdminCredentials(email: string, password: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim()
  const creds = getAdminCredentials()
  const knownEmails = new Set(creds.map(c => c.email))
  if (!knownEmails.has(normalizedEmail)) return false

  // Runtime override takes priority when present.
  const override = await getPasswordOverride(normalizedEmail)
  if (override) {
    return verifyPasswordOverride(password, override)
  }

  // Fall back to the .env-configured password.
  for (const cred of creds) {
    if (cred.email !== normalizedEmail) continue
    try {
      const passMatch = timingSafeEqual(Buffer.from(password), Buffer.from(cred.password))
      if (passMatch) return true
    } catch {
      // timingSafeEqual throws if buffers differ in length — that means no match
    }
  }
  return false
}

/**
 * Verifies a plaintext password against the CURRENT effective password for
 * an email (override if set, otherwise .env). Used to confirm the "current
 * password" field before allowing a password change.
 */
export async function verifyCurrentPassword(email: string, password: string): Promise<boolean> {
  return verifyAdminCredentials(email, password)
}

/** True if the given email is one of the configured admin accounts. */
export function isKnownAdminEmail(email: string): boolean {
  const normalized = email.toLowerCase().trim()
  return getAdminCredentials().some(c => c.email === normalized)
}

/**
 * Part 2.8 — Checks if 2FA is required for this admin.
 * Returns true if 2FA is enabled, signaling the login route to prompt
 * for a TOTP code before creating a session.
 */
export async function requiresTwoFactor(email: string): Promise<boolean> {
  return isTwoFactorEnabled(email)
}

/**
 * Part 2.8 — Verifies a TOTP code for an admin.
 * Returns true if the code is valid and not replayed.
 */
export async function verifyTwoFactor(email: string, code: string): Promise<boolean> {
  return verifyTwoFactorCode(email, code)
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
  sid: string // unique per-login session id, for tracking/revocation
  iat: number // Unix timestamp (ms) — issued-at, for the revoke-all cutoff check
  twoFactorVerified?: boolean // Part 2.8 — marks sessions created after 2FA verification
}

/** Creates a signed session token string: base64Payload.signature */
export function createSessionToken(email: string, sessionId?: string): { token: string; sid: string } {
  const sid = sessionId ?? randomUUID()
  const payload: TokenPayload = {
    email: email.toLowerCase().trim(),
    exp: Date.now() + SESSION_DURATION_MS,
    sid,
    iat: Date.now(),
    twoFactorVerified: true, // Part 2.8 — all new sessions are 2FA-verified if required
  }
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', getSecret()).update(payloadB64).digest('base64url')
  return { token: `${payloadB64}.${sig}`, sid }
}

/** Verifies token signature + expiry only (no revocation check). Returns the payload on success, null on failure. */
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

/**
 * Full verification used by server components / API routes: checks
 * signature + expiry (verifySessionToken) AND consults the revoke-all
 * cutoff store, so a "force logout all sessions" action immediately
 * invalidates this token even though its signature is still valid.
 */
export async function verifySessionTokenWithRevocation(token: string): Promise<TokenPayload | null> {
  const payload = verifySessionToken(token)
  if (!payload) return null
  const revoked = await isRevoked(payload.email, payload.iat)
  if (revoked) return null
  return payload
}