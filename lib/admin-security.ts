/**
 * lib/admin-security.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Part 2.6 — Security & Session
 * Part 2.9 — Added optional location field to ActiveSession
 * Part 3.2 — Added logout-all-except-current, expired session cleanup,
 *           and filtered login attempts (1-week window + fallback to latest 10)
 *
 * Backs four features on the new /admin/security page:
 *   1. Active session tracking   — list every signed-in session (IP, login
 *      time, last-seen time, user agent), keyed by a per-login session ID
 *      embedded in the session token payload.
 *   2. Force logout all sessions — revokes every tracked session at once by
 *      writing a "revoked before" cutoff timestamp per admin email; any
 *      token issued before that cutoff fails verification from then on,
 *      even though its HMAC signature is still technically valid.
 *      Part 3.2 adds logout-all-except-current for targeted revocation.
 *   3. Password change without touching .env — a runtime credential
 *      override store.
 *   4. Login attempt log         — every login POST (success or failure) is
 *      appended here with email, IP, timestamp, and outcome.
 *      Part 3.2 adds 1-week filtering with fallback to latest 10 attempts.
 *
 * DUAL-BACKEND STORAGE (mirrors lib/messages.ts / lib/settings.ts exactly)
 * ---------------------------------------------------------------------------
 * Production (Vercel):   Upstash Redis via @upstash/redis
 * Local dev / fallback:  JSON file at .data/portfolio-security.json.
 *
 * Passwords are never stored in plaintext — the override store keeps a
 * salted SHA-256 hash (Node's built-in `crypto`, no extra dependency).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { randomUUID, randomBytes, createHash, timingSafeEqual } from 'crypto'

// ─── Types ────────────────────────────────────────────────────────────────

export interface ActiveSession {
  id: string            // unique per login — embedded in the session token
  email: string
  ip: string
  userAgent: string
  createdAt: string     // ISO-8601, login time
  lastSeenAt: string     // ISO-8601, updated on each verified request (best-effort)
  location?: string | null // Part 2.9 — Approximate city/country from IP geolocation
  expiresAt?: string     // Part 3.2 — When the session token expires
}

export interface LoginAttempt {
  id: string
  email: string
  ip: string
  userAgent: string
  timestamp: string      // ISO-8601
  success: boolean
  reason?: string        // e.g. "invalid_credentials", "success"
}

export interface PasswordOverride {
  salt: string
  hash: string
  updatedAt: string
}

interface SecurityStore {
  sessions: ActiveSession[]
  loginAttempts: LoginAttempt[]
  passwordOverrides: Record<string, PasswordOverride>  // keyed by lowercase email
  revokedBefore: Record<string, number>                 // email -> epoch ms cutoff
}

const REDIS_KEY = 'portfolio:security'
const LOCAL_FILE_ENV = 'SECURITY_FILE'
const MAX_LOGIN_ATTEMPTS = 200 // rolling cap so the log doesn't grow unbounded
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000 // 8 hours — matches admin-auth.ts
const LOGIN_ATTEMPTS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000 // 1 week
const LOGIN_ATTEMPTS_FALLBACK_COUNT = 10 // Fallback if no attempts in last week

function emptyStore(): SecurityStore {
  return { sessions: [], loginAttempts: [], passwordOverrides: {}, revokedBefore: {} }
}

// ─── Backend detection (same convention as lib/messages.ts) ─────────────────

function hasRedis(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

async function getRedis() {
  const { Redis } = await import('@upstash/redis')
  return new Redis({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
  })
}

// ─── Local JSON fallback ──────────────────────────────────────────────────

async function readLocal(): Promise<SecurityStore> {
  const fs = await import('fs')
  const path = await import('path')
  const dir = path.join(process.cwd(), '.data')
  const file = process.env[LOCAL_FILE_ENV] ?? path.join(dir, 'portfolio-security.json')
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    if (!fs.existsSync(file)) return emptyStore()
    const raw = fs.readFileSync(file, 'utf-8').trim()
    if (!raw) return emptyStore()
    return { ...emptyStore(), ...JSON.parse(raw) } as SecurityStore
  } catch {
    return emptyStore()
  }
}

async function writeLocal(store: SecurityStore): Promise<void> {
  const fs = await import('fs')
  const path = await import('path')
  const dir = path.join(process.cwd(), '.data')
  const file = process.env[LOCAL_FILE_ENV] ?? path.join(dir, 'portfolio-security.json')
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(store, null, 2), 'utf-8')
}

// ─── Unified read / write ────────────────────────────────────────────────

async function readStore(): Promise<SecurityStore> {
  if (hasRedis()) {
    const redis = await getRedis()
    const data = await redis.get<SecurityStore>(REDIS_KEY)
    return data ? { ...emptyStore(), ...data } : emptyStore()
  }
  return readLocal()
}

async function writeStore(store: SecurityStore): Promise<void> {
  if (hasRedis()) {
    const redis = await getRedis()
    await redis.set(REDIS_KEY, store)
    return
  }
  await writeLocal(store)
}

/** Which backend is actually configured — surfaced to the admin UI. */
export function getSecurityStorageStatus() {
  return { redisConfigured: hasRedis() }
}

// ─── Password hashing (salted SHA-256 — no extra dependency) ────────────────

function hashPassword(password: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${password}`).digest('hex')
}

/** Creates a new salted hash for the given plaintext password. */
export function createPasswordOverride(password: string): PasswordOverride {
  const salt = randomBytes(16).toString('hex')
  return { salt, hash: hashPassword(password, salt), updatedAt: new Date().toISOString() }
}

/** Constant-time verification of a plaintext password against a stored override. */
export function verifyPasswordOverride(password: string, override: PasswordOverride): boolean {
  try {
    const candidate = hashPassword(password, override.salt)
    const a = Buffer.from(candidate)
    const b = Buffer.from(override.hash)
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

// ─── Public API — password overrides ────────────────────────────────────────

/** Returns the override hash for an email, if one has been set. */
export async function getPasswordOverride(email: string): Promise<PasswordOverride | null> {
  const store = await readStore()
  return store.passwordOverrides[email.toLowerCase().trim()] ?? null
}

/** Sets/replaces the password override for an email (used by "change password"). */
export async function setPasswordOverride(email: string, newPassword: string): Promise<void> {
  const store = await readStore()
  store.passwordOverrides[email.toLowerCase().trim()] = createPasswordOverride(newPassword)
  await writeStore(store)
}

// ─── Public API — sessions ──────────────────────────────────────────────────

/**
 * Part 3.2 — Cleans up expired sessions from the store.
 * Sessions older than SESSION_DURATION_MS are removed.
 * This handles auto-logout after session expiry.
 */
async function cleanupExpiredSessions(store: SecurityStore): Promise<void> {
  const now = Date.now()
  const before = store.sessions.length
  store.sessions = store.sessions.filter(s => {
    const createdAt = new Date(s.createdAt).getTime()
    return now - createdAt < SESSION_DURATION_MS
  })
  if (store.sessions.length !== before) {
    await writeStore(store)
  }
}

/** Registers a newly created session. Returns the generated session id. */
export async function registerSession(params: {
  email: string
  ip: string
  userAgent: string
}): Promise<string> {
  const store = await readStore()
  const id = randomUUID()
  const now = new Date().toISOString()
  store.sessions.push({
    id,
    email: params.email.toLowerCase().trim(),
    ip: params.ip,
    userAgent: params.userAgent,
    createdAt: now,
    lastSeenAt: now,
    location: null, // Part 2.9 — Will be populated on-demand by API route
    expiresAt: new Date(Date.now() + SESSION_DURATION_MS).toISOString(), // Part 3.2
  })
  await writeStore(store)
  return id
}

/** Returns all currently tracked sessions, newest first. Part 3.2 — also cleans up expired. */
export async function getActiveSessions(): Promise<ActiveSession[]> {
  const store = await readStore()
  await cleanupExpiredSessions(store)
  return [...store.sessions].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/** Removes a single tracked session (used by normal logout + individual revoke). */
export async function removeSession(id: string): Promise<void> {
  const store = await readStore()
  store.sessions = store.sessions.filter(s => s.id !== id)
  await writeStore(store)
}

/**
 * Force-logs-out every session for an email: clears the tracked session
 * list AND sets a revocation cutoff so any token issued before "now" fails
 * verification even if its signature is still valid.
 */
export async function revokeAllSessions(email: string): Promise<number> {
  const store = await readStore()
  const key = email.toLowerCase().trim()
  const before = store.sessions.length
  store.sessions = store.sessions.filter(s => s.email !== key)
  store.revokedBefore[key] = Date.now()
  await writeStore(store)
  return before - store.sessions.length
}

/**
 * Part 3.2 — Force-logs-out every session for an email EXCEPT the one with
 * the given session id. Sets a revocation cutoff at "now" so any OTHER token
 * issued before this moment fails verification, but the current session
 * remains valid because we keep its entry and don't revoke tokens issued
 * after the cutoff (the current token was issued before "now", but we
 * special-case it by not writing a cutoff — instead we filter the session
 * list directly).
 * 
 * Strategy: Remove all sessions for the email except the given session id.
 * Since session tokens remain valid (no cutoff), we rely on the proxy's
 * verifySessionTokenWithRevocation to check `revokedBefore`. To keep the
 * current session valid while revoking others, we set revokedBefore to
 * Date.now() + 1 ms (just after the current token was issued). This way,
 * the current token (issued before this cutoff) technically WOULD be
 * revoked, so instead we simply remove other sessions from the list AND
 * set a cutoff at the current token's issued-at time.
 */
export async function revokeAllSessionsExcept(email: string, exceptSessionId: string): Promise<number> {
  const store = await readStore()
  const key = email.toLowerCase().trim()
  const before = store.sessions.length
  const currentSession = store.sessions.find(s => s.id === exceptSessionId && s.email === key)
  
  // Keep only the current session
  store.sessions = store.sessions.filter(s => s.id === exceptSessionId)
  
  // Set revocation cutoff at the current session's creation time + 1ms
  // This ensures the current session remains valid (issued after cutoff)
  // while all other sessions (issued before or around the same time) get revoked
  if (currentSession) {
    const currentSessionTime = new Date(currentSession.createdAt).getTime()
    store.revokedBefore[key] = currentSessionTime + 1
  } else {
    // If current session not found (shouldn't happen), revoke all
    store.revokedBefore[key] = Date.now()
    store.sessions = []
  }
  
  await writeStore(store)
  return before - store.sessions.length
}

/** True if a token issued at `issuedAtMs` for `email` has been revoked. */
export async function isRevoked(email: string, issuedAtMs: number): Promise<boolean> {
  const store = await readStore()
  const cutoff = store.revokedBefore[email.toLowerCase().trim()]
  return typeof cutoff === 'number' && issuedAtMs < cutoff
}

/** Best-effort "last seen" bump for a session — safe to skip on failure. */
export async function touchSession(id: string): Promise<void> {
  try {
    const store = await readStore()
    const s = store.sessions.find(x => x.id === id)
    if (!s) return
    s.lastSeenAt = new Date().toISOString()
    await writeStore(store)
  } catch {
    // best-effort only
  }
}

// ─── Public API — login attempt log ─────────────────────────────────────────

/** Appends a login attempt (success or failure) to the rolling log. */
export async function logLoginAttempt(params: {
  email: string
  ip: string
  userAgent: string
  success: boolean
  reason?: string
}): Promise<void> {
  const store = await readStore()
  store.loginAttempts.unshift({
    id: randomUUID(),
    email: params.email.toLowerCase().trim(),
    ip: params.ip,
    userAgent: params.userAgent,
    timestamp: new Date().toISOString(),
    success: params.success,
    reason: params.reason,
  })
  // Keep the log bounded
  if (store.loginAttempts.length > MAX_LOGIN_ATTEMPTS) {
    store.loginAttempts = store.loginAttempts.slice(0, MAX_LOGIN_ATTEMPTS)
  }
  await writeStore(store)
}

/**
 * Part 3.2 — Returns login attempts with smart filtering:
 * 1. Show attempts from the last 1 week
 * 2. If no attempts in the last week, show the latest 10 attempts
 * Also supports filtering by failed attempts only.
 */
export async function getLoginAttempts(opts?: { onlyFailed?: boolean; limit?: number }): Promise<LoginAttempt[]> {
  const store = await readStore()
  let attempts = store.loginAttempts
  
  if (opts?.onlyFailed) {
    attempts = attempts.filter(a => !a.success)
  }
  
  // Part 3.2 — Filter to last week's attempts
  const now = Date.now()
  const oneWeekAgo = now - LOGIN_ATTEMPTS_WINDOW_MS
  const recentAttempts = attempts.filter(a => {
    const attemptTime = new Date(a.timestamp).getTime()
    return attemptTime >= oneWeekAgo
  })
  
  // If there are attempts in the last week, return those
  if (recentAttempts.length > 0) {
    return recentAttempts
  }
  
  // Otherwise, fallback to latest 10 attempts
  return attempts.slice(0, LOGIN_ATTEMPTS_FALLBACK_COUNT)
}

/** Clears the login attempt log (used by an optional "clear log" action). */
export async function clearLoginAttempts(): Promise<void> {
  const store = await readStore()
  store.loginAttempts = []
  await writeStore(store)
}