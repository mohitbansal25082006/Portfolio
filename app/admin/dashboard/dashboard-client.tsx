'use client'

/**
 * app/admin/dashboard/dashboard-client.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Part 2.7 update: 
 *   - Removed "Visitors" nav item (7 items now)
 *   - Full dashboard redesign with integrated stats from all features
 *   - Content section preview
 *   - Activity feed showing recent events
 *
 * Mobile fix (Part A):
 *   - Changed h-screen to admin-viewport-height for dynamic viewport support
 *   - Added safe-area padding for mobile
 *   - Improved sidebar mobile behavior
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  LogOut,
  Mail,
  Users,
  FileText,
  Settings,
  ExternalLink,
  Shield,
  ShieldCheck,
  TrendingUp,
  MessageSquare,
  Eye,
  Loader2,
  Menu,
  X,
  Palette,
  BarChart2,
  FolderKanban,
  Download,
  Clock,
  ArrowUpRight,
  Activity,
  CheckCircle2,
  AlertCircle,
  Star,
  GitBranch,
} from 'lucide-react'
import { themes } from '@/lib/content'

// ─── Types ────────────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: string | number
  sub?: string
  color?: string
  loading?: boolean
  href?: string
}

interface NavItem {
  icon: React.ReactNode
  label: string
  href: string
  active?: boolean
  badge?: number
}

interface AnalyticsSummary {
  totalViews: number | null
  uniqueVisitors: number | null
  _placeholder?: boolean
}

interface ResumeMeta {
  downloadCount: number
  fileName: string
  uploadedAt: string
}

interface ActivityItem {
  id: string
  type: 'message' | 'login' | 'content' | 'resume'
  title: string
  description: string
  timestamp: string
}

// ─── Theme hook ───────────────────────────────────────────────────────────────

function useAdminTheme() {
  const [theme, setThemeState] = useState<string>('midnight')

  useEffect(() => {
    const saved = localStorage.getItem('admin-theme') ?? 'midnight'
    setThemeState(saved)
  }, [])

  const setTheme = (id: string) => {
    setThemeState(id)
    localStorage.setItem('admin-theme', id)
  }

  return { theme, setTheme }
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, color, loading, href }: StatCardProps) {
  const content = (
    <div
      className="stat-card relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
      style={{
        background: 'var(--card)',
        borderColor: 'var(--border)',
        cursor: href ? 'pointer' : 'default',
      }}
    >
      <div className="stat-card-shine" />
      <div className="relative z-10">
        <div className="mb-3 flex items-center justify-between">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: color ?? 'color-mix(in oklch, var(--primary) 15%, transparent)' }}
          >
            {icon}
          </div>
          {href && (
            <ArrowUpRight
              className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100"
              style={{ color: 'var(--muted-foreground)' }}
            />
          )}
        </div>
        <p className="text-2xl font-bold tabular-nums">
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--muted-foreground)' }} />
          ) : (
            value
          )}
        </p>
        <p className="mt-0.5 text-sm font-medium">{label}</p>
        {sub && (
          <p className="mt-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {sub}
          </p>
        )}
      </div>
    </div>
  )

  return href ? <a href={href} className="block">{content}</a> : content
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function AdminDashboardClient({ adminEmail }: { adminEmail: string }) {
  const router = useRouter()
  const { theme, setTheme } = useAdminTheme()
  const [loggingOut, setLoggingOut] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showThemePicker, setShowThemePicker] = useState(false)
  const [msgStats, setMsgStats] = useState<{ total: number; unread: number; replied: number } | null>(null)
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(true)
  const [resumeMeta, setResumeMeta] = useState<ResumeMeta | null>(null)
  const [contentUpdatedAt, setContentUpdatedAt] = useState<string | null>(null)
  const [securityStats, setSecurityStats] = useState<{ activeSessions: number; failedAttempts: number } | null>(null)
  const [recentMessages, setRecentMessages] = useState<any[]>([])

  // Fetch message stats
  useEffect(() => {
    fetch('/api/admin/messages?filter=all')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.stats) setMsgStats(d.stats)
        if (d?.messages) setRecentMessages(d.messages.slice(0, 5))
      })
      .catch(() => {})
  }, [])

  // Fetch analytics summary
  useEffect(() => {
    let cancelled = false
    setAnalyticsLoading(true)
    fetch('/api/admin/analytics?period=7d', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!cancelled && d) {
          setAnalytics({
            totalViews: d.totalViews ?? null,
            uniqueVisitors: d.uniqueVisitors ?? null,
            _placeholder: d._placeholder,
          })
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setAnalyticsLoading(false) })
    return () => { cancelled = true }
  }, [])

  // Fetch resume metadata
  useEffect(() => {
    fetch('/api/admin/resume', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setResumeMeta({
            downloadCount: d.downloadCount ?? 0,
            fileName: d.fileName ?? 'resume.pdf',
            uploadedAt: d.uploadedAt ?? new Date(0).toISOString(),
          })
        }
      })
      .catch(() => {})
  }, [])

  // Fetch content info
  useEffect(() => {
    fetch('/api/admin/content', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.content?.updatedAt) {
          setContentUpdatedAt(d.content.updatedAt)
        }
      })
      .catch(() => {})
  }, [])

  // Fetch security stats
  useEffect(() => {
    fetch('/api/admin/security', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setSecurityStats({
            activeSessions: d.sessions?.length ?? 0,
            failedAttempts: d.loginAttempts?.filter((a: any) => !a.success).length ?? 0,
          })
        }
      })
      .catch(() => {})
  }, [])

  const handleLogout = useCallback(async () => {
    setLoggingOut(true)
    try {
      await fetch('/api/admin/logout', { method: 'POST' })
    } finally {
      router.replace('/admin')
    }
  }, [router])

  // Canonical 7-item nav list (Visitors removed in Part 2.7)
  const navItems: NavItem[] = [
    { icon: <LayoutDashboard className="h-4 w-4" />, label: 'Dashboard', href: '/admin/dashboard', active: true },
    { icon: <MessageSquare className="h-4 w-4" />, label: 'Messages', href: '/admin/messages', badge: msgStats?.unread ?? 0 },
    { icon: <BarChart2 className="h-4 w-4" />, label: 'Analytics', href: '/admin/analytics' },
    { icon: <FileText className="h-4 w-4" />, label: 'Resume', href: '/admin/resume' },
    { icon: <FolderKanban className="h-4 w-4" />, label: 'Content', href: '/admin/content' },
    { icon: <Settings className="h-4 w-4" />, label: 'Settings', href: '/admin/settings' },
    { icon: <ShieldCheck className="h-4 w-4" />, label: 'Security', href: '/admin/security' },
  ]

  // Build activity items from fetched data
  const activityItems: ActivityItem[] = [
    ...recentMessages.map((msg: any) => ({
      id: `msg-${msg.id}`,
      type: 'message' as const,
      title: `New message from ${msg.name}`,
      description: msg.subject,
      timestamp: msg.timestamp,
    })),
    ...(contentUpdatedAt && contentUpdatedAt !== new Date(0).toISOString()
      ? [{
          id: 'content-update',
          type: 'content' as const,
          title: 'Content updated',
          description: 'Portfolio content was modified',
          timestamp: contentUpdatedAt,
        }]
      : []),
    ...(resumeMeta && resumeMeta.uploadedAt !== new Date(0).toISOString()
      ? [{
          id: 'resume-update',
          type: 'resume' as const,
          title: 'Resume updated',
          description: resumeMeta.fileName,
          timestamp: resumeMeta.uploadedAt,
        }]
      : []),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 8)

  const pageViewsValue: string | number =
    analytics?.totalViews != null ? formatNumber(analytics.totalViews) : '—'
  const pageViewsSub = analytics?._placeholder
    ? 'Analytics not configured'
    : analytics?.uniqueVisitors != null
      ? `${formatNumber(analytics.uniqueVisitors)} visitors · last 7 days`
      : 'See Analytics tab for details'

  const stats: StatCardProps[] = [
    {
      icon: <Eye className="h-5 w-5" style={{ color: 'var(--primary)' }} />,
      label: 'Page Views',
      value: pageViewsValue,
      sub: pageViewsSub,
      color: 'color-mix(in oklch, var(--primary) 15%, transparent)',
      loading: analyticsLoading,
      href: '/admin/analytics',
    },
    {
      icon: <MessageSquare className="h-5 w-5" style={{ color: 'oklch(0.75 0.18 220)' }} />,
      label: 'Messages',
      value: msgStats ? msgStats.total : '—',
      sub: msgStats ? `${msgStats.unread} unread · ${msgStats.replied} replied` : 'Contact form submissions',
      color: 'color-mix(in oklch, oklch(0.75 0.18 220) 15%, transparent)',
      href: '/admin/messages',
    },
    {
      icon: <Download className="h-5 w-5" style={{ color: 'oklch(0.75 0.18 150)' }} />,
      label: 'Resume Downloads',
      value: resumeMeta ? formatNumber(resumeMeta.downloadCount) : '—',
      sub: resumeMeta ? resumeMeta.fileName : 'Total downloads',
      color: 'color-mix(in oklch, oklch(0.75 0.18 150) 15%, transparent)',
      href: '/admin/resume',
    },
    {
      icon: <FolderKanban className="h-5 w-5" style={{ color: 'oklch(0.75 0.18 60)' }} />,
      label: 'Content',
      value: contentUpdatedAt && contentUpdatedAt !== new Date(0).toISOString() ? 'Updated' : 'Default',
      sub: contentUpdatedAt && contentUpdatedAt !== new Date(0).toISOString()
        ? `Last edited ${timeAgo(contentUpdatedAt)}`
        : 'No custom edits yet',
      color: 'color-mix(in oklch, oklch(0.75 0.18 60) 15%, transparent)',
      href: '/admin/content',
    },
    {
      icon: <ShieldCheck className="h-5 w-5" style={{ color: 'oklch(0.75 0.18 320)' }} />,
      label: 'Active Sessions',
      value: securityStats ? securityStats.activeSessions : '—',
      sub: securityStats ? `${securityStats.failedAttempts} failed logins` : 'Security overview',
      color: 'color-mix(in oklch, oklch(0.75 0.18 320) 15%, transparent)',
      href: '/admin/security',
    },
    {
      icon: <GitBranch className="h-5 w-5" style={{ color: 'oklch(0.75 0.18 30)' }} />,
      label: 'Projects',
      value: '5',
      sub: 'Live on portfolio',
      color: 'color-mix(in oklch, oklch(0.75 0.18 30) 15%, transparent)',
      href: '/admin/content',
    },
  ]

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'message': return <MessageSquare className="h-3.5 w-3.5" style={{ color: 'oklch(0.75 0.18 220)' }} />
      case 'login': return <ShieldCheck className="h-3.5 w-3.5" style={{ color: 'oklch(0.75 0.18 320)' }} />
      case 'content': return <FolderKanban className="h-3.5 w-3.5" style={{ color: 'oklch(0.75 0.18 60)' }} />
      case 'resume': return <Download className="h-3.5 w-3.5" style={{ color: 'oklch(0.75 0.18 150)' }} />
    }
  }

  return (
    // data-theme drives all CSS vars — changing this string swaps the full theme
    <div
      data-theme={theme}
      className="admin-viewport-height flex overflow-hidden"
      style={{ background: 'var(--background)', color: 'var(--foreground)' }}
    >
      {/* ── Mobile sidebar overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ══════════════════════════════════════════════════════
          SIDEBAR — fixed height via parent admin-viewport-height overflow-hidden
          ══════════════════════════════════════════════════════ */}
      <aside
        className={`
          admin-sidebar-mobile fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r
          transition-transform duration-300
          lg:static lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      >
        {/* Sidebar header — icon.ico logo */}
        <div
          className="flex h-16 shrink-0 items-center gap-3 border-b px-5"
          style={{ borderColor: 'var(--border)' }}
        >
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg"
            style={{ background: 'color-mix(in oklch, var(--primary) 20%, transparent)' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.ico" alt="Logo" className="h-6 w-6 object-contain" />
          </div>
          <span className="text-sm font-semibold tracking-tight truncate">Admin Panel</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto shrink-0 rounded-lg p-1 lg:hidden"
            style={{ color: 'var(--muted-foreground)' }}
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav items — scrollable middle zone */}
        <nav className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1">
          {navItems.map(item => (
            <SideNavItem key={item.href} {...item} />
          ))}
        </nav>

        {/* Sidebar footer */}
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

      {/* ══════════════════════════════════════════════════════
          MAIN CONTENT
          ══════════════════════════════════════════════════════ */}
      <div className="flex flex-1 flex-col overflow-hidden">

        {/* Top nav bar */}
        <header
          className="flex h-16 shrink-0 items-center gap-3 border-b px-4 sm:px-6"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          {/* Hamburger (mobile) */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 transition-colors hover:bg-[var(--muted)] lg:hidden"
            style={{ color: 'var(--muted-foreground)' }}
            aria-label="Open sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm">
            <span style={{ color: 'var(--muted-foreground)' }}>Admin</span>
            <span style={{ color: 'var(--border)' }}>/</span>
            <span className="font-medium">Dashboard</span>
          </div>

          <div className="flex-1" />

          {/* ── Theme picker ── */}
          <div className="relative">
            <button
              onClick={() => setShowThemePicker(v => !v)}
              className="flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-medium transition-all duration-200"
              style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
              aria-label="Change theme"
            >
              <Palette className="h-3.5 w-3.5" />
              <span
                className="h-3 w-3 rounded-full"
                style={{ background: themes.find(t => t.id === theme)?.swatch ?? 'var(--primary)' }}
              />
              <span className="hidden sm:inline capitalize">{theme}</span>
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
                        background: t.id === theme
                          ? 'color-mix(in oklch, var(--primary) 15%, transparent)'
                          : 'transparent',
                        color: t.id === theme ? 'var(--primary)' : 'var(--muted-foreground)',
                      }}
                    >
                      <span
                        className="h-3 w-3 shrink-0 rounded-full border"
                        style={{
                          background: t.swatch,
                          borderColor: t.id === theme ? 'var(--primary)' : 'transparent',
                        }}
                      />
                      {t.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Admin email badge */}
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
            <span className="max-w-[160px] truncate">{adminEmail}</span>
          </div>

          {/* Logout */}
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

        {/* Scrollable page body */}
        <main className="admin-main-scroll flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 admin-content-safe-bottom">

          {/* Welcome banner */}
          <div
            className="mb-8 overflow-hidden rounded-2xl border p-6 sm:p-8"
            style={{
              background: 'color-mix(in oklch, var(--primary) 8%, var(--card))',
              borderColor: 'color-mix(in oklch, var(--primary) 25%, transparent)',
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="eyebrow mb-2">Welcome back</p>
                <h1 className="text-2xl font-bold sm:text-3xl">Admin Dashboard</h1>
                <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Signed in as{' '}
                  <span style={{ color: 'var(--primary)' }}>{adminEmail}</span>
                  {' '}· Session valid for 8 hours
                </p>
              </div>
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl overflow-hidden"
                style={{ background: 'color-mix(in oklch, var(--primary) 20%, transparent)' }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icon.ico" alt="Logo" className="h-10 w-10 object-contain" />
              </div>
            </div>
          </div>

          {/* Stat cards */}
          <section className="mb-8">
            <h2 className="eyebrow mb-4">Overview</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {stats.map(s => (
                <StatCard key={s.label} {...s} />
              ))}
            </div>
          </section>

          {/* Lower panels */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

            {/* Recent Activity */}
            <div
              className="rounded-2xl border p-6"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Recent Activity</h2>
                <Activity className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
              </div>
              {activityItems.length === 0 ? (
                <div
                  className="flex items-center gap-3 rounded-xl p-3 text-sm"
                  style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
                >
                  No activity yet — messages and events will appear here.
                </div>
              ) : (
                <div className="space-y-3">
                  {activityItems.map(item => (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 rounded-xl p-3 text-sm transition-colors hover:bg-[var(--muted)]"
                    >
                      <div className="mt-0.5">{getActivityIcon(item.type)}</div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{item.title}</p>
                        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{item.description}</p>
                      </div>
                      <span className="shrink-0 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        {timeAgo(item.timestamp)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div
              className="rounded-2xl border p-6"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <h2 className="mb-4 text-sm font-semibold">Quick Actions</h2>
              <div className="space-y-2">
                {[
                  { label: 'View Portfolio', icon: <ExternalLink className="h-4 w-4" />, href: '/', external: true },
                  { label: 'Contact Messages', icon: <MessageSquare className="h-4 w-4" />, href: '/admin/messages' },
                  { label: 'Edit Content', icon: <FolderKanban className="h-4 w-4" />, href: '/admin/content' },
                  { label: 'Manage Resume', icon: <Download className="h-4 w-4" />, href: '/admin/resume' },
                  { label: 'Security & Session', icon: <ShieldCheck className="h-4 w-4" />, href: '/admin/security' },
                ].map(action => (
                  <a
                    key={action.label}
                    href={action.href}
                    target={action.external ? '_blank' : undefined}
                    rel={action.external ? 'noopener noreferrer' : undefined}
                    className="flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-all duration-200"
                    style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                    onMouseEnter={e => {
                      const el = e.currentTarget
                      el.style.borderColor = 'var(--primary)'
                      el.style.background = 'color-mix(in oklch, var(--primary) 8%, transparent)'
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget
                      el.style.borderColor = 'var(--border)'
                      el.style.background = 'transparent'
                    }}
                  >
                    <span style={{ color: 'var(--primary)' }}>{action.icon}</span>
                    {action.label}
                    <ArrowUpRight className="ml-auto h-3.5 w-3.5" style={{ color: 'var(--muted-foreground)' }} />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}