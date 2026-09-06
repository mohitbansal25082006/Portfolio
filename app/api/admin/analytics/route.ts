/**
 * app/api/admin/analytics/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Proxies the Vercel Web Analytics REST API.
 *
 * Base: https://api.vercel.com/v1/query/web-analytics/
 *
 * VERIFIED REAL RESPONSE SHAPES (Vercel REST API docs, confirmed 2026-09-06):
 *
 * GET /visits/count
 *   → { version:1, data: { visitors: N, pageviews: N } }
 *
 * GET /visits/aggregate?by=day
 *   → { data: [{ timestamp: "2026-09-05T00:00:00.000Z", visitors: N, pageviews: N }] }
 *
 * GET /visits/aggregate?by=deviceType
 *   → { data: [{ deviceType: "desktop"|"mobile"|"tablet", visitors: N, pageviews: N }] }
 *
 * GET /visits/aggregate?by=referrerHostname
 *   → { data: [{ referrerHostname: "google.com", pageviews: N, visitors: N }] }
 *   NOTE: `by` is documented as an array-typed param. Some deployments are
 *   strict about this and reject a bare `by=referrerHostname` string with a
 *   400. We now send it both as `by=referrerHostname` AND retry as
 *   `by[]=referrerHostname` if the first attempt 400s, so the referrers
 *   panel does not silently die on that quirk.
 *
 * Required env vars:
 *   VERCEL_API_TOKEN    — vercel.com/account/tokens
 *   VERCEL_PROJECT_ID   — project Settings → General → Project ID
 *   VERCEL_TEAM_ID      — optional, team projects only
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken, ADMIN_COOKIE_NAME } from '@/lib/admin-auth'

// ─── Auth guard ───────────────────────────────────────────────────────────────

async function isAuthed(): Promise<boolean> {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value
  if (!token) return false
  return verifySessionToken(token) !== null
}

// ─── Vercel Analytics REST API ────────────────────────────────────────────────

const BASE = 'https://api.vercel.com/v1/query/web-analytics'

function authHeaders() {
  return {
    Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`,
    'Content-Type': 'application/json',
  }
}

function buildParams(
  proj: string,
  since: string,
  until: string,
  extra: Record<string, string> = {},
): string {
  const p: Record<string, string> = { projectId: proj, since, until, ...extra }
  const tid = process.env.VERCEL_TEAM_ID
  if (tid) p.teamId = tid
  return new URLSearchParams(p).toString()
}

/** ISO string for N days ago at midnight UTC — NO milliseconds */
function daysAgo(n: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

/**
 * "until" = TOMORROW midnight UTC.
 *
 * The Vercel count endpoint rounds `until` DOWN to midnight of that day,
 * so passing "today 21:18Z" → "today 00:00Z" which EXCLUDES today's visits.
 * Passing tomorrow midnight always includes today in both count + aggregate.
 */
function untilISO(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + 1)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

// No server-side cache — every client refresh should hit Vercel live
function getFetchOpts(): RequestInit {
  return {
    headers: authHeaders(),
    cache: 'no-store',
  }
}

/**
 * Fetch an aggregate endpoint. If the initial request 400s (some deployments
 * reject a bare `by=<dim>` string and require an array-style `by[]=<dim>`),
 * retry once using the array form before giving up.
 */
async function fetchAggregate(
  proj: string,
  since: string,
  until: string,
  dimension: string,
  extra: Record<string, string> = {},
): Promise<{ ok: true; body: any } | { ok: false; status: number; text: string }> {
  const opts = getFetchOpts()

  const primaryQs = buildParams(proj, since, until, { by: dimension, ...extra })
  let res = await fetch(`${BASE}/visits/aggregate?${primaryQs}`, opts)

  if (!res.ok && res.status === 400) {
    // Retry with array-style `by[]` param, in case that's what this
    // deployment's OpenAPI validator actually enforces.
    const retryParams: Record<string, string> = { projectId: proj, since, until, ...extra }
    const tid = process.env.VERCEL_TEAM_ID
    if (tid) retryParams.teamId = tid
    const usp = new URLSearchParams(retryParams)
    usp.append('by[]', dimension)
    res = await fetch(`${BASE}/visits/aggregate?${usp.toString()}`, opts)
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    return { ok: false, status: res.status, text }
  }

  const body = await res.json()
  return { ok: true, body }
}

// ─── Real response types ────────────────────────────────────────────────────

interface CountResponse {
  version?: number
  data?: {
    visitors?: number
    pageviews?: number
  }
}

interface DayRow {
  timestamp?: string
  pageviews?: number
  visitors?: number
}

interface DeviceRow {
  deviceType?: string
  pageviews?: number
  visitors?: number
}

interface ReferrerRow {
  referrerHostname?: string
  pageviews?: number
  visitors?: number
}

// ─── GET handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const proj = process.env.VERCEL_PROJECT_ID
  const token = process.env.VERCEL_API_TOKEN

  if (!proj || !token) {
    return NextResponse.json(
      buildPlaceholder('Missing VERCEL_API_TOKEN or VERCEL_PROJECT_ID in .env.local'),
      { status: 200 },
    )
  }

  const period = req.nextUrl.searchParams.get('period') === '30d' ? 30 : 7
  const since = daysAgo(period)
  const until = untilISO() // tomorrow midnight UTC — ensures today's visits included in count

  // Collect per-section errors so the client can show *why* something is empty
  // instead of a silent zero that looks identical to "genuinely no data".
  const errors: Record<string, string> = {}

  try {
    const opts = getFetchOpts()

    const [countRes, trendResult, referrersResult, devicesResult] = await Promise.all([
      fetch(`${BASE}/visits/count?${buildParams(proj, since, until)}`, opts),
      fetchAggregate(proj, since, until, 'day'),
      fetchAggregate(proj, since, until, 'referrerHostname', { limit: '8' }),
      fetchAggregate(proj, since, until, 'deviceType', { limit: '10' }),
    ])

    // ── Totals ───────────────────────────────────────────────────────────────
    let totalViews = 0
    let uniqueVisitors = 0

    if (countRes.ok) {
      const body = (await countRes.json()) as CountResponse
      totalViews = body?.data?.pageviews ?? 0
      uniqueVisitors = body?.data?.visitors ?? 0
    } else {
      const text = await countRes.text().catch(() => '')
      errors.count = `${countRes.status}: ${text.slice(0, 200)}`
      console.error('[analytics] count error:', countRes.status, text)
    }

    // ── Trend ─────────────────────────────────────────────────────────────────
    let trend: { date: string; views: number }[] = []

    if (trendResult.ok) {
      const rows = (trendResult.body?.data ?? []) as DayRow[]
      trend = rows
        .filter((row) => row.timestamp)
        .map((row) => ({
          date: row.timestamp!.slice(0, 10),
          views: row.pageviews ?? 0,
        }))
        .sort((a, b) => a.date.localeCompare(b.date))
    } else {
      errors.trend = `${trendResult.status}: ${trendResult.text.slice(0, 200)}`
      console.error('[analytics] trend error:', trendResult.status, trendResult.text)
    }

    // ── Referrers ─────────────────────────────────────────────────────────────
    let referrers: { source: string; views: number }[] = []

    if (referrersResult.ok) {
      const rows = (referrersResult.body?.data ?? []) as ReferrerRow[]
      referrers = rows
        .map((row) => ({
          source: row.referrerHostname && row.referrerHostname.trim() !== '' ? row.referrerHostname : 'Direct',
          views: row.pageviews ?? 0,
        }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 8)
    } else {
      errors.referrers = `${referrersResult.status}: ${referrersResult.text.slice(0, 200)}`
      console.error('[analytics] referrers error:', referrersResult.status, referrersResult.text)
    }

    // ── Devices ───────────────────────────────────────────────────────────────
    let mobile = 0
    let desktop = 0
    let tablet = 0

    if (devicesResult.ok) {
      const rows = (devicesResult.body?.data ?? []) as DeviceRow[]
      for (const row of rows) {
        const key = (row.deviceType ?? '').toLowerCase()
        const val = row.pageviews ?? 0
        if (key === 'mobile') mobile = val
        else if (key === 'desktop') desktop = val
        else if (key === 'tablet') tablet = val
      }
    } else {
      errors.devices = `${devicesResult.status}: ${devicesResult.text.slice(0, 200)}`
      console.error('[analytics] devices error:', devicesResult.status, devicesResult.text)
    }

    return NextResponse.json({
      period,
      totalViews,
      uniqueVisitors,
      referrers,
      devices: { mobile, desktop, tablet },
      trend,
      _errors: Object.keys(errors).length > 0 ? errors : undefined,
    })
  } catch (err) {
    console.error('[analytics] unexpected error:', err)
    return NextResponse.json(buildPlaceholder(String(err)), { status: 200 })
  }
}

// ─── Placeholder ──────────────────────────────────────────────────────────────

function buildPlaceholder(reason?: string) {
  return {
    period: 7,
    totalViews: null,
    uniqueVisitors: null,
    referrers: [],
    devices: { mobile: 0, desktop: 0, tablet: 0 },
    trend: [],
    _placeholder: true,
    _reason: reason,
  }
}