/**
 * app/api/admin/dashboard/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Part 3.2 (Dashboard upgrade) — Single aggregated endpoint for the
 * /admin/dashboard home tab.
 * ---------------------------------------------------------------------------
 * GET /api/admin/dashboard?period=7d|30d
 *   → everything the dashboard needs in one round-trip:
 *     analytics (views, visitors, trend, devices, referrers, delta vs prev
 *     window), message stats + recent messages, resume meta, content counts
 *     + image totals + version count, security stats, settings state,
 *     a combined activity feed, and storage health checks.
 *
 * Auth: same session-cookie guard used by every other /api/admin/* route.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ADMIN_COOKIE_NAME, verifySessionToken } from '@/lib/admin-auth'
import { getDashboardPayload } from '@/lib/dashboard-aggregator'

async function requireAuth(): Promise<boolean> {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value
  if (!token) return false
  return verifySessionToken(token) !== null
}

export async function GET(req: NextRequest) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const periodParam = req.nextUrl.searchParams.get('period')
  const period: 7 | 30 = periodParam === '30d' ? 30 : 7

  try {
    const payload = await getDashboardPayload(period)
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    })
  } catch (err) {
    console.error('[api/admin/dashboard] unexpected error:', err)
    // Return a fully-shaped degraded payload so the UI can still render.
    return NextResponse.json(
      {
        error: 'Failed to load dashboard data',
        _degraded: true,
      },
      { status: 500 },
    )
  }
}