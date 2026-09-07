'use client'

/**
 * app/admin/resume/resume-client.tsx
 *
 * Part 2.4 — Resume Management
 * Part 2.7 update: removed "Visitors" nav item, added "Content" with
 * FolderKanban icon. Canonical nav list now spans Dashboard, Messages,
 * Analytics, Resume, Content, Settings, Security.
 * ---------------------------------------------------------------------------
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  LogOut,
  MessageSquare,
  FileText,
  Settings,
  ExternalLink,
  BarChart2,
  Loader2,
  Menu,
  X,
  Palette,
  UploadCloud,
  Download,
  Clock,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  FolderKanban,
} from 'lucide-react'
import { themes } from '@/lib/content'
import { PdfViewer } from '@/components/pdf-viewer'

// ─── Types ────────────────────────────────────────────────────────────────

interface ResumeMeta {
  url: string
  fileName: string
  size: number
  uploadedAt: string
  downloadCount: number
  storage?: { blobConfigured: boolean; redisConfigured: boolean }
}

interface NavItem {
  icon: React.ReactNode
  label: string
  href: string
  active?: boolean
  badge?: number
}

// ─── Theme hook ────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (!bytes) return '0 KB'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let val = bytes
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024
    i++
  }
  return `${val.toFixed(val < 10 && i > 0 ? 1 : 0)} ${units[i]}`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (d.getTime() === 0) return 'Never uploaded'
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

// ─── Sidebar Nav Item ──────────────────────────────────────────────────────

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

// ─── Stat Pill ────────────────────────────────────────────────────────────

function StatPill({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  color?: string
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-2xl border p-4"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ background: color ?? 'color-mix(in oklch, var(--primary) 15%, transparent)' }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold tabular-nums leading-tight">{value}</p>
        <p className="truncate text-xs" style={{ color: 'var(--muted-foreground)' }}>
          {label}
        </p>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────

export default function ResumeClient({ adminEmail }: { adminEmail: string }) {
  const router = useRouter()
  const { theme, setTheme } = useAdminTheme()
  const [loggingOut, setLoggingOut] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showThemePicker, setShowThemePicker] = useState(false)
  const [msgStats, setMsgStats] = useState<{ total: number; unread: number } | null>(null)

  const [meta, setMeta] = useState<ResumeMeta | null>(null)
  const [loadingMeta, setLoadingMeta] = useState(true)
  const [metaError, setMetaError] = useState<string | null>(null)

  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [previewKey, setPreviewKey] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Load message stats for sidebar badge ──
  useEffect(() => {
    fetch('/api/admin/messages?filter=all')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.stats) setMsgStats(d.stats)
      })
      .catch(() => {})
  }, [])

  // ── Load resume metadata ──
  const loadMeta = useCallback(async () => {
    setLoadingMeta(true)
    setMetaError(null)
    try {
      const res = await fetch('/api/admin/resume', { cache: 'no-store' })
      if (!res.ok) throw new Error('Request failed')
      const data = await res.json()
      setMeta(data)
    } catch {
      setMetaError('Failed to load resume information.')
    } finally {
      setLoadingMeta(false)
    }
  }, [])

  useEffect(() => {
    loadMeta()
  }, [loadMeta])

  const handleLogout = useCallback(async () => {
    setLoggingOut(true)
    try {
      await fetch('/api/admin/logout', { method: 'POST' })
    } finally {
      router.replace('/admin')
    }
  }, [router])

  // ── Upload flow ──
  const uploadFile = useCallback(
    async (file: File) => {
      setUploadError(null)
      setUploadSuccess(false)

      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        setUploadError('Please select a PDF file.')
        return
      }
      const MAX_MB = 15
      if (file.size > MAX_MB * 1024 * 1024) {
        setUploadError(`File is too large. Max size is ${MAX_MB}MB.`)
        return
      }

      setUploading(true)
      try {
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch('/api/admin/resume', { method: 'POST', body: formData })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setUploadError(data.error || 'Upload failed. Please try again.')
          return
        }
        setMeta(data)
        setUploadSuccess(true)
        setPreviewKey((k) => k + 1)
        window.setTimeout(() => setUploadSuccess(false), 4000)
      } catch {
        setUploadError('Network error — please check your connection and try again.')
      } finally {
        setUploading(false)
      }
    },
    [],
  )

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) uploadFile(file)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }

  // Canonical nav list — Visitors removed in Part 2.7
  const navItems: NavItem[] = [
    { icon: <LayoutDashboard className="h-4 w-4" />, label: 'Dashboard', href: '/admin/dashboard' },
    { icon: <MessageSquare className="h-4 w-4" />, label: 'Messages', href: '/admin/messages', badge: msgStats?.unread ?? 0 },
    { icon: <BarChart2 className="h-4 w-4" />, label: 'Analytics', href: '/admin/analytics' },
    { icon: <FileText className="h-4 w-4" />, label: 'Resume', href: '/admin/resume', active: true },
    { icon: <FolderKanban className="h-4 w-4" />, label: 'Content', href: '/admin/content' },
    { icon: <Settings className="h-4 w-4" />, label: 'Settings', href: '/admin/settings' },
    { icon: <ShieldCheck className="h-4 w-4" />, label: 'Security', href: '/admin/security' },
  ]

  const notPersistentWarning =
    meta?.storage && !meta.storage.blobConfigured
      ? 'Vercel Blob isn\u2019t configured — uploads are only saved to the local /public folder on this machine and won\u2019t persist on Vercel deployments.'
      : null

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
          {navItems.map((item) => (
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
            <span className="font-medium">Resume</span>
          </div>

          <div className="flex-1" />

          <div className="relative">
            <button
              onClick={() => setShowThemePicker((v) => !v)}
              className="flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-medium transition-all duration-200"
              style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
              aria-label="Change theme"
            >
              <Palette className="h-3.5 w-3.5" />
              <span
                className="h-3 w-3 rounded-full"
                style={{ background: themes.find((t) => t.id === theme)?.swatch ?? 'var(--primary)' }}
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
                  {themes.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setTheme(t.id)
                        setShowThemePicker(false)
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-150"
                      style={{
                        background:
                          t.id === theme ? 'color-mix(in oklch, var(--primary) 15%, transparent)' : 'transparent',
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
          {/* Page header */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="eyebrow mb-1">Resume Management</p>
              <h1 className="text-2xl font-bold sm:text-3xl">Resume</h1>
            </div>
            <button
              onClick={loadMeta}
              disabled={loadingMeta}
              className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50"
              style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingMeta ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {notPersistentWarning && (
            <div
              className="mb-6 flex items-start gap-3 rounded-2xl border p-4 text-sm"
              style={{
                borderColor: 'color-mix(in oklch, oklch(0.75 0.18 60) 40%, transparent)',
                background: 'color-mix(in oklch, oklch(0.75 0.18 60) 10%, transparent)',
              }}
            >
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: 'oklch(0.75 0.18 60)' }} />
              <p style={{ color: 'var(--foreground)' }}>{notPersistentWarning}</p>
            </div>
          )}

          {metaError && (
            <div
              className="mb-6 flex items-start gap-3 rounded-2xl border p-4 text-sm"
              style={{ borderColor: 'color-mix(in oklch, var(--destructive) 40%, transparent)', background: 'color-mix(in oklch, var(--destructive) 10%, transparent)' }}
            >
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: 'var(--destructive)' }} />
              <p>{metaError}</p>
            </div>
          )}

          {/* Stat pills */}
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatPill
              icon={<Download className="h-5 w-5" style={{ color: 'var(--primary)' }} />}
              label="Total downloads"
              value={loadingMeta ? '—' : formatNumber(meta?.downloadCount ?? 0)}
              color="color-mix(in oklch, var(--primary) 15%, transparent)"
            />
            <StatPill
              icon={<Clock className="h-5 w-5" style={{ color: 'oklch(0.75 0.18 220)' }} />}
              label="Last updated"
              value={loadingMeta ? '—' : formatDate(meta?.uploadedAt ?? '')}
              color="color-mix(in oklch, oklch(0.75 0.18 220) 15%, transparent)"
            />
            <StatPill
              icon={<HardDrive className="h-5 w-5" style={{ color: 'oklch(0.75 0.18 150)' }} />}
              label="File size"
              value={loadingMeta ? '—' : formatBytes(meta?.size ?? 0)}
              color="color-mix(in oklch, oklch(0.75 0.18 150) 15%, transparent)"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[0.45fr_0.55fr]">
            {/* Upload panel */}
            <div className="rounded-2xl border p-6" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
              <h2 className="mb-1 text-sm font-semibold">Upload new resume</h2>
              <p className="mb-4 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                Replaces the resume visitors see and download on the live site. PDF only, up to 15MB.
              </p>

              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => !uploading && fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors"
                style={{
                  borderColor: isDragging
                    ? 'var(--primary)'
                    : 'color-mix(in oklch, var(--border) 100%, transparent)',
                  background: isDragging
                    ? 'color-mix(in oklch, var(--primary) 8%, transparent)'
                    : 'var(--muted)',
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={handleFileInputChange}
                  disabled={uploading}
                />
                {uploading ? (
                  <>
                    <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--primary)' }} />
                    <p className="text-sm font-medium">Uploading…</p>
                  </>
                ) : (
                  <>
                    <span
                      className="flex h-12 w-12 items-center justify-center rounded-full"
                      style={{ background: 'color-mix(in oklch, var(--primary) 15%, transparent)' }}
                    >
                      <UploadCloud className="h-6 w-6" style={{ color: 'var(--primary)' }} />
                    </span>
                    <p className="text-sm font-medium">Drag & drop your resume here</p>
                    <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      or click to browse files
                    </p>
                  </>
                )}
              </div>

              {uploadError && (
                <p
                  className="mt-3 rounded-lg px-3 py-2 text-xs"
                  style={{ background: 'color-mix(in oklch, var(--destructive) 12%, transparent)', color: 'var(--destructive)' }}
                >
                  {uploadError}
                </p>
              )}
              {uploadSuccess && (
                <p
                  className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
                  style={{ background: 'color-mix(in oklch, oklch(0.75 0.18 150) 15%, transparent)', color: 'oklch(0.55 0.15 150)' }}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Resume updated successfully.
                </p>
              )}

              {meta && (
                <div className="mt-5 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
                  <p className="text-xs font-medium mb-2" style={{ color: 'var(--muted-foreground)' }}>
                    Current file
                  </p>
                  <div className="flex items-center gap-3 rounded-xl border px-3 py-2.5" style={{ borderColor: 'var(--border)' }}>
                    <FileText className="h-4 w-4 shrink-0" style={{ color: 'var(--primary)' }} />
                    <span className="min-w-0 flex-1 truncate text-sm">{meta.fileName}</span>
                    <a
                      href="/api/resume/download"
                      className="shrink-0 text-xs font-medium hover:underline"
                      style={{ color: 'var(--primary)' }}
                    >
                      Download
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Inline preview panel */}
            <div className="rounded-2xl border p-6" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Current resume preview</h2>
                {meta && (
                  <a
                    href={meta.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-xs font-medium hover:underline"
                    style={{ color: 'var(--primary)' }}
                  >
                    Open in new tab <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>

              {loadingMeta ? (
                <div
                  className="flex h-[400px] items-center justify-center rounded-2xl border"
                  style={{ borderColor: 'var(--border)', background: 'var(--muted)' }}
                >
                  <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--muted-foreground)' }} />
                </div>
              ) : meta ? (
                <PdfViewer key={previewKey} url={meta.url} fileName={meta.fileName} />
              ) : (
                <div
                  className="flex h-[400px] items-center justify-center rounded-2xl border text-sm"
                  style={{ borderColor: 'var(--border)', background: 'var(--muted)', color: 'var(--muted-foreground)' }}
                >
                  No resume uploaded yet.
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}