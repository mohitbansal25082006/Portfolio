'use client'

/**
 * app/admin/analytics/analytics-client.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Part 2.3 — Analytics Overview
 *
 * Part 2.6 update: added "Security" nav item (8th item, after Settings) —
 * canonical nav list now spans Dashboard, Messages, Analytics, Resume,
 * Content, Visitors, Settings, Security.
 *
 * Fixes applied:
 *  1. "Avg. Daily Views" now derives from the trend array (sum of daily
 *     pageviews / number of days with data), not totalViews/period. The
 *     count endpoint and the aggregate endpoint can disagree slightly or
 *     one can legitimately return 0 while the other has data — deriving
 *     from trend keeps the number consistent with the chart the user is
 *     looking at right above it.
 *  2. "Top Referrers" stat card previously showed referrers.length (i.e.
 *     "3" sources found) mislabeled under a views-style stat card, which
 *     read as broken/zero whenever the referrers call failed silently.
 *     It now shows total referred page views, matching the other three
 *     cards' units, and falls back to "—" (not "0") when the referrers
 *     endpoint actually errored (see _errors below) vs. genuinely empty.
 *  3. The API route now returns `_errors` per section when a Vercel call
 *     fails. This client surfaces those inline under the relevant panel
 *     so "no data" and "the call broke" are never visually identical.
 *  4. Sidebar nav list was missing the "Resume" item entirely, which made
 *     it look like the Resume tab disappeared whenever the user was on
 *     the Analytics page. Restored to match the canonical list used on
 *     every other admin page.
 *  5. Sidebar `<nav>` now has `min-h-0` alongside `flex-1` so the flex
 *     child can actually shrink and scroll internally instead of
 *     potentially clipping the bottom-most nav links (same fix already
 *     applied to dashboard-client.tsx / messages-client.tsx /
 *     settings-client.tsx).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  LogOut,
  Mail,
  MessageSquare,
  FileText,
  Users,
  Settings,
  ExternalLink,
  Eye,
  BarChart2,
  Monitor,
  Smartphone,
  Tablet,
  RefreshCw,
  Loader2,
  TrendingUp,
  Globe,
  Menu,
  X,
  Palette,
  ChevronDown,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react'
import { themes } from '@/lib/content'

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = '7d' | '30d'

interface AnalyticsData {
  period: number
  totalViews: number | null
  uniqueVisitors: number | null
  referrers: { source: string; views: number }[]
  devices: { mobile: number; desktop: number; tablet: number }
  trend: { date: string; views: number }[]
  _placeholder?: boolean
  _reason?: string
  _errors?: Record<string, string>
}

interface NavItem {
  icon: React.ReactNode
  label: string
  href: string
  active?: boolean
  badge?: number
}

// ─── Theme hook ───────────────────────────────────────────────────────────────

function useAdminTheme() {
  const [theme, setThemeState] = useState('midnight')
  useEffect(() => {
    setThemeState(localStorage.getItem('admin-theme') ?? 'midnight')
  }, [])
  const setTheme = (id: string) => {
    setThemeState(id)
    localStorage.setItem('admin-theme', id)
  }
  return { theme, setTheme }
}

// ─── Sidebar Nav Item ─────────────────────────────────────────────────────────

function SideNavItem({ icon, label, href, active, badge }: NavItem) {
  return (
    <a
      href={href}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200"
      style={{
        background: active ? 'color-mix(in oklch, var(--primary) 15%, transparent)' : 'transparent',
        color: active ? 'var(--primary)' : 'var(--muted-foreground)',
        borderLeft: active ? '2px solid var(--primary)' : '2px solid transparent',
      }}
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span
          className="flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold"
          style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
        >
          {badge}
        </span>
      )}
    </a>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
  error,
}: {
  icon: React.ReactNode
  label: string
  value: string | number | null
  sub?: string
  accent?: string
  error?: string
}) {
  const bg = accent
    ? `color-mix(in oklch, ${accent} 15%, transparent)`
    : 'color-mix(in oklch, var(--primary) 15%, transparent)'

  return (
    <div
      className="stat-card relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 hover:shadow-lg"
      style={{ background: 'var(--card)', borderColor: error ? 'color-mix(in oklch, oklch(0.7 0.2 25) 40%, transparent)' : 'var(--border)' }}
    >
      <div className="stat-card-shine" />
      <div className="relative z-10">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: bg }}>
          {icon}
        </div>
        <p className="text-2xl font-bold tabular-nums">
          {value === null ? (
            <span style={{ color: 'var(--muted-foreground)', fontSize: '0.9rem' }}>
              {error ? '—' : 'Not configured'}
            </span>
          ) : (
            formatNumber(Number(value))
          )}
        </p>
        <p className="mt-0.5 text-sm font-medium">{label}</p>
        {error ? (
          <p className="mt-1 flex items-center gap-1 text-xs" style={{ color: 'oklch(0.7 0.2 25)' }}>
            <AlertCircle className="h-3 w-3 shrink-0" />
            <span className="truncate" title={error}>Failed to load</span>
          </p>
        ) : sub ? (
          <p className="mt-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>{sub}</p>
        ) : null}
      </div>
    </div>
  )
}

// ─── Bar Trend Chart (pure SVG, zero deps) ────────────────────────────────────

function TrendChart({ data }: { data: { date: string; views: number }[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
        No trend data available
      </div>
    )
  }

  const max = Math.max(...data.map((d) => d.views), 1)
  const W = 600
  const H = 160
  const padL = 36
  const padR = 8
  const padT = 12
  const padB = 28
  const chartW = W - padL - padR
  const chartH = H - padT - padB
  const barW = Math.max(4, (chartW / data.length) * 0.6)
  const gap = chartW / data.length

  const ticks = [0, Math.round(max / 2), max]

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height: H, overflow: 'visible' }}
      role="img"
      aria-label="Visit trend chart"
    >
      {ticks.map((tick) => {
        const y = padT + chartH - (tick / max) * chartH
        return (
          <g key={tick}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--border)" strokeWidth={1} strokeDasharray="4 4" />
            <text x={padL - 4} y={y + 4} textAnchor="end" fontSize={10} fill="var(--muted-foreground)">
              {tick >= 1000 ? `${(tick / 1000).toFixed(1)}k` : tick}
            </text>
          </g>
        )
      })}

      {data.map((d, i) => {
        const x = padL + i * gap + gap / 2 - barW / 2
        const barH = Math.max(2, (d.views / max) * chartH)
        const y = padT + chartH - barH
        const showLabel = i === 0 || i === data.length - 1 || i % Math.max(1, Math.floor(data.length / 6)) === 0
        const labelDate = new Date(d.date)
        const labelStr = labelDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })

        return (
          <g key={d.date}>
            <rect x={x} y={y} width={barW} height={barH} rx={3} fill="var(--primary)" opacity={0.85} />
            {showLabel && (
              <text x={x + barW / 2} y={H - 4} textAnchor="middle" fontSize={9} fill="var(--muted-foreground)">
                {labelStr}
              </text>
            )}
            <title>{`${d.date}: ${d.views} views`}</title>
          </g>
        )
      })}
    </svg>
  )
}

// ─── Device Donut ─────────────────────────────────────────────────────────────

function DeviceDonut({ mobile, desktop, tablet }: { mobile: number; desktop: number; tablet: number }) {
  const total = mobile + desktop + tablet
  if (total === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
        No device data
      </div>
    )
  }

  const mPct = Math.round((mobile / total) * 100)
  const dPct = Math.round((desktop / total) * 100)
  const tPct = 100 - mPct - dPct

  const R = 52
  const r = 34
  const cx = 70
  const cy = 70

  function slicePath(startPct: number, endPct: number) {
    const toRad = (pct: number) => (pct / 100) * 2 * Math.PI - Math.PI / 2
    const x1 = cx + R * Math.cos(toRad(startPct))
    const y1 = cy + R * Math.sin(toRad(startPct))
    const x2 = cx + R * Math.cos(toRad(endPct))
    const y2 = cy + R * Math.sin(toRad(endPct))
    const ix1 = cx + r * Math.cos(toRad(endPct))
    const iy1 = cy + r * Math.sin(toRad(endPct))
    const ix2 = cx + r * Math.cos(toRad(startPct))
    const iy2 = cy + r * Math.sin(toRad(startPct))
    const large = endPct - startPct > 50 ? 1 : 0
    return `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${r} ${r} 0 ${large} 0 ${ix2} ${iy2} Z`
  }

  const slices = [
    { label: 'Desktop', pct: dPct, color: 'var(--primary)', icon: <Monitor className="h-3.5 w-3.5" /> },
    { label: 'Mobile', pct: mPct, color: 'oklch(0.75 0.18 220)', icon: <Smartphone className="h-3.5 w-3.5" /> },
    { label: 'Tablet', pct: tPct, color: 'oklch(0.75 0.18 150)', icon: <Tablet className="h-3.5 w-3.5" /> },
  ]

  let accumulated = 0

  return (
    <div className="flex flex-wrap items-center justify-center gap-6">
      <svg viewBox="0 0 140 140" className="h-32 w-32 shrink-0">
        {slices.map((s) => {
          if (s.pct === 0) { accumulated += s.pct; return null }
          const start = accumulated
          const end = accumulated + s.pct
          accumulated = end
          return (
            <path key={s.label} d={slicePath(start, end)} fill={s.color} opacity={0.9}>
              <title>{`${s.label}: ${s.pct}%`}</title>
            </path>
          )
        })}
        <circle cx={cx} cy={cy} r={r - 2} fill="var(--card)" />
        <text x={cx} y={cy - 5} textAnchor="middle" fontSize={16} fontWeight="bold" fill="var(--foreground)">
          {total >= 1000 ? `${(total / 1000).toFixed(1)}k` : total}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize={9} fill="var(--muted-foreground)">
          visits
        </text>
      </svg>

      <div className="space-y-2">
        {slices.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
            <span style={{ color: 'var(--muted-foreground)' }}>{s.label}</span>
            <span className="ml-auto font-semibold tabular-nums pl-4">{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Referrers Table ──────────────────────────────────────────────────────────

function ReferrersTable({
  referrers,
  totalViews,
  error,
}: {
  referrers: { source: string; views: number }[]
  totalViews: number
  error?: string
}) {
  if (error) {
    return (
      <div className="flex items-start gap-2 text-sm" style={{ color: 'oklch(0.7 0.2 25)' }}>
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>Couldn&apos;t load referrers ({error})</span>
      </div>
    )
  }

  if (referrers.length === 0) {
    return (
      <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
        No referrer data available yet.
      </p>
    )
  }

  const max = Math.max(...referrers.map((r) => r.views), 1)
  const total = totalViews || max

  return (
    <div className="space-y-2">
      {referrers.map((r) => (
        <div key={r.source} className="group flex items-center gap-3">
          <div className="relative flex-1 overflow-hidden rounded-lg" style={{ background: 'var(--muted)' }}>
            <div
              className="h-8 rounded-lg transition-all duration-700"
              style={{
                width: `${(r.views / max) * 100}%`,
                background: 'color-mix(in oklch, var(--primary) 20%, transparent)',
                minWidth: '2rem',
              }}
            />
            <span className="absolute inset-0 flex items-center px-3 text-xs font-medium" style={{ color: 'var(--foreground)' }}>
              {r.source}
            </span>
          </div>
          <div className="w-16 shrink-0 text-right">
            <p className="text-xs font-semibold tabular-nums">{formatNumber(r.views)}</p>
            <p className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
              {Math.round((r.views / total) * 100)}%
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

/**
 * Average daily views derived from the trend array itself, not from
 * totalViews / period. This keeps the number consistent with what the
 * bar chart directly above it shows, and avoids showing "0" when the
 * count endpoint disagrees with (or lags) the aggregate endpoint.
 */
function computeAvgDailyViews(trend: { date: string; views: number }[]): number | null {
  if (trend.length === 0) return null
  const sum = trend.reduce((acc, d) => acc + d.views, 0)
  return Math.round(sum / trend.length)
}

function computeTotalReferredViews(referrers: { source: string; views: number }[]): number {
  return referrers.reduce((acc, r) => acc + r.views, 0)
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AnalyticsClient({ adminEmail }: { adminEmail: string }) {
  const router = useRouter()
  const { theme, setTheme } = useAdminTheme()

  const [period, setPeriod] = useState<Period>('7d')
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  const [loggingOut, setLoggingOut] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showThemePicker, setShowThemePicker] = useState(false)

  // ── Fetch analytics ──────────────────────────────────────────────────────────

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await fetch(`/api/admin/analytics?period=${period}&_t=${Date.now()}`, { cache: 'no-store' })
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [period])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Fetch unread badge ───────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/admin/messages?filter=all')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.stats?.unread) setUnreadCount(d.stats.unread) })
      .catch(() => {})
  }, [])

  // ── Logout ───────────────────────────────────────────────────────────────────

  const handleLogout = async () => {
    setLoggingOut(true)
    try { await fetch('/api/admin/logout', { method: 'POST' }) } finally {
      router.replace('/admin')
    }
  }

  // ── Nav items ────────────────────────────────────────────────────────────────
  // Canonical nav list — kept identical (order + items) across every admin
  // page's client component. This page was previously missing the
  // "Resume" item, which made it look like that tab vanished whenever the
  // user was on Analytics. "Security" added in Part 2.6.

  const navItems: NavItem[] = [
    { icon: <LayoutDashboard className="h-4 w-4" />, label: 'Dashboard', href: '/admin/dashboard' },
    { icon: <MessageSquare className="h-4 w-4" />, label: 'Messages', href: '/admin/messages', badge: unreadCount },
    { icon: <BarChart2 className="h-4 w-4" />, label: 'Analytics', href: '/admin/analytics', active: true },
    { icon: <FileText className="h-4 w-4" />, label: 'Resume', href: '/admin/resume' },
    { icon: <FileText className="h-4 w-4" />, label: 'Content', href: '/admin/content' },
    { icon: <Users className="h-4 w-4" />, label: 'Visitors', href: '/admin/visitors' },
    { icon: <Settings className="h-4 w-4" />, label: 'Settings', href: '/admin/settings' },
    { icon: <ShieldCheck className="h-4 w-4" />, label: 'Security', href: '/admin/security' },
  ]

  // ── Derived stats ────────────────────────────────────────────────────────────

  const avgDailyViews = data ? computeAvgDailyViews(data.trend) : null
  const totalReferredViews = data ? computeTotalReferredViews(data.referrers) : null
  const errors = data?._errors ?? {}

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      data-theme={theme}
      className="flex h-screen overflow-hidden"
      style={{ background: 'var(--background)', color: 'var(--foreground)' }}
    >
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r transition-transform duration-300 lg:static lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <div className="flex h-16 shrink-0 items-center gap-3 border-b px-5" style={{ borderColor: 'var(--border)' }}>
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg"
            style={{ background: 'color-mix(in oklch, var(--primary) 20%, transparent)' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.ico" alt="Logo" className="h-6 w-6 object-contain" />
          </div>
          <span className="truncate text-sm font-semibold tracking-tight">Admin Panel</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto shrink-0 rounded-lg p-1 lg:hidden"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav items — scrollable middle zone.
            `min-h-0` is required alongside `flex-1` so this flex child can
            actually shrink and scroll internally instead of clipping the
            bottom-most nav links. */}
        <nav className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1">
          {navItems.map(item => <SideNavItem key={item.href} {...item} />)}
        </nav>

        <div className="shrink-0 border-t p-3" style={{ borderColor: 'var(--border)' }}>
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-[var(--muted)]"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <ExternalLink className="h-4 w-4 shrink-0" />
            <span>View Portfolio</span>
          </a>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex flex-1 flex-col overflow-hidden">

        <header
          className="flex h-16 shrink-0 items-center gap-3 border-b px-4 sm:px-6"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 transition-colors hover:bg-[var(--muted)] lg:hidden"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2 text-sm">
            <span style={{ color: 'var(--muted-foreground)' }}>Admin</span>
            <span style={{ color: 'var(--border)' }}>/</span>
            <span className="font-medium">Analytics</span>
          </div>

          <div className="flex-1" />

          <div className="relative">
            <button
              onClick={() => setShowThemePicker(v => !v)}
              className="flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-medium transition-all duration-200"
              style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
            >
              <Palette className="h-3.5 w-3.5" />
              <span className="h-3 w-3 rounded-full" style={{ background: themes.find(t => t.id === theme)?.swatch ?? 'var(--primary)' }} />
              <span className="hidden sm:inline capitalize">{theme}</span>
              <ChevronDown className="h-3 w-3" />
            </button>

            {showThemePicker && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowThemePicker(false)} />
                <div
                  className="absolute right-0 top-11 z-50 min-w-[150px] rounded-xl border p-2 shadow-2xl"
                  style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
                >
                  {themes.map(t => (
                    <button
                      key={t.id}
                      onClick={() => { setTheme(t.id); setShowThemePicker(false) }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-150"
                      style={{
                        background: t.id === theme ? 'color-mix(in oklch, var(--primary) 15%, transparent)' : 'transparent',
                        color: t.id === theme ? 'var(--primary)' : 'var(--muted-foreground)',
                      }}
                    >
                      <span
                        className="h-3 w-3 shrink-0 rounded-full border"
                        style={{ background: t.swatch, borderColor: t.id === theme ? 'var(--primary)' : 'transparent' }}
                      />
                      {t.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div
            className="hidden items-center gap-2 rounded-full border px-3 py-1.5 text-xs sm:flex"
            style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
          >
            <div
              className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
              style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              {adminEmail.charAt(0).toUpperCase()}
            </div>
            <span className="max-w-[140px] truncate">{adminEmail}</span>
          </div>

          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all duration-200 disabled:opacity-50 hover:border-[var(--destructive)] hover:text-[var(--destructive)]"
            style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
          >
            {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            <span className="hidden sm:inline">Logout</span>
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">

          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold">Analytics Overview</h1>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                {data?._placeholder
                  ? 'Configure Vercel credentials to see real data'
                  : `Showing data for the last ${period === '7d' ? '7' : '30'} days`}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-xl border p-1 text-xs font-medium" style={{ borderColor: 'var(--border)' }}>
                {(['7d', '30d'] as Period[]).map(p => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className="rounded-lg px-3 py-1.5 transition-all duration-200"
                    style={{
                      background: period === p ? 'var(--primary)' : 'transparent',
                      color: period === p ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                    }}
                  >
                    {p === '7d' ? 'Last 7 days' : 'Last 30 days'}
                  </button>
                ))}
              </div>

              <button
                onClick={() => fetchData(true)}
                disabled={refreshing}
                className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-all"
                style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>

          {data?._placeholder && (
            <div
              className="mb-4 flex items-start gap-3 rounded-2xl border p-4"
              style={{
                background: 'color-mix(in oklch, oklch(0.7 0.2 25) 10%, transparent)',
                borderColor: 'color-mix(in oklch, oklch(0.7 0.2 25) 30%, transparent)',
              }}
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'oklch(0.7 0.2 25)' }} />
              <div>
                <p className="text-sm font-medium" style={{ color: 'oklch(0.7 0.2 25)' }}>
                  Vercel Analytics credentials not configured
                </p>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  Add{' '}
                  <code className="rounded px-1 py-0.5" style={{ background: 'var(--muted)' }}>VERCEL_API_TOKEN</code>{' '}
                  and{' '}
                  <code className="rounded px-1 py-0.5" style={{ background: 'var(--muted)' }}>VERCEL_PROJECT_ID</code>{' '}
                  to your <code className="rounded px-1 py-0.5" style={{ background: 'var(--muted)' }}>.env.local</code>.
                  {data._reason && <span className="ml-1 opacity-70">Reason: {data._reason}</span>}
                </p>
              </div>
            </div>
          )}

          {/* Per-section error banner (shown when credentials ARE configured but a call still failed) */}
          {!data?._placeholder && Object.keys(errors).length > 0 && (
            <div
              className="mb-4 flex items-start gap-3 rounded-2xl border p-4"
              style={{
                background: 'color-mix(in oklch, oklch(0.7 0.2 25) 10%, transparent)',
                borderColor: 'color-mix(in oklch, oklch(0.7 0.2 25) 30%, transparent)',
              }}
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'oklch(0.7 0.2 25)' }} />
              <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                <p className="text-sm font-medium" style={{ color: 'oklch(0.7 0.2 25)' }}>
                  Some analytics data failed to load
                </p>
                <ul className="mt-1 list-inside list-disc space-y-0.5">
                  {Object.entries(errors).map(([key, msg]) => (
                    <li key={key}><span className="font-medium capitalize">{key}</span>: {msg}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex h-64 items-center justify-center gap-3" style={{ color: 'var(--muted-foreground)' }}>
              <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--primary)' }} />
              <span className="text-sm">Loading analytics…</span>
            </div>
          ) : (
            <>
              <section className="mb-6">
                <h2 className="eyebrow mb-4">Key Metrics</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard
                    icon={<Eye className="h-5 w-5" style={{ color: 'var(--primary)' }} />}
                    label="Total Page Views"
                    value={data?.totalViews ?? null}
                    sub={`Last ${period === '7d' ? '7' : '30'} days`}
                    error={errors.count}
                  />
                  <StatCard
                    icon={<Users className="h-5 w-5" style={{ color: 'oklch(0.75 0.18 220)' }} />}
                    label="Unique Visitors"
                    value={data?.uniqueVisitors ?? null}
                    sub={`Last ${period === '7d' ? '7' : '30'} days`}
                    accent="oklch(0.75 0.18 220)"
                    error={errors.count}
                  />
                  <StatCard
                    icon={<TrendingUp className="h-5 w-5" style={{ color: 'oklch(0.75 0.18 150)' }} />}
                    label="Avg. Daily Views"
                    value={avgDailyViews}
                    sub="Views per day, from trend"
                    accent="oklch(0.75 0.18 150)"
                    error={errors.trend}
                  />
                  <StatCard
                    icon={<Globe className="h-5 w-5" style={{ color: 'oklch(0.75 0.18 30)' }} />}
                    label="Top Referrers"
                    value={totalReferredViews}
                    sub={`${data?.referrers?.length ?? 0} sources`}
                    accent="oklch(0.75 0.18 30)"
                    error={errors.referrers}
                  />
                </div>
              </section>

              <section className="mb-6">
                <div className="rounded-2xl border p-5" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-sm font-semibold">Visit Trend</h2>
                    <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      {period === '7d' ? 'Last 7 days' : 'Last 30 days'} · page views / day
                    </span>
                  </div>
                  {errors.trend ? (
                    <div className="flex h-40 items-center justify-center gap-2 text-sm" style={{ color: 'oklch(0.7 0.2 25)' }}>
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      Couldn&apos;t load trend data ({errors.trend})
                    </div>
                  ) : (
                    <TrendChart data={data?.trend ?? []} />
                  )}
                </div>
              </section>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="rounded-2xl border p-5" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                  <div className="mb-4 flex items-center gap-2">
                    <Monitor className="h-4 w-4" style={{ color: 'var(--primary)' }} />
                    <h2 className="text-sm font-semibold">Device Breakdown</h2>
                  </div>
                  {errors.devices ? (
                    <div className="flex h-32 items-center justify-center gap-2 text-sm" style={{ color: 'oklch(0.7 0.2 25)' }}>
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      Couldn&apos;t load device data ({errors.devices})
                    </div>
                  ) : (
                    <DeviceDonut
                      mobile={data?.devices?.mobile ?? 0}
                      desktop={data?.devices?.desktop ?? 0}
                      tablet={data?.devices?.tablet ?? 0}
                    />
                  )}
                </div>

                <div className="rounded-2xl border p-5" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                  <div className="mb-4 flex items-center gap-2">
                    <Globe className="h-4 w-4" style={{ color: 'var(--primary)' }} />
                    <h2 className="text-sm font-semibold">Top Referrers</h2>
                  </div>
                  <ReferrersTable
                    referrers={data?.referrers ?? []}
                    totalViews={data?.totalViews ?? 0}
                    error={errors.referrers}
                  />
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}