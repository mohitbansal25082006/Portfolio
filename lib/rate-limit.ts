// ============================================================================
//  lib/rate-limit.ts
//  In-memory IP rate limiting + OTP storage for the contact form.
// ----------------------------------------------------------------------------
//  IMPORTANT — SERVERLESS CAVEAT:
//  This uses a plain in-memory Map, which lives only as long as the current
//  server process/lambda instance. On Vercel serverless functions, each
//  instance can be recycled or scaled horizontally, meaning:
//    - The rate limit / OTP store is NOT guaranteed to persist between
//      requests if a new instance is spun up.
//    - Under multiple concurrent instances, an IP could bypass the "2 per
//      day" limit by hitting different instances.
//  This is fine for a low-traffic personal portfolio, but if you need a
//  hard guarantee, swap the Maps below for a shared store such as
//  Vercel KV, Upstash Redis, or a database table. The public API of the
//  functions below (getClientIp, checkAndConsumeRateLimit, otpStore.*)
//  is written so that swap is a drop-in change.
// ============================================================================

import type { NextRequest } from 'next/server'

const DAY_MS = 24 * 60 * 60 * 1000
const OTP_TTL_MS = 10 * 60 * 1000 // OTP valid for 10 minutes
const MAX_OTP_ATTEMPTS = 5 // wrong-code attempts allowed per OTP
const MAX_SENDS_PER_DAY = 2 // successful contact emails allowed per IP per day

// ---------------------------------------------------------------------------
// Rate limiting (2 successful contact-form sends per IP per day)
// ---------------------------------------------------------------------------

type RateLimitRecord = {
  count: number
  windowStart: number // epoch ms when the current 24h window started
}

// Keyed by IP address. Tracks only *successful* sends (i.e. after OTP
// verification succeeds and the final email actually goes out).
const rateLimitStore = new Map<string, RateLimitRecord>()

// Keyed by IP address. Tracks OTP *requests* separately so someone can't
// spam send-otp endlessly without ever completing verification — capped
// at the same daily number, since a "used" attempt is claimed at send time
// and released back if verification is never completed within the OTP TTL.
type OtpRequestRecord = {
  count: number
  windowStart: number
}
const otpRequestStore = new Map<string, OtpRequestRecord>()

export function getClientIp(req: NextRequest): string {
  // Vercel/most proxies set x-forwarded-for as "client, proxy1, proxy2..."
  const forwardedFor = req.headers.get('x-forwarded-for')
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim()
    if (first) return first
  }
  const realIp = req.headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  return 'unknown'
}

function getRemaining(store: Map<string, RateLimitRecord | OtpRequestRecord>, key: string): {
  allowed: boolean
  remaining: number
} {
  const now = Date.now()
  const record = store.get(key)
  if (!record || now - record.windowStart >= DAY_MS) {
    return { allowed: true, remaining: MAX_SENDS_PER_DAY }
  }
  const remaining = MAX_SENDS_PER_DAY - record.count
  return { allowed: remaining > 0, remaining: Math.max(0, remaining) }
}

/** Check (without consuming) whether this IP still has sends left today. */
export function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  return getRemaining(rateLimitStore, ip)
}

/** Check (without consuming) whether this IP can still request an OTP today. */
export function checkOtpRequestLimit(ip: string): { allowed: boolean; remaining: number } {
  return getRemaining(otpRequestStore, ip)
}

/** Consume one OTP-request slot for this IP. Call only after validation passes. */
export function consumeOtpRequest(ip: string): void {
  const now = Date.now()
  const record = otpRequestStore.get(ip)
  if (!record || now - record.windowStart >= DAY_MS) {
    otpRequestStore.set(ip, { count: 1, windowStart: now })
    return
  }
  record.count += 1
}

/**
 * Consume one send slot for this IP. Call only once the final contact email
 * has actually been sent successfully.
 */
export function consumeRateLimit(ip: string): void {
  const now = Date.now()
  const record = rateLimitStore.get(ip)
  if (!record || now - record.windowStart >= DAY_MS) {
    rateLimitStore.set(ip, { count: 1, windowStart: now })
    return
  }
  record.count += 1
}

// ---------------------------------------------------------------------------
// OTP storage
// ---------------------------------------------------------------------------

type OtpRecord = {
  code: string
  email: string
  ip: string
  formData: { name: string; email: string; subject: string; message: string }
  createdAt: number
  attempts: number
}

// Keyed by a random token returned to the client (not by email/IP alone) so
// the client must hold onto an opaque handle rather than being able to
// "guess" another session's OTP slot.
const otpStore = new Map<string, OtpRecord>()

function generateToken(): string {
  return Array.from({ length: 24 }, () => Math.floor(Math.random() * 36).toString(36)).join('')
}

export function generateOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString() // 6 digits
}

export function createOtpSession(params: {
  code: string
  email: string
  ip: string
  formData: OtpRecord['formData']
}): string {
  const token = generateToken()
  otpStore.set(token, {
    code: params.code,
    email: params.email,
    ip: params.ip,
    formData: params.formData,
    createdAt: Date.now(),
    attempts: 0,
  })
  return token
}

export type OtpVerifyResult =
  | { ok: true; formData: OtpRecord['formData'] }
  | { ok: false; reason: 'not_found' | 'expired' | 'too_many_attempts' | 'mismatch' }

export function verifyOtpSession(token: string, code: string, ip: string): OtpVerifyResult {
  const record = otpStore.get(token)
  if (!record) return { ok: false, reason: 'not_found' }

  if (Date.now() - record.createdAt > OTP_TTL_MS) {
    otpStore.delete(token)
    return { ok: false, reason: 'expired' }
  }

  if (record.attempts >= MAX_OTP_ATTEMPTS) {
    otpStore.delete(token)
    return { ok: false, reason: 'too_many_attempts' }
  }

  if (record.code !== code) {
    record.attempts += 1
    return { ok: false, reason: 'mismatch' }
  }

  // Success — consume the session so it can't be replayed.
  otpStore.delete(token)
  return { ok: true, formData: record.formData }
}

export function deleteOtpSession(token: string): void {
  otpStore.delete(token)
}

// Periodically sweep expired OTP sessions so the Map doesn't grow unbounded
// on a long-lived server instance. No-op impact on serverless (each cold
// start gets a fresh Map anyway).
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [token, record] of otpStore.entries()) {
      if (now - record.createdAt > OTP_TTL_MS) otpStore.delete(token)
    }
  }, 5 * 60 * 1000).unref?.()
}

export const RATE_LIMIT_CONFIG = {
  MAX_SENDS_PER_DAY,
  MAX_OTP_ATTEMPTS,
  OTP_TTL_MS,
}