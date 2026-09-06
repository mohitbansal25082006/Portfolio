'use client'

/**
 * app/admin/security/security-client.tsx
 *
 * Part 2.6 — Security & Session
 * ---------------------------------------------------------------------------
 * Four features, each its own panel:
 *   1. Active Sessions   — lists this admin's tracked sessions (IP, login
 *      time, last-seen time, device/browser parsed from user agent),
 *      current session flagged.
 *   2. Force Logout All  — single confirm-gated action that revokes every
 *      session for this admin (including the one making the request) and
 *      redirects to the login page.
 *   3. Change Password   — current + new + confirm fields, writes a runtime
 *      override (lib/admin-security.ts) so the change takes effect without
 *      touching .env or redeploying.
 *   4. Login Attempt Log — table of recent login attempts (success/fail)
 *      across all configured admins, with IP + timestamp, failures
 *      highlighted, filterable to failed-only.
 *
 * Follows the exact same shell as every other admin page since Part 2.1:
 * useAdminTheme (localStorage 'admin-theme'), CSS-var-only styling so all
 * 6 themes apply, identical sidebar/header markup, canonical 8-item nav
 * list (this page adds "Security" as the 8th item, placed after Settings).
 * ---------------------------------------------------------------------------
 */

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard, LogOut, Mail, Users, FileText, Settings as SettingsIcon,
  ExternalLink, TrendingUp, MessageSquare, Loader2, Menu, X, Palette,
  BarChart2, AlertTriangle, Check, ShieldCheck, KeyRound, Monitor,
  Smartphone, LogOutIcon, Clock, Globe2, ChevronDown, Eye, EyeOff,
  CheckCircle2, XCircle, ListChecks,
} from 'lucide-react'
import { themes } from '@/lib/content'
import type { ActiveSession, LoginAttempt } from '@/lib/admin-security'

// ─── Theme hook (identical to every other admin client) ──────────────────────

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

// ─── Sidebar nav item (identical shape) ──────────────────────────────────────

interface NavItem {
  icon: React.ReactNode
  label: string
  href: string
  active?: boolean
  badge?: number
}

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

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
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

/** Very small UA parse — just enough to show a friendly device label. */
function parseDevice(ua: string): { label: string; icon: React.ReactNode } {
  const lower = ua.toLowerCase()
  const isMobile = /mobile|android|iphone/.test(lower)
  const browser = lower.includes('edg/') ? 'Edge'
    : lower.includes('chrome') ? 'Chrome'
    : lower.includes('firefox') ? 'Firefox'
    : lower.includes('safari') ? 'Safari'
    : 'Browser'
  const os = lower.includes('windows') ? 'Windows'
    : lower.includes('mac os') ? 'macOS'
    : lower.includes('android') ? 'Android'
    : lower.includes('iphone') || lower.includes('ipad') ? 'iOS'
    : lower.includes('linux') ? 'Linux'
    : ''
  return {
    label: `${browser}${os ? ' · ' + os : ''}`,
    icon: isMobile
      ? <Smartphone className="h-4 w-4" />
      : <Monitor className="h-4 w-4" />,
  }
}

// ─── Section card wrapper (matches settings-client.tsx pattern) ─────────────

function SecuritySection({
  title,
  description,
  icon,
  children,
}: {
  title: string
  description: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div
      className="rounded-2xl border p-6"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
    >
      <div className="mb-5 flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: 'color-mix(in oklch, var(--primary) 15%, transparent)', color: 'var(--primary)' }}
        >
          {icon}
        </div>
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>{description}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'var(--background)',
  borderColor: 'var(--border)',
  color: 'var(--foreground)',
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function SecurityClient({ adminEmail }: { adminEmail: string }) {
  const router = useRouter()
  const { theme, setTheme } = useAdminTheme()
  const [loggingOut, setLoggingOut] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showThemePicker, setShowThemePicker] = useState(false)
  const [msgStats, setMsgStats] = useState<{ total: number; unread: number } | null>(null)

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [sessions, setSessions] = useState<ActiveSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [loginAttempts, setLoginAttempts] = useState<LoginAttempt[]>([])
  const [redisConfigured, setRedisConfigured] = useState(true)
  const [attemptFilter, setAttemptFilter] = useState<'all' | 'failed'>('all')

  // Force logout all
  const [confirmingLogoutAll, setConfirmingLogoutAll] = useState(false)
  const [loggingOutAll, setLoggingOutAll] = useState(false)
  const [logoutAllError, setLogoutAllError] = useState<string | null>(null)

  // Change password
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  useEffect(() => {
    fetch('/api/admin/messages?filter=all')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.stats) setMsgStats(d.stats) })
      .catch(() => {})
  }, [])

  const loadSecurity = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch('/api/admin/security', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load security data')
      const data = await res.json()
      setSessions(data.sessions ?? [])
      setCurrentSessionId(data.currentSessionId ?? null)
      setLoginAttempts(data.loginAttempts ?? [])
      setRedisConfigured(data.storage?.redisConfigured ?? true)
    } catch {
      setLoadError('Could not load session and security data. Please refresh the page.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadSecurity() }, [loadSecurity])

  const handleLogout = useCallback(async () => {
    setLoggingOut(true)
    try {
      await fetch('/api/admin/logout', { method: 'POST' })
    } finally {
      router.replace('/admin')
    }
  }, [router])

  const handleLogoutAll = async () => {
    setLoggingOutAll(true)
    setLogoutAllError(null)
    try {
      const res = await fetch('/api/admin/security', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setLogoutAllError(data.error || 'Failed to revoke sessions. Please try again.')
        setLoggingOutAll(false)
        return
      }
      // Own session was revoked too — go to login.
      router.replace('/admin')
    } catch {
      setLogoutAllError('Network error — please try again.')
      setLoggingOutAll(false)
    }
  }

  const handleChangePassword = async () => {
    setPasswordError(null)
    setPasswordSuccess(false)

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All fields are required.')
      return
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.')
      return
    }
    if (newPassword === currentPassword) {
      setPasswordError('New password must be different from the current password.')
      return
    }

    setChangingPassword(true)
    try {
      const res = await fetch('/api/admin/security', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setPasswordError(data.error || 'Failed to change password.')
        return
      }
      setPasswordSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPasswordSuccess(false), 4000)
    } catch {
      setPasswordError('Network error — please try again.')
    } finally {
      setChangingPassword(false)
    }
  }

  // Canonical nav list — Security added as the 8th item, after Settings.
  const navItems: NavItem[] = [
    { icon: <LayoutDashboard className="h-4 w-4" />, label: 'Dashboard', href: '/admin/dashboard' },
    { icon: <MessageSquare className="h-4 w-4" />, label: 'Messages', href: '/admin/messages', badge: msgStats?.unread ?? 0 },
    { icon: <BarChart2 className="h-4 w-4" />, label: 'Analytics', href: '/admin/analytics' },
    { icon: <FileText className="h-4 w-4" />, label: 'Resume', href: '/admin/resume' },
    { icon: <FileText className="h-4 w-4" />, label: 'Content', href: '/admin/content' },
    { icon: <Users className="h-4 w-4" />, label: 'Visitors', href: '/admin/visitors' },
    { icon: <SettingsIcon className="h-4 w-4" />, label: 'Settings', href: '/admin/settings' },
    { icon: <ShieldCheck className="h-4 w-4" />, label: 'Security', href: '/admin/security', active: true },
  ]

  const filteredAttempts = attemptFilter === 'failed'
    ? loginAttempts.filter(a => !a.success)
    : loginAttempts
  const failedCount = loginAttempts.filter(a => !a.success).length

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
        className={`
          fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r
          transition-transform duration-300
          lg:static lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
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

        <nav className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1">
          {navItems.map(item => (
            <SideNavItem key={item.href} {...item} />
          ))}
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

      {/* ── Main content ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header
          className="flex h-16 shrink-0 items-center gap-3 border-b px-4 sm:px-6"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 transition-colors hover:bg-[var(--muted)] lg:hidden"
            style={{ color: 'var(--muted-foreground)' }}
            aria-label="Open sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2 text-sm">
            <span style={{ color: 'var(--muted-foreground)' }}>Admin</span>
            <span style={{ color: 'var(--border)' }}>/</span>
            <span className="font-medium">Security</span>
          </div>

          <div className="flex-1" />

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
          <div className="mb-8">
            <p className="eyebrow mb-2">Account Protection</p>
            <h1 className="text-2xl font-bold sm:text-3xl">Security &amp; Session</h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
              Review active sessions, sign out of other devices, change your password, and check recent login attempts.
            </p>
          </div>

          {!redisConfigured && (
            <div
              className="mb-6 flex items-start gap-3 rounded-2xl border p-4"
              style={{ background: 'color-mix(in oklch, oklch(0.75 0.18 60) 12%, transparent)', borderColor: 'color-mix(in oklch, oklch(0.75 0.18 60) 35%, transparent)' }}
            >
              <AlertTriangle className="h-5 w-5 shrink-0" style={{ color: 'oklch(0.75 0.18 60)' }} />
              <div className="text-sm">
                <p className="font-medium">Security data isn&apos;t persistent</p>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  No Upstash Redis (Vercel KV) connection was detected, so sessions, login attempts, and password changes are only saved to a local file and won&apos;t survive a redeploy. Connect a KV store to persist this in production.
                </p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--muted-foreground)' }} />
            </div>
          ) : loadError ? (
            <div
              className="rounded-2xl border p-6 text-sm"
              style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--destructive)' }}
            >
              {loadError}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

              {/* ── Active Sessions ── */}
              <SecuritySection
                title="Active Sessions"
                description="Devices currently signed in to your admin account."
                icon={<Monitor className="h-5 w-5" />}
              >
                <div className="space-y-2">
                  {sessions.length === 0 ? (
                    <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                      No active sessions found.
                    </p>
                  ) : (
                    sessions.map(s => {
                      const device = parseDevice(s.userAgent)
                      const isCurrent = s.id === currentSessionId
                      return (
                        <div
                          key={s.id}
                          className="flex items-start gap-3 rounded-xl border p-3"
                          style={{
                            borderColor: isCurrent ? 'color-mix(in oklch, var(--primary) 40%, transparent)' : 'var(--border)',
                            background: isCurrent ? 'color-mix(in oklch, var(--primary) 6%, transparent)' : 'transparent',
                          }}
                        >
                          <div
                            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                            style={{ background: 'color-mix(in oklch, var(--primary) 12%, transparent)', color: 'var(--primary)' }}
                          >
                            {device.icon}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-medium">{device.label}</p>
                              {isCurrent && (
                                <span
                                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                                  style={{ background: 'color-mix(in oklch, var(--primary) 20%, transparent)', color: 'var(--primary)' }}
                                >
                                  This device
                                </span>
                              )}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                              <span className="flex items-center gap-1">
                                <Globe2 className="h-3 w-3" /> {s.ip}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" /> Signed in {formatDateTime(s.createdAt)}
                              </span>
                              <span>Last seen {timeAgo(s.lastSeenAt)}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </SecuritySection>

              {/* ── Force Logout All ── */}
              <SecuritySection
                title="Force Logout"
                description="Immediately sign out of every device, including this one."
                icon={<LogOutIcon className="h-5 w-5" />}
              >
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Use this if you suspect unauthorised access, or after changing your password on a device you no longer trust. You&apos;ll need to sign in again afterwards.
                </p>

                {logoutAllError && (
                  <p
                    className="mt-4 rounded-lg px-3 py-2 text-xs"
                    style={{ background: 'color-mix(in oklch, var(--destructive) 15%, transparent)', color: 'var(--destructive)' }}
                  >
                    {logoutAllError}
                  </p>
                )}

                <div className="mt-5 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
                  {!confirmingLogoutAll ? (
                    <button
                      onClick={() => setConfirmingLogoutAll(true)}
                      className="flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-all duration-200 hover:border-[var(--destructive)] hover:text-[var(--destructive)]"
                      style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                    >
                      <LogOutIcon className="h-4 w-4" />
                      Log out all sessions
                    </button>
                  ) : (
                    <div
                      className="flex flex-wrap items-center gap-3 rounded-xl border p-3"
                      style={{ borderColor: 'color-mix(in oklch, var(--destructive) 35%, transparent)', background: 'color-mix(in oklch, var(--destructive) 8%, transparent)' }}
                    >
                      <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: 'var(--destructive)' }} />
                      <p className="text-xs" style={{ color: 'var(--foreground)' }}>
                        This will sign you out everywhere, including here. Continue?
                      </p>
                      <div className="ml-auto flex gap-2">
                        <button
                          onClick={handleLogoutAll}
                          disabled={loggingOutAll}
                          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-60"
                          style={{ background: 'var(--destructive)', color: 'white' }}
                        >
                          {loggingOutAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                          Yes, log out all
                        </button>
                        <button
                          onClick={() => setConfirmingLogoutAll(false)}
                          disabled={loggingOutAll}
                          className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-all"
                          style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </SecuritySection>

              {/* ── Change Password ── */}
              <SecuritySection
                title="Change Password"
                description="Update your admin password without editing environment variables."
                icon={<KeyRound className="h-5 w-5" />}
              >
                <div className="space-y-4">
                  <label className="block">
                    <span className="text-xs font-medium">Current password</span>
                    <div className="relative mt-1.5">
                      <input
                        type={showCurrent ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={e => setCurrentPassword(e.target.value)}
                        autoComplete="current-password"
                        className="w-full rounded-xl border px-3 py-2 pr-10 text-sm outline-none focus:border-[var(--primary)]"
                        style={inputStyle}
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrent(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                        style={{ color: 'var(--muted-foreground)' }}
                        tabIndex={-1}
                        aria-label={showCurrent ? 'Hide password' : 'Show password'}
                      >
                        {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </label>

                  <label className="block">
                    <span className="text-xs font-medium">New password</span>
                    <div className="relative mt-1.5">
                      <input
                        type={showNew ? 'text' : 'password'}
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        autoComplete="new-password"
                        className="w-full rounded-xl border px-3 py-2 pr-10 text-sm outline-none focus:border-[var(--primary)]"
                        style={inputStyle}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNew(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                        style={{ color: 'var(--muted-foreground)' }}
                        tabIndex={-1}
                        aria-label={showNew ? 'Hide password' : 'Show password'}
                      >
                        {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <span className="mt-1 block text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                      At least 8 characters.
                    </span>
                  </label>

                  <label className="block">
                    <span className="text-xs font-medium">Confirm new password</span>
                    <input
                      type={showNew ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      className="mt-1.5 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                      style={inputStyle}
                    />
                  </label>
                </div>

                {passwordError && (
                  <p
                    className="mt-4 rounded-lg px-3 py-2 text-xs"
                    style={{ background: 'color-mix(in oklch, var(--destructive) 15%, transparent)', color: 'var(--destructive)' }}
                  >
                    {passwordError}
                  </p>
                )}

                <div className="mt-5 flex items-center gap-3 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
                  <button
                    onClick={handleChangePassword}
                    disabled={changingPassword}
                    className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 disabled:opacity-60"
                    style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
                  >
                    {changingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                    {changingPassword ? 'Updating…' : 'Update password'}
                  </button>
                  {passwordSuccess && (
                    <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'oklch(0.75 0.18 150)' }}>
                      <Check className="h-3.5 w-3.5" /> Password updated
                    </span>
                  )}
                </div>
              </SecuritySection>

              {/* ── Login Attempt Log ── */}
              <SecuritySection
                title="Login Attempts"
                description="Recent sign-in attempts across all admin accounts."
                icon={<ListChecks className="h-5 w-5" />}
              >
                <div className="mb-3 flex items-center gap-2">
                  {(['all', 'failed'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setAttemptFilter(f)}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
                      style={{
                        background: attemptFilter === f
                          ? 'color-mix(in oklch, var(--primary) 15%, transparent)'
                          : 'var(--muted)',
                        color: attemptFilter === f ? 'var(--primary)' : 'var(--muted-foreground)',
                      }}
                    >
                      {f === 'all' ? `All (${loginAttempts.length})` : `Failed (${failedCount})`}
                    </button>
                  ))}
                </div>

                <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
                  {filteredAttempts.length === 0 ? (
                    <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                      No {attemptFilter === 'failed' ? 'failed ' : ''}login attempts recorded yet.
                    </p>
                  ) : (
                    filteredAttempts.map(a => (
                      <div
                        key={a.id}
                        className="flex items-center gap-3 rounded-lg border px-3 py-2 text-xs"
                        style={{
                          borderColor: a.success
                            ? 'var(--border)'
                            : 'color-mix(in oklch, var(--destructive) 30%, transparent)',
                          background: a.success
                            ? 'transparent'
                            : 'color-mix(in oklch, var(--destructive) 6%, transparent)',
                        }}
                      >
                        {a.success
                          ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: 'oklch(0.75 0.18 150)' }} />
                          : <XCircle className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--destructive)' }} />}
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium" style={{ color: 'var(--foreground)' }}>{a.email}</p>
                          <p style={{ color: 'var(--muted-foreground)' }}>
                            {a.ip} · {formatDateTime(a.timestamp)}
                          </p>
                        </div>
                        <span
                          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{
                            background: a.success
                              ? 'color-mix(in oklch, oklch(0.75 0.18 150) 15%, transparent)'
                              : 'color-mix(in oklch, var(--destructive) 15%, transparent)',
                            color: a.success ? 'oklch(0.75 0.18 150)' : 'var(--destructive)',
                          }}
                        >
                          {a.success ? 'Success' : 'Failed'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </SecuritySection>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}