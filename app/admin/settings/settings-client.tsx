'use client'

/**
 * app/admin/settings/settings-client.tsx
 *
 * Part 2.5 — Site Settings
 * Part 2.7 update: removed "Visitors" nav item, added "Content" with
 * FolderKanban icon. Canonical nav list now spans Dashboard, Messages,
 * Analytics, Resume, Content, Settings, Security.
 * ---------------------------------------------------------------------------
 */

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard, LogOut, Mail, FileText, Settings as SettingsIcon,
  ExternalLink, TrendingUp, MessageSquare, Loader2, Menu, X, Palette,
  BarChart2, AlertTriangle, Check, Power, Code2,
  Save, RotateCcw, ShieldCheck, FolderKanban,
} from 'lucide-react'
import { themes } from '@/lib/content'
import type { SiteSettings } from '@/lib/settings'

// ─── Custom brand icons ───────────────────────────────────────────────────────
const GithubIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2c-3.2.7-3.88-1.54-3.88-1.54-.53-1.34-1.3-1.7-1.3-1.7-1.06-.72.08-.71.08-.71 1.17.08 1.79 1.2 1.79 1.2 1.04 1.79 2.73 1.27 3.4.97.11-.75.41-1.27.74-1.56-2.55-.29-5.23-1.28-5.23-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.43-2.69 5.41-5.25 5.69.42.36.79 1.08.79 2.18v3.23c0 .31.21.68.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
  </svg>
)

const LinkedinIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.8 0 0 .77 0 1.72v20.56C0 23.23.8 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
  </svg>
)

const TwitterIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
)

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

// ─── Sidebar nav item ─────────────────────────────────────────────────────────

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

// ─── Toggle Switch ────────────────────────────────────────────────────────────

const SWITCH_TRACK_WIDTH = 44
const SWITCH_TRACK_HEIGHT = 24
const SWITCH_THUMB_SIZE = 18
const SWITCH_THUMB_INSET = 3
const SWITCH_THUMB_TOP = (SWITCH_TRACK_HEIGHT - SWITCH_THUMB_SIZE) / 2
const SWITCH_THUMB_TRAVEL = SWITCH_TRACK_WIDTH - SWITCH_THUMB_SIZE - SWITCH_THUMB_INSET * 2

function ToggleSwitch({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean
  onChange: () => void
  ariaLabel?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={onChange}
      className="relative shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      style={{
        width: SWITCH_TRACK_WIDTH,
        height: SWITCH_TRACK_HEIGHT,
        padding: 0,
        boxSizing: 'border-box',
        overflow: 'hidden',
        display: 'inline-block',
        background: checked ? 'var(--primary)' : 'var(--muted)',
        // @ts-expect-error -- custom properties for tailwind ring utilities
        '--tw-ring-color': 'var(--primary)',
        '--tw-ring-offset-color': 'var(--card)',
      }}
    >
      <span
        aria-hidden="true"
        className="absolute rounded-full bg-white shadow transition-transform duration-200"
        style={{
          left: SWITCH_THUMB_INSET,
          top: SWITCH_THUMB_TOP,
          width: SWITCH_THUMB_SIZE,
          height: SWITCH_THUMB_SIZE,
          boxSizing: 'border-box',
          transform: checked ? `translateX(${SWITCH_THUMB_TRAVEL}px)` : 'translateX(0px)',
        }}
      />
    </button>
  )
}

// ─── Reusable section card ────────────────────────────────────────────────────

function SettingsSection({
  title,
  description,
  icon,
  children,
  onSave,
  saving,
  saved,
  error,
}: {
  title: string
  description: string
  icon: React.ReactNode
  children: React.ReactNode
  onSave: () => void
  saving: boolean
  saved: boolean
  error: string | null
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

      <div className="space-y-4">{children}</div>

      {error && (
        <p
          className="mt-4 rounded-lg px-3 py-2 text-xs"
          style={{ background: 'color-mix(in oklch, var(--destructive) 15%, transparent)', color: 'var(--destructive)' }}
        >
          {error}
        </p>
      )}

      <div className="mt-5 flex items-center gap-3 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 disabled:opacity-60"
          style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Saving...' : 'Save changes'}
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'oklch(0.75 0.18 150)' }}>
            <Check className="h-3.5 w-3.5" /> Saved
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Input field ──────────────────────────────────────────────────────────────

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>{label}</span>
      {children}
      {hint && (
        <span className="mt-1 block text-[11px]" style={{ color: 'var(--muted-foreground)' }}>{hint}</span>
      )}
    </label>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'var(--background)',
  borderColor: 'var(--border)',
  color: 'var(--foreground)',
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SettingsClient() {
  const router = useRouter()
  const { theme, setTheme } = useAdminTheme()
  const [loggingOut, setLoggingOut] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showThemePicker, setShowThemePicker] = useState(false)
  const [msgStats, setMsgStats] = useState<{ total: number; unread: number } | null>(null)

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [settings, setSettings] = useState<SiteSettings | null>(null)
  const [redisConfigured, setRedisConfigured] = useState(true)

  // Local form state, split per section so each can save independently.
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [maintenanceMessage, setMaintenanceMessage] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [availabilityStatus, setAvailabilityStatus] = useState('')
  const [social, setSocial] = useState({ github: '', linkedin: '', email: '', twitter: '', leetcode: '' })

  // Per-section save state
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string | null>>({})

  useEffect(() => {
    fetch('/api/admin/messages?filter=all')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.stats) setMsgStats(d.stats) })
      .catch(() => {})
  }, [])

  const loadSettings = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch('/api/admin/settings', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load settings')
      const data = await res.json()
      setSettings(data.settings)
      setRedisConfigured(data.storage?.redisConfigured ?? true)
      setMaintenanceMode(data.settings.maintenanceMode)
      setMaintenanceMessage(data.settings.maintenanceMessage)
      setContactEmail(data.settings.contactEmail)
      setAvailabilityStatus(data.settings.availabilityStatus)
      setSocial({
        github: data.settings.socialLinks.github ?? '',
        linkedin: data.settings.socialLinks.linkedin ?? '',
        email: (data.settings.socialLinks.email ?? '').replace(/^mailto:/, ''),
        twitter: data.settings.socialLinks.twitter ?? '',
        leetcode: data.settings.socialLinks.leetcode ?? '',
      })
    } catch (err) {
      setLoadError('Could not load site settings. Please refresh the page.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadSettings() }, [loadSettings])

  const handleLogout = useCallback(async () => {
    setLoggingOut(true)
    try {
      await fetch('/api/admin/logout', { method: 'POST' })
    } finally {
      router.replace('/admin')
    }
  }, [router])

  const save = async (section: string, patch: Partial<SiteSettings>) => {
    setSaving(s => ({ ...s, [section]: true }))
    setSaved(s => ({ ...s, [section]: false }))
    setErrors(e => ({ ...e, [section]: null }))
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErrors(e => ({ ...e, [section]: data.error || 'Failed to save. Please try again.' }))
        return
      }
      setSettings(data.settings)
      setSaved(s => ({ ...s, [section]: true }))
      setTimeout(() => setSaved(s => ({ ...s, [section]: false })), 2500)
    } catch {
      setErrors(e => ({ ...e, [section]: 'Network error — please try again.' }))
    } finally {
      setSaving(s => ({ ...s, [section]: false }))
    }
  }

  // Canonical nav list — Visitors removed in Part 2.7
  const navItems: NavItem[] = [
    { icon: <LayoutDashboard className="h-4 w-4" />, label: 'Dashboard', href: '/admin/dashboard' },
    { icon: <MessageSquare className="h-4 w-4" />, label: 'Messages', href: '/admin/messages', badge: msgStats?.unread ?? 0 },
    { icon: <BarChart2 className="h-4 w-4" />, label: 'Analytics', href: '/admin/analytics' },
    { icon: <FileText className="h-4 w-4" />, label: 'Resume', href: '/admin/resume' },
    { icon: <FolderKanban className="h-4 w-4" />, label: 'Content', href: '/admin/content' },
    { icon: <SettingsIcon className="h-4 w-4" />, label: 'Settings', href: '/admin/settings', active: true },
    { icon: <ShieldCheck className="h-4 w-4" />, label: 'Security', href: '/admin/security' },
  ]

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

        {/* Nav items — scrollable middle zone */}
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
            <span className="font-medium">Settings</span>
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
            <p className="eyebrow mb-2">Site Configuration</p>
            <h1 className="text-2xl font-bold sm:text-3xl">Site Settings</h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
              Control site availability, contact details, and social links shown on the live portfolio.
            </p>
          </div>

          {!redisConfigured && (
            <div
              className="mb-6 flex items-start gap-3 rounded-2xl border p-4"
              style={{ background: 'color-mix(in oklch, oklch(0.75 0.18 60) 12%, transparent)', borderColor: 'color-mix(in oklch, oklch(0.75 0.18 60) 35%, transparent)' }}
            >
              <AlertTriangle className="h-5 w-5 shrink-0" style={{ color: 'oklch(0.75 0.18 60)' }} />
              <div className="text-sm">
                <p className="font-medium">Settings storage isn&apos;t persistent</p>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  No Upstash Redis (Vercel KV) connection was detected, so changes are only saved to a local file and won&apos;t survive a redeploy. Connect a KV store to persist settings in production.
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

              {/* ── Maintenance Mode ── */}
              <SettingsSection
                title="Maintenance Mode"
                description="Temporarily show a maintenance banner on the live site."
                icon={<Power className="h-5 w-5" />}
                onSave={() => save('maintenance', { maintenanceMode, maintenanceMessage })}
                saving={!!saving.maintenance}
                saved={!!saved.maintenance}
                error={errors.maintenance ?? null}
              >
                <div
                  className="flex items-center justify-between rounded-xl border p-3"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div>
                    <p className="text-sm font-medium">Site availability</p>
                    <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      {maintenanceMode ? 'Maintenance banner is visible to visitors' : 'Site is fully available'}
                    </p>
                  </div>
                  <ToggleSwitch
                    checked={maintenanceMode}
                    onChange={() => setMaintenanceMode(v => !v)}
                    ariaLabel="Toggle maintenance mode"
                  />
                </div>

                <Field label="Banner message" hint="Shown to visitors while maintenance mode is on.">
                  <textarea
                    value={maintenanceMessage}
                    onChange={e => setMaintenanceMessage(e.target.value)}
                    rows={3}
                    maxLength={300}
                    className="mt-1.5 w-full rounded-xl border px-3 py-2 text-sm outline-none resize-none focus:border-[var(--primary)]"
                    style={inputStyle}
                  />
                </Field>
              </SettingsSection>

              {/* ── Contact Email ── */}
              <SettingsSection
                title="Contact Email"
                description="The email address shown across the public site."
                icon={<Mail className="h-5 w-5" />}
                onSave={() => save('contact', { contactEmail })}
                saving={!!saving.contact}
                saved={!!saved.contact}
                error={errors.contact ?? null}
              >
                <Field label="Contact email">
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={e => setContactEmail(e.target.value)}
                    placeholder="you@email.com"
                    className="mt-1.5 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                    style={inputStyle}
                  />
                </Field>
              </SettingsSection>

              {/* ── Availability Status ── */}
              <SettingsSection
                title="Availability Status"
                description='The short status line shown in the hero (e.g. "Open to Internships").'
                icon={<TrendingUp className="h-5 w-5" />}
                onSave={() => save('availability', { availabilityStatus })}
                saving={!!saving.availability}
                saved={!!saved.availability}
                error={errors.availability ?? null}
              >
                <Field label="Status text" hint={`${availabilityStatus.length}/80 characters`}>
                  <input
                    type="text"
                    value={availabilityStatus}
                    onChange={e => setAvailabilityStatus(e.target.value.slice(0, 80))}
                    placeholder="Open to Internships & Collaborations"
                    className="mt-1.5 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                    style={inputStyle}
                  />
                </Field>
              </SettingsSection>

              {/* ── Social Links ── */}
              <SettingsSection
                title="Social Links"
                description="Links shown in the hero, contact section, and footer."
                icon={<GithubIcon className="h-5 w-5" />}
                onSave={() => save('social', {
                  socialLinks: {
                    github: social.github,
                    linkedin: social.linkedin,
                    email: social.email,
                    twitter: social.twitter,
                    leetcode: social.leetcode,
                  },
                })}
                saving={!!saving.social}
                saved={!!saved.social}
                error={errors.social ?? null}
              >
                <Field label="GitHub">
                  <div className="mt-1.5 flex items-center gap-2">
                    <GithubIcon className="h-4 w-4 shrink-0" style={{ color: 'var(--muted-foreground)' }} />
                    <input
                      type="url"
                      value={social.github}
                      onChange={e => setSocial(s => ({ ...s, github: e.target.value }))}
                      placeholder="https://github.com/username"
                      className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                      style={inputStyle}
                    />
                  </div>
                </Field>
                <Field label="LinkedIn">
                  <div className="mt-1.5 flex items-center gap-2">
                    <LinkedinIcon className="h-4 w-4 shrink-0" style={{ color: 'var(--muted-foreground)' }} />
                    <input
                      type="url"
                      value={social.linkedin}
                      onChange={e => setSocial(s => ({ ...s, linkedin: e.target.value }))}
                      placeholder="https://linkedin.com/in/username"
                      className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                      style={inputStyle}
                    />
                  </div>
                </Field>
                <Field label="Email (social icon link)" hint="Just the address — the mailto: prefix is added automatically.">
                  <div className="mt-1.5 flex items-center gap-2">
                    <Mail className="h-4 w-4 shrink-0" style={{ color: 'var(--muted-foreground)' }} />
                    <input
                      type="email"
                      value={social.email}
                      onChange={e => setSocial(s => ({ ...s, email: e.target.value }))}
                      placeholder="you@email.com"
                      className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                      style={inputStyle}
                    />
                  </div>
                </Field>
                <Field label="Twitter / X" hint="Optional — leave blank to hide the icon.">
                  <div className="mt-1.5 flex items-center gap-2">
                    <TwitterIcon className="h-4 w-4 shrink-0" style={{ color: 'var(--muted-foreground)' }} />
                    <input
                      type="url"
                      value={social.twitter}
                      onChange={e => setSocial(s => ({ ...s, twitter: e.target.value }))}
                      placeholder="https://x.com/username"
                      className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                      style={inputStyle}
                    />
                  </div>
                </Field>
                <Field label="LeetCode">
                  <div className="mt-1.5 flex items-center gap-2">
                    <Code2 className="h-4 w-4 shrink-0" style={{ color: 'var(--muted-foreground)' }} />
                    <input
                      type="url"
                      value={social.leetcode}
                      onChange={e => setSocial(s => ({ ...s, leetcode: e.target.value }))}
                      placeholder="https://leetcode.com/u/username"
                      className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                      style={inputStyle}
                    />
                  </div>
                </Field>
              </SettingsSection>
            </div>
          )}

          {settings && !loading && (
            <div className="mt-6 flex items-center gap-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
              <RotateCcw className="h-3.5 w-3.5" />
              Last updated {new Date(settings.updatedAt).getTime() === 0
                ? 'never (using defaults)'
                : new Date(settings.updatedAt).toLocaleString()}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}