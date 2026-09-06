/**
 * lib/admin-auth-edge.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Edge-runtime-compatible auth utilities.
 * Uses ONLY the Web Crypto API + fetch (no Node.js `crypto`/`fs` modules).
 * This file is imported by proxy.ts which runs on the Edge Runtime.
 *
 * Part 2.6 adds an edge-safe revocation check: "Force logout all sessions"
 * (lib/admin-security.ts) writes a per-email cutoff timestamp to the same
 * security store used by every other admin page. The proxy needs to reject
 * an otherwise-valid, unexpired token if it was issued before that cutoff —
 * but the proxy runs on the Edge Runtime, so it can't use Node's `fs` (local
 * JSON fallback) or the `@upstash/redis` SDK (built on Node APIs in some
 * paths). Instead, when Redis IS configured, we call Upstash's REST API
 * directly with `fetch`, which is Edge-safe. When Redis is NOT configured
 * (local dev, JSON-file fallback), there is no Edge-safe way to read the
 * local file, so revocation in that mode is enforced by the server-side
 * double-check instead (see lib/admin-auth.ts's
 * verifySessionTokenWithRevocation, used by every server component/API
 * route under /admin). This keeps the proxy fast-path working everywhere
 * and still guarantees revocation is enforced before any protected page
 * or API route actually renders/executes.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const ADMIN_COOKIE_NAME = 'admin_session'

interface EdgeTokenPayload {
  email: string
  exp: number
  sid?: string
  iat?: number
}

/**
 * Decodes + verifies an HMAC-SHA256 session token using the Web Crypto API.
 * Token format: base64url(payload).base64url(signature)
 * Returns the decoded payload on success, or null on any failure.
 */
async function decodeAndVerify(token: string): Promise<EdgeTokenPayload | null> {
  try {
    const secret = process.env.ADMIN_SESSION_SECRET
    if (!secret || secret.length < 16) return null

    const dotIndex = token.lastIndexOf('.')
    if (dotIndex === -1) return null

    const payloadB64 = token.slice(0, dotIndex)
    const sigB64 = token.slice(dotIndex + 1)
    if (!payloadB64 || !sigB64) return null

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    )

    const sigBytes = Uint8Array.from(
      atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')),
      c => c.charCodeAt(0),
    )

    const dataBytes = new TextEncoder().encode(payloadB64)
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, dataBytes)
    if (!valid) return null

    const payloadJson = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))
    const payload = JSON.parse(payloadJson) as EdgeTokenPayload
    if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return null

    return payload
  } catch {
    return null
  }
}

/**
 * Edge-safe best-effort revocation check against Upstash's REST API.
 * Returns true if the token's email has a revoke-all cutoff AFTER the
 * token's issued-at time (i.e. the token should be treated as revoked).
 * Fails OPEN (returns false / "not revoked") on any error or when Redis
 * isn't configured — the authoritative check still happens server-side
 * via verifySessionTokenWithRevocation, so the proxy failing open here
 * only means a revoked-but-not-yet-caught request reaches the server
 * component, which then rejects it anyway.
 */
async function isRevokedEdge(email: string, issuedAtMs: number | undefined): Promise<boolean> {
  if (!issuedAtMs) return false // older tokens without `iat` predate revocation support
  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN
  if (!url || !token) return false // no Redis configured — server-side check covers this case

  try {
    const res = await fetch(`${url}/get/portfolio:security`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return false
    const data = await res.json()
    const raw = data?.result
    if (!raw) return false
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    const cutoff = parsed?.revokedBefore?.[email.toLowerCase().trim()]
    return typeof cutoff === 'number' && issuedAtMs < cutoff
  } catch {
    return false
  }
}

/**
 * Verifies an HMAC-SHA256 session token (signature + expiry) using the Web
 * Crypto API, AND best-effort checks the Edge-reachable revocation cutoff.
 * Kept as a boolean-returning function for backward compatibility with the
 * existing proxy.ts contract.
 */
export async function verifySessionTokenEdge(token: string): Promise<boolean> {
  const payload = await decodeAndVerify(token)
  if (!payload) return false
  const revoked = await isRevokedEdge(payload.email, payload.iat)
  if (revoked) return false
  return true
}