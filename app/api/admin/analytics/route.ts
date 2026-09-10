/**
 * app/api/admin/analytics/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Part 3.3 — All analytics numbers (Total Page Views, Unique Visitors, Visit
 * Trend, Device Breakdown, Top Referrers) now come from lib/site-analytics.ts
 * — a self-hosted, IP-hashed counter fed from every PUBLIC request in
 * proxy.ts. Vercel Web Analytics is no longer called from this route.
 *
 * WHY:
 *   - Vercel's `visits/count` and `visits/aggregate` total the WHOLE
 *     deployment, including `/admin/*` traffic — inflating every metric,
 *     not just page views.
 *   - Vercel's `visitors` figure is a cookieless fingerprint dedup, not an
 *     IP-based count.
 *   - Vercel's since/until day-bucketing could surface an extra boundary
 *     day (e.g. "7 days" rendering 9 bars).
 *   - Splitting page views (site-analytics) from trend/devices/referrers
 *     (Vercel) meant the four panels could disagree with each other. Now
 *     every number is derived from the same per-day buckets, so the Visit
 *     Trend's daily sum always equals Total Page Views, and the Device
 *     Breakdown / Top Referrers totals always equal it too.
 *
 * This route no longer requires VERCEL_API_TOKEN / VERCEL_PROJECT_ID at all.
 * Those env vars and the old Vercel fetch helpers have been removed — if
 * nothing else in the project uses them, they can be cleared from
 * .env.local (harmless to leave in place either way).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken, ADMIN_COOKIE_NAME } from '@/lib/admin-auth'
import { getSiteAnalytics } from '@/lib/site-analytics'

// ─── Auth guard ───────────────────────────────────────────────────────────────

async function isAuthed(): Promise<boolean> {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value
  if (!token) return false
  return verifySessionToken(token) !== null
}

// ─── GET handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Exactly 7 or 30 — this is also what fixes the "9 days instead of 7"
  // bug, since getSiteAnalytics builds precisely `period` day buckets
  // itself instead of relying on an upstream since/until range.
  const period = req.nextUrl.searchParams.get('period') === '30d' ? 30 : 7

  try {
    const site = await getSiteAnalytics(period)

    return NextResponse.json({
      period,
      totalViews: site.totalViews,
      uniqueVisitors: site.uniqueVisitors,
      referrers: site.referrers,
      devices: site.devices,
      trend: site.trend,
    })
  } catch (err) {
    console.error('[analytics] unexpected error:', err)
    return NextResponse.json({
      period,
      totalViews: 0,
      uniqueVisitors: 0,
      referrers: [],
      devices: { mobile: 0, desktop: 0, tablet: 0 },
      trend: [],
      _placeholder: true,
      _reason: String(err),
    })
  }
}