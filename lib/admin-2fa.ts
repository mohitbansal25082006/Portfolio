/**
 * lib/admin-2fa.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Part 2.8 — Two-Factor Authentication (TOTP)
 * Part 2.9 — Added one-time recovery codes for authenticator loss scenarios
 * ---------------------------------------------------------------------------
 * Implements TOTP (Time-based One-Time Password) as specified in RFC 6238,
 * compatible with Google Authenticator, Authy, Microsoft Authenticator,
 * and other authenticator apps.
 *
 * Part 2.9 Recovery Codes:
 *   - Generated alongside QR setup (10 codes, single-use)
 *   - Displayed once during setup, stored hashed
 *   - Can be used as fallback when authenticator device is unavailable
 *   - Each code can only be used once, then becomes invalid
 *   - New codes can be regenerated (invalidates previous set)
 *
 * Flow:
 *   1. Admin logs in with email + password (verified first)
 *   2. If 2FA is enabled for that admin, a 6-digit code OR recovery code
 *      is required
 *   3. TOTP codes are verified against the admin's TOTP secret using HMAC-SHA1
 *   4. Recovery codes are verified against hashed versions stored alongside
 *      the 2FA config
 *
 * Storage:
 *   Uses the SAME dual-backend pattern as messages/settings/content:
 *   - Production: Upstash Redis (KV_REST_API_URL + KV_REST_API_TOKEN)
 *   - Local dev:  .data/portfolio-2fa.json
 *
 * Secret Generation:
 *   Secrets are 160-bit (20-byte) random values, base32-encoded.
 *   This is the standard size for TOTP (matches Google Authenticator).
 *
 * Security:
 *   - Secrets are stored in the same protected store as sessions/logins
 *   - Codes are valid for 30-second windows (±1 window for clock drift)
 *   - Each TOTP code can only be used once (replay protection)
 *   - Recovery codes are stored as SHA-256 hashes (never plaintext)
 *   - Each recovery code can only be used once (single-use)
 *   - Rate limiting is handled by the login route's existing logic
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createHmac, randomBytes, timingSafeEqual, createHash } from 'crypto'

// ─── Types ────────────────────────────────────────────────────────────────

export interface TwoFactorConfig {
  /** Base32-encoded TOTP secret */
  secret: string
  /** Whether 2FA is enabled for this admin */
  enabled: boolean
  /** ISO timestamp of when 2FA was enabled */
  enabledAt?: string
  /** ISO timestamp of when the secret was last used (for replay protection) */
  lastUsedAt?: string
  /** The most recent TOTP code that was successfully used (replay protection) */
  lastUsedCode?: string
}

export interface RecoveryCodeInfo {
  /** SHA-256 hashed recovery codes (never stored in plaintext) */
  hashedCodes: string[]
  /** ISO timestamp of when codes were generated */
  generatedAt: string
  /** Total number of codes originally generated */
  totalCodes: number
  /** Number of codes remaining */
  remainingCount: number
}

interface TwoFactorStore {
  /** Keyed by lowercase admin email */
  configs: Record<string, TwoFactorConfig>
  /** Recovery codes (hashed) for bypass if authenticator is lost */
  recoveryCodes: Record<string, RecoveryCodeInfo> // email -> recovery code info
}

const REDIS_KEY = 'portfolio:2fa'
const LOCAL_FILE_ENV = 'TWO_FACTOR_FILE'
const DEFAULT_TIMESTEP = 30 // seconds
const DEFAULT_DIGITS = 6
const DEFAULT_WINDOW = 1 // ±1 window for clock drift
const RECOVERY_CODE_COUNT = 10 // Number of recovery codes to generate

function emptyStore(): TwoFactorStore {
  return { configs: {}, recoveryCodes: {} }
}

// ─── Backend detection (same pattern as other stores) ─────────────────────

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

async function readLocal(): Promise<TwoFactorStore> {
  const fs = await import('fs')
  const path = await import('path')
  const dir = path.join(process.cwd(), '.data')
  const file = process.env[LOCAL_FILE_ENV] ?? path.join(dir, 'portfolio-2fa.json')
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    if (!fs.existsSync(file)) return emptyStore()
    const raw = fs.readFileSync(file, 'utf-8').trim()
    if (!raw) return emptyStore()
    return { ...emptyStore(), ...JSON.parse(raw) } as TwoFactorStore
  } catch {
    return emptyStore()
  }
}

async function writeLocal(store: TwoFactorStore): Promise<void> {
  const fs = await import('fs')
  const path = await import('path')
  const dir = path.join(process.cwd(), '.data')
  const file = process.env[LOCAL_FILE_ENV] ?? path.join(dir, 'portfolio-2fa.json')
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(store, null, 2), 'utf-8')
}

// ─── Unified read/write ───────────────────────────────────────────────────

async function readStore(): Promise<TwoFactorStore> {
  if (hasRedis()) {
    const redis = await getRedis()
    const data = await redis.get<TwoFactorStore>(REDIS_KEY)
    return data ? { ...emptyStore(), ...data } : emptyStore()
  }
  return readLocal()
}

async function writeStore(store: TwoFactorStore): Promise<void> {
  if (hasRedis()) {
    const redis = await getRedis()
    await redis.set(REDIS_KEY, store)
    return
  }
  await writeLocal(store)
}

// ─── Base32 Encoding/Decoding ─────────────────────────────────────────────

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32Encode(buffer: Buffer): string {
  let bits = 0
  let value = 0
  let output = ''

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i]
    bits += 8

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  }

  return output
}

function base32Decode(input: string): Buffer {
  const cleanInput = input.toUpperCase().replace(/[^A-Z2-7]/g, '')
  let bits = 0
  let value = 0
  const output: number[] = []

  for (let i = 0; i < cleanInput.length; i++) {
    value = (value << 5) | BASE32_ALPHABET.indexOf(cleanInput[i])
    bits += 5

    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }

  return Buffer.from(output)
}

// ─── TOTP Generation & Verification ───────────────────────────────────────

/**
 * Generates the TOTP code for a given secret and timestamp.
 * Implements RFC 6238 with HMAC-SHA1 (most compatible with authenticator apps).
 */
function generateTOTP(secret: string, timestamp: number = Date.now()): string {
  const key = base32Decode(secret)
  const counter = Math.floor(timestamp / 1000 / DEFAULT_TIMESTEP)
  const counterBuffer = Buffer.alloc(8)
  
  // Write counter as 64-bit big-endian
  let counterValue = counter
  for (let i = 7; i >= 0; i--) {
    counterBuffer[i] = counterValue & 0xff
    counterValue = Math.floor(counterValue / 256)
  }

  const hmac = createHmac('sha1', key)
  hmac.update(counterBuffer)
  const hmacResult = hmac.digest()

  const offset = hmacResult[hmacResult.length - 1] & 0xf
  const binary =
    ((hmacResult[offset] & 0x7f) << 24) |
    ((hmacResult[offset + 1] & 0xff) << 16) |
    ((hmacResult[offset + 2] & 0xff) << 8) |
    (hmacResult[offset + 3] & 0xff)

  const otp = binary % Math.pow(10, DEFAULT_DIGITS)
  return otp.toString().padStart(DEFAULT_DIGITS, '0')
}

/**
 * Verifies a TOTP code against a secret, allowing for ±1 time window
 * to account for clock drift between the server and the user's device.
 */
function verifyTOTP(secret: string, code: string): boolean {
  if (!code || code.length !== DEFAULT_DIGITS || !/^\d+$/.test(code)) {
    return false
  }

  const now = Date.now()
  const timestepMs = DEFAULT_TIMESTEP * 1000

  // Check current window and adjacent windows
  for (let window = -DEFAULT_WINDOW; window <= DEFAULT_WINDOW; window++) {
    const timestamp = now + window * timestepMs
    const expected = generateTOTP(secret, timestamp)
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(code))) {
      return true
    }
  }

  return false
}

// ─── Recovery Code Generation & Verification ──────────────────────────────

/**
 * Part 2.9 — Generates a set of recovery codes for an admin.
 * Returns the plaintext codes (displayed once) and stores only their hashes.
 */
function generateRecoveryCodes(): { plaintextCodes: string[]; hashedCodes: string[] } {
  const plaintextCodes: string[] = []
  const hashedCodes: string[] = []

  for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
    // Generate a random recovery code (format: XXXX-XXXX-XX)
    const raw = randomBytes(5).toString('hex').toUpperCase() // 10 hex chars
    const formatted = `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 10)}`
    plaintextCodes.push(formatted)
    hashedCodes.push(hashRecoveryCode(formatted))
  }

  return { plaintextCodes, hashedCodes }
}

/** Part 2.9 — Hash a recovery code for storage (SHA-256). */
function hashRecoveryCode(code: string): string {
  const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return createHash('sha256').update(normalized).digest('hex')
}

// ─── Public API ───────────────────────────────────────────────────────────

/** Get the 2FA configuration for an admin email. Returns null if not set up. */
export async function getTwoFactorConfig(email: string): Promise<TwoFactorConfig | null> {
  const store = await readStore()
  return store.configs[email.toLowerCase().trim()] ?? null
}

/** Check if 2FA is enabled for an admin. */
export async function isTwoFactorEnabled(email: string): Promise<boolean> {
  const config = await getTwoFactorConfig(email)
  return config?.enabled ?? false
}

/**
 * Generate a new TOTP secret AND recovery codes for an admin.
 * Returns the plaintext secret and recovery codes (displayed once).
 * The admin must verify a TOTP code from their authenticator app to enable 2FA.
 */
export async function generateTwoFactorSetup(email: string): Promise<{
  secret: string
  recoveryCodes: string[]
}> {
  const store = await readStore()
  const secret = base32Encode(randomBytes(20)) // 160-bit secret
  const { plaintextCodes, hashedCodes } = generateRecoveryCodes()
  
  const key = email.toLowerCase().trim()
  store.configs[key] = {
    secret,
    enabled: false,
  }
  store.recoveryCodes[key] = {
    hashedCodes,
    generatedAt: new Date().toISOString(),
    totalCodes: RECOVERY_CODE_COUNT,
    remainingCount: hashedCodes.length,
  }
  
  await writeStore(store)
  return { secret, recoveryCodes: plaintextCodes }
}

/**
 * Enable 2FA for an admin after they've verified a TOTP code.
 * Returns true if the code was valid, false otherwise.
 */
export async function enableTwoFactor(email: string, code: string): Promise<boolean> {
  const config = await getTwoFactorConfig(email)
  if (!config || config.enabled) {
    return false
  }

  if (!verifyTOTP(config.secret, code)) {
    return false
  }

  const store = await readStore()
  const key = email.toLowerCase().trim()
  store.configs[key] = {
    ...config,
    enabled: true,
    enabledAt: new Date().toISOString(),
    lastUsedAt: new Date().toISOString(),
    lastUsedCode: code,
  }
  await writeStore(store)
  return true
}

/**
 * Verify a TOTP code for an admin during login.
 * Includes replay protection — each code can only be used once.
 * Returns true if the code is valid and not replayed.
 */
export async function verifyTwoFactorCode(email: string, code: string): Promise<boolean> {
  const config = await getTwoFactorConfig(email)
  if (!config?.enabled) {
    return false
  }

  // Replay protection — reject if this code was already used
  if (config.lastUsedCode === code) {
    return false
  }

  if (!verifyTOTP(config.secret, code)) {
    return false
  }

  // Mark as used to prevent replay
  const store = await readStore()
  const key = email.toLowerCase().trim()
  store.configs[key] = {
    ...config,
    lastUsedAt: new Date().toISOString(),
    lastUsedCode: code,
  }
  await writeStore(store)
  return true
}

/**
 * Part 2.9 — Verify a recovery code for an admin during login.
 * Recovery codes are single-use — each code can only be used once.
 * Returns true if the code is valid and not previously used.
 */
export async function verifyRecoveryCode(email: string, code: string): Promise<boolean> {
  const store = await readStore()
  const key = email.toLowerCase().trim()
  const recoveryInfo = store.recoveryCodes[key]
  
  if (!recoveryInfo || recoveryInfo.remainingCount <= 0) {
    return false
  }

  const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const hashedInput = createHash('sha256').update(normalized).digest('hex')
  
  const codeIndex = recoveryInfo.hashedCodes.indexOf(hashedInput)
  if (codeIndex === -1) {
    return false
  }

  // Remove the used code from the list (single-use)
  recoveryInfo.hashedCodes.splice(codeIndex, 1)
  recoveryInfo.remainingCount = recoveryInfo.hashedCodes.length
  
  store.recoveryCodes[key] = recoveryInfo
  await writeStore(store)
  
  return true
}

/**
 * Part 2.9 — Get recovery code status for an admin.
 * Returns the number of remaining codes (not the codes themselves).
 */
export async function getRecoveryCodeStatus(email: string): Promise<{
  totalCodes: number
  remainingCount: number
  generatedAt?: string
}> {
  const store = await readStore()
  const recoveryInfo = store.recoveryCodes[email.toLowerCase().trim()]
  
  if (!recoveryInfo) {
    return { totalCodes: 0, remainingCount: 0 }
  }
  
  return {
    totalCodes: recoveryInfo.totalCodes || RECOVERY_CODE_COUNT,
    remainingCount: recoveryInfo.remainingCount,
    generatedAt: recoveryInfo.generatedAt,
  }
}

/**
 * Part 2.9 — Regenerate recovery codes for an admin.
 * Invalidates all previous codes and generates a new set.
 * Returns the plaintext codes (displayed once).
 */
export async function regenerateRecoveryCodes(email: string): Promise<string[]> {
  const store = await readStore()
  const key = email.toLowerCase().trim()
  const { plaintextCodes, hashedCodes } = generateRecoveryCodes()
  
  store.recoveryCodes[key] = {
    hashedCodes,
    generatedAt: new Date().toISOString(),
    totalCodes: RECOVERY_CODE_COUNT,
    remainingCount: hashedCodes.length,
  }
  
  await writeStore(store)
  
  // Return the plaintext codes so they can be displayed to the user
  return plaintextCodes
}

/**
 * Disable 2FA for an admin. Requires current password + valid TOTP code
 * for security (handled at the route level).
 */
export async function disableTwoFactor(email: string): Promise<void> {
  const store = await readStore()
  const key = email.toLowerCase().trim()
  delete store.configs[key]
  delete store.recoveryCodes[key]
  await writeStore(store)
}

/**
 * Generate the otpauth:// URI for QR code display.
 * Compatible with Google Authenticator, Authy, etc.
 */
export function generateOTPAuthURI(email: string, secret: string, issuer: string = 'Portfolio Admin'): string {
  const label = encodeURIComponent(`${issuer}:${email}`)
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DEFAULT_DIGITS}&period=${DEFAULT_TIMESTEP}`
}

/** Get storage status for UI display. */
export function getTwoFactorStorageStatus() {
  return { redisConfigured: hasRedis() }
}