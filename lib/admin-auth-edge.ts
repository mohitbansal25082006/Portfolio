/**
 * lib/admin-auth-edge.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Edge-runtime-compatible auth utilities.
 * Uses ONLY the Web Crypto API (no Node.js `crypto` module).
 * This file is imported by proxy.ts which runs on the Edge Runtime.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const ADMIN_COOKIE_NAME = 'admin_session'

/**
 * Verifies an HMAC-SHA256 session token using the Web Crypto API.
 * Token format: base64url(payload).base64url(signature)
 */
export async function verifySessionTokenEdge(token: string): Promise<boolean> {
  try {
    const secret = process.env.ADMIN_SESSION_SECRET
    if (!secret || secret.length < 16) return false

    const dotIndex = token.lastIndexOf('.')
    if (dotIndex === -1) return false

    const payloadB64 = token.slice(0, dotIndex)
    const sigB64 = token.slice(dotIndex + 1)
    if (!payloadB64 || !sigB64) return false

    // Import the HMAC key
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    )

    // Decode base64url signature
    const sigBytes = Uint8Array.from(
      atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')),
      c => c.charCodeAt(0),
    )

    // Verify signature over the payload string
    const dataBytes = new TextEncoder().encode(payloadB64)
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, dataBytes)
    if (!valid) return false

    // Decode payload and check expiry
    const payloadJson = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))
    const payload = JSON.parse(payloadJson) as { exp: number }
    if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return false

    return true
  } catch {
    return false
  }
}
