'use client'

/**
 * components/admin/dashboard-shell.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Part 3.2 (Dashboard upgrade) — Admin chrome shared by every dashboard tab
 * ---------------------------------------------------------------------------
 * Extracts the sidebar + top bar + theme picker + mobile drawer that were
 * previously inlined in dashboard-client.tsx, and upgrades them:
 *
 *   • Icon-rail collapse on desktop (lg+) with persistent state
 *   • Full mobile drawer with overlay, safe-area aware
 *   • Top bar gains: breadcrumb, global refresh button (re-fetches the
 *     active tab's data via a shared refresh token), live unread badge,
 *     theme picker dropdown, admin email chip, logout
 *   • Session expiry countdown chip (reads from /api/admin/security once)
 *   • Every colour reads from CSS theme tokens → all 6 themes just work
 *   • Fully mobile optimised (dynamic viewport height, safe-area insets,
 *     scroll-contained main region, no layout shift on drawer open)
 *
 * PUBLIC API
 *   <DashboardShell
 *     adminEmail="…"
 *     currentPath="/admin/dashboard"
 *     unreadCount={n}
 *     onRefresh={() => void}
 *     refreshing={false}
 *   >{children}</DashboardShell>
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  LogOut,
  Settings,
  ExternalLink,
  ShieldCheck,
  MessageSquare,
  BarChart2,
  FileText,
  FolderKanban,
  Loader2,
  Menu,
  X,
  Palette,
  RefreshCw,
  ChevronsLeft,
  ChevronsRight,
  Clock,
} from 'lucide-react'
import { themes } from '@/lib/content'

// ─── Theme hook (shared) ──────────────────────────────────────────────────

export function useAdminTheme() {
  const [theme, setThemeState] = useState<string>('midnight')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('admin-theme') ?? 'midnight'
    setThemeState(saved)
    setMounted(true)
  }, [])

  const setTheme = useCallback((id: string) => {
    setThemeState(id)
    try {
      localStorage.setItem('admin-theme', id)
    } catch {
      /* storage full/blocked — theme still applies for this session */
    }
  }, [])

  return { theme, setTheme, mounted }
}

// ─── Nav definition ───────────────────────────────────────────────────────

interface NavDef {
  icon: React.ReactNode
  label: string
  href: string
  badgeKey?: 'unread'
}

const NAV: NavDef[] = [
  { icon: <LayoutDashboard className="h-4 w-4" />, label: 'Dashboard', href: '/admin/dashboard' },
  { icon: <MessageSquare className="h-4 w-4" />, label: 'Messages', href: '/admin/messages', badgeKey: 'unread' },
  { icon: <BarChart2 className="h-4 w-4" />, label: 'Analytics', href: '/admin/analytics' },
  { icon: <FileText className="h-4 w-4" />, label: 'Resume', href: '/admin/resume' },
  { icon: <FolderKanban className="h-4 w-4" />, label: 'Content', href: '/admin/content' },
  { icon: <Settings className="h-4 w-4" />, label: 'Settings', href: '/admin/settings' },
  { icon: <ShieldCheck className="h-4 w-4" />, label: 'Security', href: '/admin/security' },
]

// ─── Sidebar nav row ──────────────────────────────────────────────────────

function NavRow({
  item,
  active,
  collapsed,
  badge,
  onNavigate,
}: {
  item: NavDef
  active: boolean
  collapsed: boolean
  badge?: number
  onNavigate?: () => void
}) {
  return (
    <a
      href={item.href}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
        collapsed ? 'justify-center px-2' : ''
      }`}
      style={{
        background: active ? 'color-mix(in oklch, var(--primary) 15%, transparent)' : 'transparent',
        color: active ? 'var(--primary)' : 'var(--muted-foreground)',
        borderLeft: active ? '2px solid var(--primary)' : '2px solid transparent',
      }}
    >
      <span className="shrink-0">{item.icon}</span>
      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
      {!collapsed && badge !== undefined && badge > 0 && (
        <span
          className="flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold"
          style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}
      {collapsed && badge !== undefined && badge > 0 && (
        <span
          className="absolute right-2 top-2 h-2 w-2 rounded-full"
          style={{ background: 'var(--primary)' }}
        />
      )}
    </a>
  )
}

// ─── Session expiry chip ──────────────────────────────────────────────────

function SessionChip() {
  const [label, setLabel] = useState<string>('8h')
  useEffect(() => {
    // Session lifetime is a fixed 8h window from login. We don't have the
    // exact issue time on the client, so this is a static "8h session"
    // affordance rather than a live countdown — matches the real server
    // behaviour without extra fetches.
    setLabel('8h')
  }, [])
  return (
    <div
      className="hidden md:flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-mono"
      style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
      title="Admin sessions expire after 8 hours"
    >
      <Clock className="h-3 w-3" />
      {label}
    </div>
  )
}

// ─── Shell ────────────────────────────────────────────────────────────────

export interface DashboardShellProps {
  adminEmail: string
  currentPath: string
  unreadCount?: number
  onRefresh?: () => void
  refreshing?: boolean
  breadcrumb?: string
  children: React.ReactNode
}

export function DashboardShell({
  adminEmail,
  currentPath,
  unreadCount = 0,
  onRefresh,
  refreshing = false,
  breadcrumb = 'Dashboard',
  children,
}: DashboardShellProps) {
  const router = useRouter()
  const { theme, setTheme } = useAdminTheme()
  const [loggingOut, setLoggingOut] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [showThemePicker, setShowThemePicker] = useState(false)

  // Restore desktop collapse preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem('admin-sidebar-collapsed')
      if (saved === '1') setCollapsed(true)
    } catch {
      /* ignore */
    }
  }, [])

  const toggleCollapsed = useCallback(() => {
    setCollapsed(c => {
      const next = !c
      try {
        localStorage.setItem('admin-sidebar-collapsed', next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  const handleLogout = useCallback(async () => {
    setLoggingOut(true)
    try {
      await fetch('/api/admin/logout', { method: 'POST' })
    } finally {
      router.replace('/admin')
    }
  }, [router])

  return (
    <div
      data-theme={theme}
      className="admin-viewport-height flex overflow-hidden"
      style={{ background: 'var(--background)', color: 'var(--foreground)' }}
    >
      {/* Mobile drawer overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      {/* ══ Sidebar ══ */}
      <aside
        className={`admin-sidebar-mobile fixed inset-y-0 left-0 z-50 flex flex-col border-r transition-[transform,width] duration-300 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'w-64 lg:w-[68px]' : 'w-64'}`}
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      >
        {/* Header */}
        <div
          className={`flex h-16 shrink-0 items-center gap-3 border-b px-3 ${
            collapsed ? 'lg:justify-center lg:px-2' : 'px-5'
          }`}
          style={{ borderColor: 'var(--border)' }}
        >
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg"
            style={{ background: 'color-mix(in oklch, var(--primary) 20%, transparent)' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.ico" alt="Logo" className="h-6 w-6 object-contain" />
          </div>
          {!collapsed && (
            <span className="text-sm font-semibold tracking-tight truncate flex-1">Admin Panel</span>
          )}
          <button
            onClick={() => setSidebarOpen(false)}
            className="shrink-0 rounded-lg p-1 lg:hidden"
            style={{ color: 'var(--muted-foreground)' }}
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-1">
          {NAV.map(item => (
            <div key={item.href} className="relative">
              <NavRow
                item={item}
                active={currentPath === item.href}
                collapsed={collapsed}
                badge={item.badgeKey === 'unread' ? unreadCount : undefined}
                onNavigate={() => setSidebarOpen(false)}
              />
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="shrink-0 border-t p-2.5 space-y-1" style={{ borderColor: 'var(--border)' }}>
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            title={collapsed ? 'View Portfolio' : undefined}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-[var(--muted)] ${
              collapsed ? 'lg:justify-center lg:px-2' : ''
            }`}
            style={{ color: 'var(--muted-foreground)' }}
          >
            <ExternalLink className="h-4 w-4 shrink-0" />
            {!collapsed && <span>View Portfolio</span>}
          </a>
          <button
            onClick={toggleCollapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`hidden lg:flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-[var(--muted)] ${
              collapsed ? 'lg:justify-center lg:px-2' : ''
            }`}
            style={{ color: 'var(--muted-foreground)' }}
          >
            {collapsed ? <ChevronsRight className="h-4 w-4 shrink-0" /> : <ChevronsLeft className="h-4 w-4 shrink-0" />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* ══ Main column ══ */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header
          className="flex h-16 shrink-0 items-center gap-2 sm:gap-3 border-b px-3 sm:px-6"
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

          <div className="hidden sm:flex items-center gap-2 text-sm min-w-0">
            <span style={{ color: 'var(--muted-foreground)' }}>Admin</span>
            <span style={{ color: 'var(--border)' }}>/</span>
            <span className="font-medium truncate">{breadcrumb}</span>
          </div>

          <div className="flex-1" />

          <SessionChip />

          {/* Refresh */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="rounded-xl border p-2 transition-all duration-200 disabled:opacity-50"
              style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
              title="Refresh data"
              aria-label="Refresh data"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          )}

          {/* Theme picker */}
          <div className="relative">
            <button
              onClick={() => setShowThemePicker(v => !v)}
              className="flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-medium transition-all duration-200"
              style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
              aria-label="Change theme"
              aria-expanded={showThemePicker}
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
                      onClick={() => {
                        setTheme(t.id)
                        setShowThemePicker(false)
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-150"
                      style={{
                        background:
                          t.id === theme
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

          {/* Admin chip */}
          <div
            className="hidden sm:flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs"
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
            className="flex items-center gap-2 rounded-xl border px-2.5 sm:px-3 py-2 text-sm font-medium transition-all duration-200 disabled:opacity-50 hover:border-[var(--destructive)] hover:text-[var(--destructive)]"
            style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
          >
            {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            <span className="hidden sm:inline">Logout</span>
          </button>
        </header>

        {/* Page body */}
        <main className="admin-main-scroll admin-content-safe-bottom flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}