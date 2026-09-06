/**
 * lib/admin-security.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Part 2.6 — Security & Session
 *
 * Backs four features on the new /admin/security page:
 *   1. Active session tracking   — list every signed-in session (IP, login
 *      time, last-seen time, user agent), keyed by a per-login session ID
 *      embedded in the session token payload.
 *   2. Force logout all sessions — revokes every tracked session at once by
 *      writing a "revoked before" cutoff timestamp per admin email; any
 *      token issued before that cutoff fails verification from then on,
 *      even though its HMAC signature is still technically valid. This is
 *      what lets one click invalidate sessions running on other devices
 *      without needing a live server-side blocklist per token.
 *   3. Password change without touching .env — a runtime credential
 *      override store. `ADMIN_MAILn` / `ADMIN_PASSWORDn` in .env remain the
 *      bootstrap/fallback credentials, but once an admin changes their
 *      password from the dashboard, the new hash is written here and takes
 *      priority over the .env value for that email on every future login
 *      check. Works identically on serverless (Redis) and local dev (JSON
 *      file), so it survives redeploys in production.
 *   4. Login attempt log         — every login POST (success or failure) is
 *      appended here with email, IP, timestamp, and outcome, so failed
 *      attempts are visible per-IP for auditing.
 *
 * DUAL-BACKEND STORAGE (mirrors lib/messages.ts / lib/settings.ts exactly)
 * ---------------------------------------------------------------------------
 * Production (Vercel):   Upstash Redis via @upstash/redis, reusing the same
 *                         KV_REST_API_URL / KV_REST_API_TOKEN already
 *                         configured for messages/resume/settings. No new
 *                         env vars required.
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
  })
  await writeStore(store)
  return id
}

/** Returns all currently tracked sessions, newest first. */
export async function getActiveSessions(): Promise<ActiveSession[]> {
  const store = await readStore()
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
 * verification even if its signature is still valid (covers sessions this
 * store doesn't have a live row for, e.g. created before Part 2.6 shipped).
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

/** Returns login attempts, newest first, optionally limited to failures only. */
export async function getLoginAttempts(opts?: { onlyFailed?: boolean; limit?: number }): Promise<LoginAttempt[]> {
  const store = await readStore()
  let attempts = store.loginAttempts
  if (opts?.onlyFailed) attempts = attempts.filter(a => !a.success)
  if (opts?.limit) attempts = attempts.slice(0, opts.limit)
  return attempts
}

/** Clears the login attempt log (used by an optional "clear log" action). */
export async function clearLoginAttempts(): Promise<void> {
  const store = await readStore()
  store.loginAttempts = []
  await writeStore(store)
}