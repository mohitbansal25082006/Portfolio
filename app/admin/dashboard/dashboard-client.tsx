'use client'

/**
 * app/admin/dashboard/dashboard-client.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Part 3.2 (Dashboard upgrade) — Advanced, fully-interactive Dashboard home
 *
 * REVISION:
 *   1. "Content" card → renamed "Projects", shows project count.
 *   2. "Tech Stack" card → replaced with "Settings" card.
 *   3. Devices donut uses DISTINCT_DEVICE_COLORS so no two slices collide.
 *   4. System Health image/size row now populated from the aggregator.
 *   5. Layout redesigned with a 12-column grid — no orphan columns on any
 *      breakpoint.
 *   6. "0 B" hidden from System Health — the Size cell only appears when
 *      there is a real, non-zero byte count. When there are no images at
 *      all, the whole image strip collapses to just the Versions count.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Eye,
  MessageSquare,
  Download,
  FolderKanban,
  ShieldCheck,
  Star,
  Activity,
  ExternalLink,
  Settings as SettingsIcon,
  ShieldAlert,
  RefreshCw,
  AlertTriangle,
  Server,
  BarChart2,
  Layers,
  GitBranch,
  MailOpen,
  Mail,
  CheckCircle2,
  TrendingUp,
  Globe,
  Wrench,
  Link2,
} from 'lucide-react'

import { DashboardShell } from '@/components/admin/dashboard-shell'
import { StatCard } from '@/components/admin/stat-card'
import {
  Panel,
  PanelHeader,
  SkeletonBlock,
  EmptyState,
  HealthDot,
  ActivityRow,
  QuickActionButton,
  InlineSpinner,
} from '@/components/admin/widgets'
import {
  BarChart,
  DonutChart,
  DeltaBadge,
  DISTINCT_DEVICE_COLORS,
} from '@/components/admin/charts'
import type { DashboardPayload } from '@/lib/dashboard-aggregator'

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}k`
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}k`
  return String(n)
}

/** Formats a byte count; returns '' for 0/unknown so callers can hide the cell. */
function formatBytes(n: number): string {
  if (!n || n <= 0) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

function timeAgo(iso: string): string {
  if (!iso || iso === new Date(0).toISOString()) return '—'
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

function dayLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return isoDate
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

// ─── Loading skeleton ─────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6 sm:space-y-8">
      <SkeletonBlock height={110} radius={16} />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonBlock key={i} height={150} radius={16} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <SkeletonBlock height={300} radius={16} />
        </div>
        <div className="lg:col-span-4">
          <SkeletonBlock height={300} radius={16} />
        </div>
        <div className="lg:col-span-5">
          <SkeletonBlock height={260} radius={16} />
        </div>
        <div className="lg:col-span-4">
          <SkeletonBlock height={260} radius={16} />
        </div>
        <div className="lg:col-span-3">
          <SkeletonBlock height={260} radius={16} />
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────

export default function AdminDashboardClient({ adminEmail }: { adminEmail: string }) {
  const router = useRouter()
  const [period, setPeriod] = useState<7 | 30>(7)
  const [data, setData] = useState<DashboardPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(
    async (p: 7 | 30, mode: 'initial' | 'refresh') => {
      if (mode === 'initial') setLoading(true)
      else setRefreshing(true)
      setError(null)
      try {
        const res = await fetch(`/api/admin/dashboard?period=${p}d`, { cache: 'no-store' })
        if (res.status === 401) {
          router.replace('/admin')
          return
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = (await res.json()) as DashboardPayload
        setData(json)
      } catch (err) {
        console.error('Failed to load dashboard:', err)
        setError('Failed to load dashboard data. Try refreshing.')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [router],
  )

  useEffect(() => {
    fetchData(period, 'initial')
  }, [period, fetchData])

  const handleRefresh = useCallback(() => {
    fetchData(period, 'refresh')
  }, [fetchData, period])

  const analytics = data?.analytics
  const messages = data?.messages
  const resume = data?.resume
  const content = data?.content
  const security = data?.security
  const settings = data?.settings

  const trendForSpark = useMemo(() => analytics?.trend?.map(t => t.views) ?? [], [analytics])

  // Distinct colours per device — never collides across themes
  const deviceSlices = useMemo(() => {
    if (!analytics) return []
    return [
      { label: 'Desktop', value: analytics.devices.desktop, color: DISTINCT_DEVICE_COLORS.desktop },
      { label: 'Mobile', value: analytics.devices.mobile, color: DISTINCT_DEVICE_COLORS.mobile },
      { label: 'Tablet', value: analytics.devices.tablet, color: DISTINCT_DEVICE_COLORS.tablet },
    ].filter(s => s.value > 0)
  }, [analytics])

  const topReferrers = useMemo(() => (analytics?.referrers ?? []).slice(0, 5), [analytics])
  const maxRef = useMemo(() => Math.max(1, ...topReferrers.map(r => r.views)), [topReferrers])

  const unreadRatio = messages && messages.total > 0 ? (messages.read / messages.total) * 100 : 0

  const showStorageWarning =
    data &&
    !data._degraded &&
    (!analytics?.storage.redisConfigured || !resume?.storage.blobConfigured)

  // System Health image strip — hide "0 B" entirely when there is no size.
  const imageBytesLabel = content ? formatBytes(content.imageBytes) : ''
  const hasImages = !!content && content.images > 0
  const showHealthImageStrip = !!content && (hasImages || content.versions > 0)
  const showSizeCell = hasImages && imageBytesLabel.length > 0

  const activityIcon = (type: string) => {
    switch (type) {
      case 'message':
        return {
          icon: <MessageSquare className="h-3.5 w-3.5" style={{ color: 'oklch(0.75 0.18 220)' }} />,
          bg: 'color-mix(in oklch, oklch(0.75 0.18 220) 15%, transparent)',
        }
      case 'content':
        return {
          icon: <FolderKanban className="h-3.5 w-3.5" style={{ color: 'oklch(0.75 0.18 60)' }} />,
          bg: 'color-mix(in oklch, oklch(0.75 0.18 60) 15%, transparent)',
        }
      case 'resume':
        return {
          icon: <Download className="h-3.5 w-3.5" style={{ color: 'oklch(0.75 0.18 150)' }} />,
          bg: 'color-mix(in oklch, oklch(0.75 0.18 150) 15%, transparent)',
        }
      case 'settings':
        return {
          icon: <SettingsIcon className="h-3.5 w-3.5" style={{ color: 'oklch(0.75 0.18 200)' }} />,
          bg: 'color-mix(in oklch, oklch(0.75 0.18 200) 15%, transparent)',
        }
      case 'security':
        return {
          icon: <ShieldAlert className="h-3.5 w-3.5" style={{ color: 'oklch(0.72 0.2 25)' }} />,
          bg: 'color-mix(in oklch, oklch(0.72 0.2 25) 15%, transparent)',
        }
      default:
        return {
          icon: <ShieldCheck className="h-3.5 w-3.5" style={{ color: 'oklch(0.75 0.18 320)' }} />,
          bg: 'color-mix(in oklch, oklch(0.75 0.18 320) 15%, transparent)',
        }
    }
  }

  const cards = useMemo(() => {
    if (!data) return []
    return [
      {
        icon: <Eye className="h-5 w-5" />,
        label: 'Page Views',
        value: analytics?.totalViews ?? 0,
        sub: analytics
          ? `${formatNumber(analytics.uniqueVisitors)} unique visitors · ${period}d`
          : `Last ${period} days`,
        accent: 'var(--primary)',
        href: '/admin/analytics',
        trend: trendForSpark,
        deltaPct: analytics?.viewsDeltaPct ?? null,
      },
      {
        icon: <MessageSquare className="h-5 w-5" />,
        label: 'Messages',
        value: messages?.total ?? 0,
        sub: messages
          ? `${messages.unread} unread · ${messages.replied} replied`
          : 'Contact form submissions',
        accent: 'oklch(0.75 0.18 220)',
        href: '/admin/messages',
        progress: unreadRatio,
        badge:
          messages && messages.unread > 0
            ? { label: `${messages.unread} new`, color: 'oklch(0.75 0.18 220)' }
            : undefined,
      },
      {
        icon: <Download className="h-5 w-5" />,
        label: 'Resume Downloads',
        value: resume?.downloadCount ?? 0,
        sub: resume
          ? resume.size > 0
            ? `${resume.fileName} · ${formatBytes(resume.size)}`
            : resume.fileName
          : 'Total downloads',
        accent: 'oklch(0.75 0.18 150)',
        href: '/admin/resume',
        badge:
          resume && resume.storage.blobConfigured
            ? undefined
            : { label: 'local', color: 'oklch(0.75 0.18 60)' },
      },
      {
        icon: <FolderKanban className="h-5 w-5" />,
        label: 'Projects',
        value: content?.projects ?? 0,
        sub: content
          ? `${content.timeline} timeline · ${content.skillGroups} skill groups`
          : 'Portfolio sections',
        accent: 'oklch(0.75 0.18 60)',
        href: '/admin/content',
        badge:
          content && content.versions > 0
            ? { label: `${content.versions} ver`, color: 'oklch(0.75 0.18 60)' }
            : undefined,
      },
      {
        icon: <ShieldCheck className="h-5 w-5" />,
        label: 'Active Sessions',
        value: security?.activeSessions ?? 0,
        sub: security
          ? `${security.failedAttempts} failed attempt${security.failedAttempts === 1 ? '' : 's'} this week`
          : 'Security overview',
        accent:
          security && security.failedAttempts > 0 ? 'oklch(0.72 0.2 25)' : 'oklch(0.75 0.18 320)',
        href: '/admin/security',
        badge:
          security && security.failedAttempts > 0
            ? { label: 'check', color: 'oklch(0.72 0.2 25)' }
            : undefined,
      },
      {
        icon: <SettingsIcon className="h-5 w-5" />,
        label: 'Site Settings',
        value: settings
          ? settings.sitePaused
            ? 'Paused'
            : settings.maintenanceMode
              ? 'Banner'
              : 'Live'
          : '—',
        static: true,
        sub: settings
          ? `${settings.socialLinksCount} social link${settings.socialLinksCount === 1 ? '' : 's'} · ${settings.availabilityStatus || 'no status'}`
          : 'Maintenance, links, availability',
        accent: 'oklch(0.75 0.18 200)',
        href: '/admin/settings',
        badge: settings?.sitePaused
          ? { label: 'paused', color: 'oklch(0.72 0.2 25)' }
          : settings?.maintenanceMode
            ? { label: 'banner', color: 'oklch(0.75 0.18 60)' }
            : undefined,
      },
    ]
  }, [
    data,
    analytics,
    messages,
    resume,
    content,
    security,
    settings,
    period,
    trendForSpark,
    unreadRatio,
  ])

  return (
    <DashboardShell
      adminEmail={adminEmail}
      currentPath="/admin/dashboard"
      unreadCount={messages?.unread ?? 0}
      onRefresh={handleRefresh}
      refreshing={refreshing}
      breadcrumb="Dashboard"
    >
      {loading || !data ? (
        <DashboardSkeleton />
      ) : (
        <div className="space-y-6 sm:space-y-8">
          {/* ── Banners ── */}
          {error && (
            <div
              className="flex items-start gap-3 rounded-2xl border p-4"
              style={{
                borderColor: 'color-mix(in oklch, oklch(0.72 0.2 25) 40%, var(--border))',
                background: 'color-mix(in oklch, oklch(0.72 0.2 25) 10%, transparent)',
              }}
            >
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" style={{ color: 'oklch(0.72 0.2 25)' }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Couldn’t load the dashboard</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                  {error}
                </p>
              </div>
              <button
                onClick={handleRefresh}
                className="shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                Retry
              </button>
            </div>
          )}

          {data._degraded && !error && (
            <div
              className="flex items-start gap-3 rounded-2xl border p-4"
              style={{
                borderColor: 'color-mix(in oklch, oklch(0.75 0.18 60) 40%, var(--border))',
                background: 'color-mix(in oklch, oklch(0.75 0.18 60) 10%, transparent)',
              }}
            >
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" style={{ color: 'oklch(0.75 0.18 60)' }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Some panels fell back to defaults</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                  One or more data sources were temporarily unavailable.
                </p>
              </div>
            </div>
          )}

          {showStorageWarning && (
            <div
              className="flex items-start gap-3 rounded-2xl border p-4"
              style={{
                borderColor: 'color-mix(in oklch, var(--primary) 30%, var(--border))',
                background: 'color-mix(in oklch, var(--primary) 6%, transparent)',
              }}
            >
              <Server className="h-5 w-5 shrink-0 mt-0.5" style={{ color: 'var(--primary)' }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">You’re running on local storage</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                  {!analytics?.storage.redisConfigured && 'Redis is not configured — analytics '}
                  {!analytics?.storage.redisConfigured && !resume?.storage.blobConfigured && 'and '}
                  {!resume?.storage.blobConfigured && 'Blob is not configured — resume uploads '}
                  won’t persist on Vercel.
                </p>
              </div>
            </div>
          )}

          {/* ── Welcome / period toggle ── */}
          <div
            className="relative overflow-hidden rounded-2xl border p-5 sm:p-6"
            style={{
              background: 'color-mix(in oklch, var(--primary) 8%, var(--card))',
              borderColor: 'color-mix(in oklch, var(--primary) 25%, transparent)',
            }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="eyebrow mb-1.5">Welcome back</p>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold truncate">Dashboard</h1>
                <p className="mt-1 text-xs sm:text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Signed in as <span style={{ color: 'var(--primary)' }}>{adminEmail}</span> · Updated{' '}
                  {timeAgo(data.generatedAt)}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div
                  className="flex rounded-xl border p-0.5"
                  style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
                >
                  {([7, 30] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setPeriod(p)}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
                      style={{
                        background: period === p ? 'var(--primary)' : 'transparent',
                        color:
                          period === p ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                      }}
                    >
                      {p}d
                    </button>
                  ))}
                </div>
                <div
                  className="hidden sm:flex h-14 w-14 items-center justify-center rounded-2xl overflow-hidden"
                  style={{ background: 'color-mix(in oklch, var(--primary) 20%, transparent)' }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/icon.ico" alt="Logo" className="h-9 w-9 object-contain" />
                </div>
              </div>
            </div>
          </div>

          {/* ── Stat cards ── */}
          <section>
            <div className="mb-3 sm:mb-4 flex items-center justify-between">
              <h2 className="eyebrow">Overview</h2>
              {refreshing && <InlineSpinner className="h-3.5 w-3.5" />}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
              {cards.map(c => (
                <StatCard key={c.label} {...(c as any)} />
              ))}
            </div>
          </section>

          {/* ══ Redesigned 12-col grid ══ */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
            {/* Row 1 */}
            <div className="lg:col-span-8">
              <Panel className="h-full">
                <PanelHeader
                  title="Visit Trend"
                  subtitle={`Public site views · last ${period} days`}
                  icon={<TrendingUp className="h-4 w-4" />}
                  action={
                    <div className="flex items-center gap-2">
                      <span
                        className="text-xs font-mono tabular-nums"
                        style={{ color: 'var(--muted-foreground)' }}
                      >
                        {formatNumber(analytics?.totalViews ?? 0)} total
                      </span>
                      <DeltaBadge value={analytics?.viewsDeltaPct ?? null} />
                    </div>
                  }
                />
                {analytics && analytics.trend.length > 0 ? (
                  <BarChart
                    data={analytics.trend.map(t => ({
                      label: dayLabel(t.date),
                      value: t.views,
                      sublabel: dayLabel(t.date),
                    }))}
                    height={220}
                    ariaLabel="Visit trend bar chart"
                    formatValue={v => formatNumber(v)}
                  />
                ) : (
                  <EmptyState
                    icon={<BarChart2 className="h-6 w-6" />}
                    title="No visits yet"
                    description="Data will appear here once your portfolio receives traffic."
                  />
                )}
              </Panel>
            </div>

            <div className="lg:col-span-4">
              <Panel className="h-full">
                <PanelHeader
                  title="Devices"
                  subtitle={`${period}-day breakdown`}
                  icon={<BarChart2 className="h-4 w-4" />}
                />
                {deviceSlices.length > 0 ? (
                  <DonutChart
                    slices={deviceSlices}
                    size={150}
                    thickness={16}
                    centerLabel={formatNumber(analytics?.totalViews ?? 0)}
                    centerSub="views"
                    ariaLabel="Device breakdown"
                  />
                ) : (
                  <EmptyState
                    icon={<BarChart2 className="h-6 w-6" />}
                    title="No device data"
                    description="Once visitors arrive, their device split shows here."
                  />
                )}
              </Panel>
            </div>

            {/* Row 2 */}
            <div className="lg:col-span-5">
              <Panel className="h-full">
                <PanelHeader
                  title="Recent Activity"
                  subtitle="Combined feed across all admin features"
                  icon={<Activity className="h-4 w-4" />}
                />
                {data.activity.length === 0 ? (
                  <EmptyState
                    icon={<Activity className="h-6 w-6" />}
                    title="No activity yet"
                    description="Messages, content edits and security events will appear here."
                  />
                ) : (
                  <div className="-mx-2.5 divide-y" style={{ borderColor: 'var(--border)' }}>
                    {data.activity.slice(0, 6).map(item => {
                      const { icon, bg } = activityIcon(item.type)
                      const href =
                        item.type === 'message'
                          ? '/admin/messages'
                          : item.type === 'content'
                            ? '/admin/content'
                            : item.type === 'resume'
                              ? '/admin/resume'
                              : item.type === 'security'
                                ? '/admin/security'
                                : item.type === 'settings'
                                  ? '/admin/settings'
                                  : undefined
                      return (
                        <ActivityRow
                          key={item.id}
                          icon={icon}
                          iconBg={bg}
                          title={item.title}
                          description={item.description}
                          time={timeAgo(item.timestamp)}
                          tone={item.tone}
                          href={href}
                        />
                      )
                    })}
                  </div>
                )}
              </Panel>
            </div>

            <div className="lg:col-span-4">
              <Panel className="h-full">
                <PanelHeader
                  title="Top Referrers"
                  subtitle={`Where your ${period}-day traffic came from`}
                  icon={<GitBranch className="h-4 w-4" />}
                />
                {topReferrers.length > 0 ? (
                  <div className="space-y-2.5">
                    {topReferrers.map((r, i) => (
                      <div key={`${r.source}-${i}`} className="flex items-center gap-3">
                        <span
                          className="w-5 text-right text-[10px] font-mono tabular-nums"
                          style={{ color: 'var(--muted-foreground)' }}
                        >
                          {i + 1}
                        </span>
                        <span className="w-20 sm:w-28 truncate text-xs font-medium">{r.source}</span>
                        <div
                          className="flex-1 h-1.5 rounded-full overflow-hidden"
                          style={{ background: 'var(--muted)' }}
                        >
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${(r.views / maxRef) * 100}%`, background: 'var(--primary)' }}
                          />
                        </div>
                        <span className="w-10 text-right text-xs font-mono tabular-nums">
                          {formatNumber(r.views)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={<GitBranch className="h-6 w-6" />}
                    title="No referrers yet"
                    description="External traffic sources appear here."
                  />
                )}
              </Panel>
            </div>

            <div className="lg:col-span-3">
              <Panel className="h-full">
                <PanelHeader
                  title="System Health"
                  subtitle="Storage & site status"
                  icon={<Server className="h-4 w-4" />}
                />
                <div className="grid grid-cols-1 gap-2">
                  {data.health.map(h => (
                    <HealthDot key={h.id} ok={h.ok} label={h.label} detail={h.detail} />
                  ))}
                </div>

                {/* Image / Version strip — "0 B" is never shown; Size cell only
                    appears when there is a real byte count. */}
                {showHealthImageStrip && (
                  <div
                    className={`mt-4 grid gap-2 rounded-xl border p-3 ${
                      showSizeCell ? 'grid-cols-3' : hasImages ? 'grid-cols-2' : 'grid-cols-1'
                    }`}
                    style={{ borderColor: 'var(--border)' }}
                  >
                    {hasImages && (
                      <div className="text-center">
                        <p className="text-base font-bold tabular-nums">{content!.images}</p>
                        <p
                          className="text-[10px] font-mono uppercase tracking-wide"
                          style={{ color: 'var(--muted-foreground)' }}
                        >
                          Images
                        </p>
                      </div>
                    )}
                    {showSizeCell && (
                      <div className="text-center">
                        <p className="text-base font-bold tabular-nums">{imageBytesLabel}</p>
                        <p
                          className="text-[10px] font-mono uppercase tracking-wide"
                          style={{ color: 'var(--muted-foreground)' }}
                        >
                          Size
                        </p>
                      </div>
                    )}
                    <div className="text-center">
                      <p className="text-base font-bold tabular-nums">{content!.versions}</p>
                      <p
                        className="text-[10px] font-mono uppercase tracking-wide"
                        style={{ color: 'var(--muted-foreground)' }}
                      >
                        Versions
                      </p>
                    </div>
                  </div>
                )}
              </Panel>
            </div>

            {/* Row 3 */}
            <div className="lg:col-span-7">
              <Panel className="h-full">
                <PanelHeader
                  title="Latest Messages"
                  subtitle={`${messages?.unread ?? 0} unread · ${messages?.total ?? 0} total`}
                  icon={<Mail className="h-4 w-4" />}
                  action={
                    <a
                      href="/admin/messages"
                      className="text-xs font-medium"
                      style={{ color: 'var(--primary)' }}
                    >
                      View all
                    </a>
                  }
                />
                {messages && messages.recent.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {messages.recent.slice(0, 4).map(m => (
                      <a
                        key={m.id}
                        href="/admin/messages"
                        className="flex items-start gap-3 rounded-xl border p-3 transition-all hover:-translate-y-0.5"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                          style={{
                            background: 'color-mix(in oklch, var(--primary) 18%, transparent)',
                            color: 'var(--primary)',
                          }}
                        >
                          {m.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{m.name}</p>
                            {!m.read && (
                              <span
                                className="h-1.5 w-1.5 rounded-full shrink-0"
                                style={{ background: 'var(--primary)' }}
                              />
                            )}
                          </div>
                          <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
                            {m.subject || '(no subject)'}
                          </p>
                          <p
                            className="text-[10px] font-mono mt-0.5"
                            style={{ color: 'var(--muted-foreground)' }}
                          >
                            {timeAgo(m.timestamp)}
                          </p>
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={<MailOpen className="h-6 w-6" />}
                    title="Inbox is empty"
                    description="Contact form submissions will show up here."
                  />
                )}
              </Panel>
            </div>

            <div className="lg:col-span-5">
              <Panel className="h-full">
                <PanelHeader title="Quick Actions" icon={<Star className="h-4 w-4" />} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <QuickActionButton
                    icon={<ExternalLink className="h-4 w-4" />}
                    label="View Portfolio"
                    description="Open the live public site"
                    href="/"
                    external
                  />
                  <QuickActionButton
                    icon={<MessageSquare className="h-4 w-4" />}
                    label="Messages Inbox"
                    description="Reply & triage contact form"
                    href="/admin/messages"
                    accent="oklch(0.75 0.18 220)"
                  />
                  <QuickActionButton
                    icon={<FolderKanban className="h-4 w-4" />}
                    label="Edit Content"
                    description="Projects, skills, timeline"
                    href="/admin/content"
                    accent="oklch(0.75 0.18 60)"
                  />
                  <QuickActionButton
                    icon={<Download className="h-4 w-4" />}
                    label="Manage Resume"
                    description="Upload & track downloads"
                    href="/admin/resume"
                    accent="oklch(0.75 0.18 150)"
                  />
                  <QuickActionButton
                    icon={<ShieldCheck className="h-4 w-4" />}
                    label="Security & Sessions"
                    description="2FA, recovery codes, logins"
                    href="/admin/security"
                    accent="oklch(0.75 0.18 320)"
                  />
                  <QuickActionButton
                    icon={<SettingsIcon className="h-4 w-4" />}
                    label="Site Settings"
                    description="Maintenance, links, availability"
                    href="/admin/settings"
                    accent="oklch(0.75 0.18 200)"
                  />
                </div>
              </Panel>
            </div>

            {/* Row 4 — Site summary strip */}
            {settings && (
              <div className="lg:col-span-12">
                <Panel>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                        style={{
                          background: 'color-mix(in oklch, var(--primary) 15%, transparent)',
                          color: 'var(--primary)',
                        }}
                      >
                        {settings.sitePaused ? (
                          <Wrench className="h-4 w-4" />
                        ) : (
                          <Globe className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          Site status
                        </p>
                        <p className="text-sm font-medium truncate">
                          {settings.sitePaused
                            ? 'Paused'
                            : settings.maintenanceMode
                              ? 'Banner'
                              : 'Live'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                        style={{
                          background: 'color-mix(in oklch, var(--primary) 15%, transparent)',
                          color: 'var(--primary)',
                        }}
                      >
                        <Layers className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          Availability
                        </p>
                        <p className="text-sm font-medium truncate">
                          {settings.availabilityStatus || '—'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                        style={{
                          background: 'color-mix(in oklch, var(--primary) 15%, transparent)',
                          color: 'var(--primary)',
                        }}
                      >
                        <Mail className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          Contact email
                        </p>
                        <p className="text-sm font-medium truncate">
                          {settings.contactEmail || '—'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                        style={{
                          background: 'color-mix(in oklch, var(--primary) 15%, transparent)',
                          color: 'var(--primary)',
                        }}
                      >
                        <Link2 className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          Social links
                        </p>
                        <p className="text-sm font-medium truncate">
                          {settings.socialLinksCount} connected
                        </p>
                      </div>
                    </div>
                  </div>
                </Panel>
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-between gap-3 flex-wrap text-xs rounded-2xl border px-4 py-3"
            style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5" style={{ color: 'oklch(0.72 0.18 150)' }} />
              Data refreshed {timeAgo(data.generatedAt)} · period {period}d
            </span>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 font-medium disabled:opacity-50"
              style={{ color: 'var(--primary)' }}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh now
            </button>
          </div>
        </div>
      )}
    </DashboardShell>
  )
}