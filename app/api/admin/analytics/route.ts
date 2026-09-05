/**
 * app/api/admin/analytics/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Proxies Vercel Analytics data for the admin dashboard.
 *
 * Query params:
 *   period  = "7d" | "30d"   (default: "7d")
 *
 * Requires env vars:
 *   VERCEL_API_TOKEN       — your Vercel personal access token
 *   VERCEL_PROJECT_ID      — the project ID (from Vercel dashboard → Settings)
 *   VERCEL_TEAM_ID         — optional, for team projects
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

// ─── Vercel Analytics helpers ─────────────────────────────────────────────────

const VERCEL_API = 'https://vercel.com/api'

function vercelHeaders() {
  return {
    Authorization: `Bearer ${process.env.VERCEL_API_TOKEN ?? ''}`,
    'Content-Type': 'application/json',
  }
}

function teamParam(): string {
  const tid = process.env.VERCEL_TEAM_ID
  return tid ? `&teamId=${tid}` : ''
}

/** ISO string for N days ago */
function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

interface VercelDataPoint {
  key: string
  total: number
  devices?: Record<string, number>
}

// ─── GET handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const pid = process.env.VERCEL_PROJECT_ID
  const token = process.env.VERCEL_API_TOKEN

  // If Vercel credentials are not configured, return placeholder data so the
  // UI still renders without crashing.
  if (!pid || !token) {
    return NextResponse.json(buildPlaceholder(), { status: 200 })
  }

  const period = req.nextUrl.searchParams.get('period') === '30d' ? 30 : 7
  const from = daysAgo(period)
  const to = new Date().toISOString()

  try {
    // Fetch all data in parallel
    const [viewsRes, visitorsRes, referrersRes, devicesRes, trendRes] =
      await Promise.all([
        // Total page views
        fetch(
          `${VERCEL_API}/web-analytics/v1/query?projectId=${pid}&from=${from}&to=${to}&metric=pageviews${teamParam()}`,
          { headers: vercelHeaders(), next: { revalidate: 300 } },
        ),
        // Unique visitors
        fetch(
          `${VERCEL_API}/web-analytics/v1/query?projectId=${pid}&from=${from}&to=${to}&metric=visitors${teamParam()}`,
          { headers: vercelHeaders(), next: { revalidate: 300 } },
        ),
        // Top referrers
        fetch(
          `${VERCEL_API}/web-analytics/v1/query?projectId=${pid}&from=${from}&to=${to}&metric=pageviews&groupBy=referrer&limit=8${teamParam()}`,
          { headers: vercelHeaders(), next: { revalidate: 300 } },
        ),
        // Device breakdown
        fetch(
          `${VERCEL_API}/web-analytics/v1/query?projectId=${pid}&from=${from}&to=${to}&metric=pageviews&groupBy=device${teamParam()}`,
          { headers: vercelHeaders(), next: { revalidate: 300 } },
        ),
        // Daily trend
        fetch(
          `${VERCEL_API}/web-analytics/v1/query?projectId=${pid}&from=${from}&to=${to}&metric=pageviews&groupBy=date${teamParam()}`,
          { headers: vercelHeaders(), next: { revalidate: 300 } },
        ),
      ])

    // Parse all responses
    const [viewsData, visitorsData, referrersData, devicesData, trendData] =
      await Promise.all([
        viewsRes.ok ? viewsRes.json() : null,
        visitorsRes.ok ? visitorsRes.json() : null,
        referrersRes.ok ? referrersRes.json() : null,
        devicesRes.ok ? devicesRes.json() : null,
        trendRes.ok ? trendRes.json() : null,
      ])

    // Aggregate totals
    const totalViews: number = sumData(viewsData)
    const uniqueVisitors: number = sumData(visitorsData)

    // Referrers list
    const referrers: { source: string; views: number }[] = (
      (referrersData?.data ?? []) as VercelDataPoint[]
    )
      .filter((r) => r.key)
      .map((r) => ({
        source: r.key === '(direct)' || r.key === '' ? 'Direct' : r.key,
        views: r.total,
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 8)

    // Device breakdown
    const deviceRows = (devicesData?.data ?? []) as VercelDataPoint[]
    const mobile = deviceRows.find((d) => d.key?.toLowerCase() === 'mobile')?.total ?? 0
    const desktop = deviceRows.find((d) => d.key?.toLowerCase() === 'desktop')?.total ?? 0
    const tablet = deviceRows.find((d) => d.key?.toLowerCase() === 'tablet')?.total ?? 0

    // Daily trend
    const trend: { date: string; views: number }[] = (
      (trendData?.data ?? []) as VercelDataPoint[]
    )
      .map((d) => ({
        date: d.key,   // ISO date string e.g. "2025-09-01"
        views: d.total,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json({
      period,
      totalViews,
      uniqueVisitors,
      referrers,
      devices: { mobile, desktop, tablet },
      trend,
    })
  } catch (err) {
    console.error('[analytics] fetch error', err)
    return NextResponse.json(buildPlaceholder(), { status: 200 })
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sumData(data: { data?: VercelDataPoint[] } | null): number {
  if (!data?.data) return 0
  return data.data.reduce((acc: number, d: VercelDataPoint) => acc + (d.total ?? 0), 0)
}

/** Returns zeroed-out placeholder so the UI still renders without creds. */
function buildPlaceholder() {
  return {
    period: 7,
    totalViews: null,
    uniqueVisitors: null,
    referrers: [],
    devices: { mobile: 0, desktop: 0, tablet: 0 },
    trend: [],
    _placeholder: true,
  }
}
