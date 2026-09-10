/**
 * lib/site-analytics.ts
 *
 * Part 3.3 — Public-site-only pageviews, IP-based unique visitors,
 * device breakdown, and referrer tracking — all from one self-hosted,
 * site-scoped source of truth.
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS
 * Vercel's Web Analytics REST API has problems for what we need here:
 *   1. It has no route/path filter — `visits/count` and `visits/aggregate`
 *      return totals for the ENTIRE deployment, so admin-dashboard traffic
 *      (`/admin/*`, `/api/admin/*`) inflates every metric, including device
 *      breakdown and referrers, not just the page-view total.
 *   2. Its `visitors` figure is Vercel's own cookieless fingerprint dedup —
 *      it is NOT derived from IP address, so it can't answer "unique
 *      visitors by IP".
 *   3. Its `since`/`until` day-bucketing rounds in a way that can surface an
 *      extra boundary day (e.g. 9 days back when 7 were asked for).
 *
 * This module replaces Vercel Analytics entirely for the admin dashboard's
 * Visit Trend, Device Breakdown, and Top Referrers panels, as well as the
 * Total Page Views / Unique Visitors stat cards. Every number now comes
 * from ONE site-scoped, day-bucketed source, so all panels are internally
 * consistent (the trend's daily sum equals totalViews, the device
 * breakdown's total equals totalViews, etc). It is recorded from
 * `proxy.ts` on every request to a PUBLIC route only (never /admin/*, never
 * /api/*):
 *   - Total Page Views   = only real portfolio-site views
 *   - Unique Visitors    = distinct hashed IPs seen in the period
 *   - Visit Trend         = exact per-day view counts, last N days, no
 *                           off-by-one boundary-day bugs
 *   - Device Breakdown    = per-day desktop/mobile/tablet counts, site-only
 *   - Top Referrers       = per-day referrer-hostname counts, site-only
 *
 * PRIVACY: raw IPs are never stored. Each IP is SHA-256 hashed (salted with
 * a server-only secret) before being added to the day's Redis set, so we
 * get exact per-IP uniqueness without persisting anyone's actual address.
 *
 * DUAL-BACKEND STORAGE (same convention as lib/messages.ts / lib/settings.ts)
 * ---------------------------------------------------------------------------
 * Production (Vercel): Upstash Redis via @upstash/redis, reusing the same
 *   KV_REST_API_URL / KV_REST_API_TOKEN already configured — no new env vars.
 * Local dev fallback: JSON file at `.data/portfolio-site-analytics.json`.
 * ---------------------------------------------------------------------------
 */

import { promises as fs } from 'fs'
import path from 'path'
import crypto from 'crypto'

// ─── Types ────────────────────────────────────────────────────────────────

type DeviceType = 'desktop' | 'mobile' | 'tablet'

interface DayBucket {
  /** total pageviews recorded for the public site on this day */
  views: number
  /** hashed IPs seen on this day */
  ips: string[]
  /** per-device-type view counts for this day */
  devices: Record<DeviceType, number>
  /** per-referrer-hostname view counts for this day (hostname -> count) */
  referrers: Record<string, number>
}

type LocalStore = Record<string, DayBucket> // keyed by YYYY-MM-DD

function emptyBucket(): DayBucket {
  return { views: 0, ips: [], devices: { desktop: 0, mobile: 0, tablet: 0 }, referrers: {} }
}

// ─── Config ───────────────────────────────────────────────────────────────

const LOCAL_DIR = path.join(process.cwd(), '.data')
const LOCAL_FILE = path.join(LOCAL_DIR, 'portfolio-site-analytics.json')

const REDIS_VIEWS_PREFIX = 'portfolio:siteviews:' // + YYYY-MM-DD -> counter
const REDIS_IPS_PREFIX = 'portfolio:siteips:' // + YYYY-MM-DD -> set of hashed IPs
const REDIS_DEVICES_PREFIX = 'portfolio:sitedevices:' // + YYYY-MM-DD -> hash { desktop, mobile, tablet }
const REDIS_REFERRERS_PREFIX = 'portfolio:sitereferrers:' // + YYYY-MM-DD -> hash { hostname: count }

const DAY_TTL_SECONDS = 60 * 60 * 24 * 90 // keep 90 days, then auto-expire
const MAX_REFERRER_HOSTS_TRACKED = 40 // per day, generous cap so a scraping burst can't grow a key unbounded

/**
 * Paths that count as "the deployed portfolio website" for analytics
 * purposes. Everything under /admin and /api/admin is excluded, along with
 * Next internals and static assets.
 */
function isPublicPageRequest(pathname: string): boolean {
  if (pathname.startsWith('/admin')) return false
  if (pathname.startsWith('/api')) return false // API calls aren't "page views"
  if (pathname.startsWith('/_next')) return false
  if (pathname === '/favicon.ico') return false
  // Skip requests for static files (has a file extension in the last segment)
  const lastSegment = pathname.split('/').pop() ?? ''
  if (lastSegment.includes('.')) return false
  return true
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10) // YYYY-MM-DD (UTC)
}

function daysAgoKey(n: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

/** Salted SHA-256 hash of an IP — never store the raw IP. */
function hashIp(ip: string): string {
  const salt = process.env.ANALYTICS_IP_SALT || process.env.ADMIN_SESSION_SECRET || 'portfolio-site-analytics'
  return crypto.createHash('sha256').update(`${salt}:${ip}`).digest('hex')
}

/**
 * Classify a User-Agent string into desktop / mobile / tablet. Deliberately
 * simple (no external dep) — tablets are matched first since iPad/Android
 * tablet UAs also contain substrings that could otherwise match "mobile".
 */
function classifyDevice(userAgent: string): DeviceType {
  const ua = userAgent.toLowerCase()
  if (/ipad|tablet|kindle|playbook|nexus 7|nexus 9|nexus 10/.test(ua)) return 'tablet'
  if (/mobi|iphone|ipod|android.*mobile|blackberry|opera mini|iemobile/.test(ua)) return 'mobile'
  return 'desktop'
}

/** Extract a clean referrer hostname from a Referer header, or "Direct" if absent/own-site. */
function extractReferrerHost(referer: string | null, ownHost: string | null): string {
  if (!referer) return 'Direct'
  try {
    const url = new URL(referer)
    const host = url.hostname.replace(/^www\./, '')
    // Don't count our own site navigating to itself as a "referrer"
    if (ownHost && host === ownHost.replace(/^www\./, '')) return 'Direct'
    return host || 'Direct'
  } catch {
    return 'Direct'
  }
}

// ─── Backend detection ───────────────────────────────────────────────────────

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

// ─── Local JSON fallback helpers ─────────────────────────────────────────────

async function readLocal(): Promise<LocalStore> {
  try {
    const raw = await fs.readFile(LOCAL_FILE, 'utf-8')
    const parsed = JSON.parse(raw) as LocalStore
    // Backfill shape for buckets written by an older version of this file
    for (const key of Object.keys(parsed)) {
      const b = parsed[key] as Partial<DayBucket>
      parsed[key] = {
        views: b.views ?? 0,
        ips: b.ips ?? [],
        devices: b.devices ?? { desktop: 0, mobile: 0, tablet: 0 },
        referrers: b.referrers ?? {},
      }
    }
    return parsed
  } catch {
    return {}
  }
}

async function writeLocal(store: LocalStore) {
  await fs.mkdir(LOCAL_DIR, { recursive: true })
  await fs.writeFile(LOCAL_FILE, JSON.stringify(store, null, 2), 'utf-8')
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Record one visit. Call this from proxy.ts for every request. Silently
 * no-ops for non-public paths (admin, API, static assets, Next internals).
 * Never throws — analytics recording must never break a page request.
 */
export async function recordSiteVisit(
  pathname: string,
  ip: string,
  userAgent: string,
  referer: string | null,
  ownHost: string | null,
): Promise<void> {
  if (!isPublicPageRequest(pathname)) return
  if (!ip || ip === 'unknown') return

  const day = todayKey()
  const hashedIp = hashIp(ip)
  const device = classifyDevice(userAgent || '')
  const referrerHost = extractReferrerHost(referer, ownHost)

  try {
    if (hasRedis()) {
      const redis = await getRedis()
      const viewsKey = `${REDIS_VIEWS_PREFIX}${day}`
      const ipsKey = `${REDIS_IPS_PREFIX}${day}`
      const devicesKey = `${REDIS_DEVICES_PREFIX}${day}`
      const referrersKey = `${REDIS_REFERRERS_PREFIX}${day}`

      await Promise.all([
        redis.incr(viewsKey),
        redis.expire(viewsKey, DAY_TTL_SECONDS),
        redis.sadd(ipsKey, hashedIp),
        redis.expire(ipsKey, DAY_TTL_SECONDS),
        redis.hincrby(devicesKey, device, 1),
        redis.expire(devicesKey, DAY_TTL_SECONDS),
      ])

      // Cap distinct referrer hosts tracked per day so a bot burst with
      // randomized referrers can't grow the hash unbounded. This check is
      // best-effort: if it throws for any reason, we still want the core
      // view/IP/device counters above (already written) to stand, so it's
      // wrapped separately rather than sharing a try/catch with them.
      try {
        const referrerCount = await redis.hlen(referrersKey)
        const alreadyTracked = referrerCount > 0 && (await redis.hexists(referrersKey, referrerHost))
        if (alreadyTracked || referrerCount < MAX_REFERRER_HOSTS_TRACKED) {
          await Promise.all([
            redis.hincrby(referrersKey, referrerHost, 1),
            redis.expire(referrersKey, DAY_TTL_SECONDS),
          ])
        }
      } catch (referrerErr) {
        console.error('[site-analytics] referrer tracking failed (non-fatal):', referrerErr)
      }
    } else {
      const store = await readLocal()
      if (!store[day]) store[day] = emptyBucket()
      const bucket = store[day]

      bucket.views += 1
      if (!bucket.ips.includes(hashedIp)) bucket.ips.push(hashedIp)
      bucket.devices[device] = (bucket.devices[device] ?? 0) + 1

      const trackedHosts = Object.keys(bucket.referrers)
      if (trackedHosts.includes(referrerHost) || trackedHosts.length < MAX_REFERRER_HOSTS_TRACKED) {
        bucket.referrers[referrerHost] = (bucket.referrers[referrerHost] ?? 0) + 1
      }

      // Trim anything older than 90 days so the local file doesn't grow forever
      const cutoff = daysAgoKey(DAY_TTL_SECONDS / 86400)
      for (const key of Object.keys(store)) {
        if (key < cutoff) delete store[key]
      }

      await writeLocal(store)
    }
  } catch (err) {
    // Analytics must never break the site — log and move on.
    console.error('[site-analytics] recordSiteVisit failed:', err)
  }
}

export interface SiteAnalyticsSummary {
  /** Total public-site page views across the period */
  totalViews: number
  /** Distinct hashed IPs seen across the whole period (not summed per-day) */
  uniqueVisitors: number
  /** Exact per-day view counts for the period, oldest first, always exactly `days` entries */
  trend: { date: string; views: number }[]
  /** Device breakdown, summed across the period — always sums to totalViews */
  devices: { desktop: number; mobile: number; tablet: number }
  /** Top referrer hostnames, summed across the period, sorted desc, "Direct" included */
  referrers: { source: string; views: number }[]
}

/**
 * Read the full analytics summary for the last `days` days (including
 * today), scoped to the public portfolio site only. Every field here is
 * derived from the SAME per-day buckets, so trend sums to totalViews and
 * the device breakdown sums to totalViews too — no cross-source drift.
 */
export async function getSiteAnalytics(days: number): Promise<SiteAnalyticsSummary> {
  // Oldest-first day keys, always exactly `days` entries — this is what
  // fixes the "shows 9 days instead of 7" bug: we build the exact window
  // ourselves instead of trusting an upstream since/until rounding.
  const dayKeys = Array.from({ length: days }, (_, i) => daysAgoKey(days - 1 - i))

  try {
    if (hasRedis()) {
      const redis = await getRedis()

      // Each metric fetched independently so a failure in one (e.g.
      // referrers) can't blank out totalViews/uniqueVisitors, which
      // previously shared one try/catch with everything else.
      let totalViews = 0
      let trend = dayKeys.map((date) => ({ date, views: 0 }))
      try {
        const viewCounts = await Promise.all(
          dayKeys.map((day) => redis.get<number>(`${REDIS_VIEWS_PREFIX}${day}`)),
        )
        trend = dayKeys.map((date, i) => ({ date, views: Number(viewCounts[i] ?? 0) }))
        totalViews = trend.reduce((sum, d) => sum + d.views, 0)
      } catch (e) {
        console.error('[site-analytics] views fetch failed:', e)
      }

      const devices = { desktop: 0, mobile: 0, tablet: 0 }
      try {
        const deviceRows = await Promise.all(
          dayKeys.map((day) => redis.hgetall<Record<string, number>>(`${REDIS_DEVICES_PREFIX}${day}`)),
        )
        for (const row of deviceRows) {
          if (!row) continue
          devices.desktop += Number(row.desktop ?? 0)
          devices.mobile += Number(row.mobile ?? 0)
          devices.tablet += Number(row.tablet ?? 0)
        }
      } catch (e) {
        console.error('[site-analytics] devices fetch failed:', e)
      }

      let referrers: { source: string; views: number }[] = []
      try {
        const referrerRows = await Promise.all(
          dayKeys.map((day) => redis.hgetall<Record<string, number>>(`${REDIS_REFERRERS_PREFIX}${day}`)),
        )
        const referrerTotals = new Map<string, number>()
        for (const row of referrerRows) {
          if (!row) continue
          for (const [host, count] of Object.entries(row)) {
            referrerTotals.set(host, (referrerTotals.get(host) ?? 0) + Number(count ?? 0))
          }
        }
        referrers = Array.from(referrerTotals.entries())
          .map(([source, views]) => ({ source, views }))
          .sort((a, b) => b.views - a.views)
          .slice(0, 8)
      } catch (e) {
        console.error('[site-analytics] referrers fetch failed:', e)
      }

      let uniqueVisitors = 0
      try {
        // Union the per-day IP sets to dedupe visitors across the whole period.
        const ipSetKeys = dayKeys.map((day) => `${REDIS_IPS_PREFIX}${day}`) as [string, ...string[]]
        const union = await redis.sunion(...ipSetKeys)
        uniqueVisitors = Array.isArray(union) ? union.length : 0
      } catch (e) {
        console.error('[site-analytics] unique visitors fetch failed:', e)
      }

      return { totalViews, uniqueVisitors, trend, devices, referrers }
    }

    const store = await readLocal()
    const trend = dayKeys.map((date) => ({ date, views: store[date]?.views ?? 0 }))
    const totalViews = trend.reduce((sum, d) => sum + d.views, 0)

    const devices = { desktop: 0, mobile: 0, tablet: 0 }
    const ipSet = new Set<string>()
    const referrerTotals = new Map<string, number>()

    for (const day of dayKeys) {
      const bucket = store[day]
      if (!bucket) continue
      devices.desktop += bucket.devices?.desktop ?? 0
      devices.mobile += bucket.devices?.mobile ?? 0
      devices.tablet += bucket.devices?.tablet ?? 0
      for (const ip of bucket.ips ?? []) ipSet.add(ip)
      for (const [host, count] of Object.entries(bucket.referrers ?? {})) {
        referrerTotals.set(host, (referrerTotals.get(host) ?? 0) + count)
      }
    }

    const referrers = Array.from(referrerTotals.entries())
      .map(([source, views]) => ({ source, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 8)

    return { totalViews, uniqueVisitors: ipSet.size, trend, devices, referrers }
  } catch (err) {
    console.error('[site-analytics] getSiteAnalytics failed:', err)
    return {
      totalViews: 0,
      uniqueVisitors: 0,
      trend: dayKeys.map((date) => ({ date, views: 0 })),
      devices: { desktop: 0, mobile: 0, tablet: 0 },
      referrers: [],
    }
  }
}

/** Which backend is actually configured — surfaced to the admin UI if needed. */
export function getSiteAnalyticsStorageStatus() {
  return { redisConfigured: hasRedis() }
}