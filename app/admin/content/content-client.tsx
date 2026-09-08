'use client'

/**
 * app/admin/content/content-client.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Part 2.7 — Content Management System
 * ---------------------------------------------------------------------------
 * Full-featured admin page for editing all portfolio content:
 *   • Projects — edit descriptions, links, stack, add/remove/reorder
 *   • Timeline — edit entries
 *   • About — edit section paragraphs
 *   • Skills — edit skill groups
 *
 * Mobile fix (Part E):
 *   - Changed h-screen to admin-viewport-height for dynamic viewport support
 *   - Added safe-area padding for mobile
 *   - Project editor modal uses admin-modal-mobile for proper display
 *   - Improved responsive grid layouts for mobile
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard, LogOut, Mail, Users, FileText, Settings as SettingsIcon,
  ExternalLink, TrendingUp, MessageSquare, Loader2, Menu, X, Palette,
  BarChart2, AlertTriangle, Check, ShieldCheck, Save, RotateCcw,
  Plus, Trash2, ChevronUp, ChevronDown, Edit3, FolderKanban,
  Clock, User, Wrench, Eye, EyeOff, GripVertical, Link2,
} from 'lucide-react'
import { themes } from '@/lib/content'
import type {
  ProjectContent, AboutContent, SkillGroup, TimelineEntry,
} from '@/lib/content-store'

// ─── GitHub icon ────────────────────────────────────────────────────────

function GithubIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────

interface ContentStore {
  projects: ProjectContent[]
  about: AboutContent
  skillGroups: SkillGroup[]
  timeline: TimelineEntry[]
  updatedAt: string
}

interface NavItem {
  icon: React.ReactNode
  label: string
  href: string
  active?: boolean
  badge?: number
}

// ─── Theme hook ──────────────────────────────────────────────────────────

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

// ─── Sidebar nav item ────────────────────────────────────────────────────

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

// ─── Input helpers ───────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: 'var(--background)',
  borderColor: 'var(--border)',
  color: 'var(--foreground)',
}

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

// ─── Tab type ────────────────────────────────────────────────────────────

type Tab = 'projects' | 'timeline' | 'about' | 'skills'

// ─── Main component ──────────────────────────────────────────────────────

export default function ContentClient({ adminEmail }: { adminEmail: string }) {
  const router = useRouter()
  const { theme, setTheme } = useAdminTheme()
  const [loggingOut, setLoggingOut] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showThemePicker, setShowThemePicker] = useState(false)
  const [msgStats, setMsgStats] = useState<{ total: number; unread: number } | null>(null)

  const [activeTab, setActiveTab] = useState<Tab>('projects')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [content, setContent] = useState<ContentStore | null>(null)
  const [redisConfigured, setRedisConfigured] = useState(true)

  // Per-tab save state
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Local editable state
  const [projects, setProjects] = useState<ProjectContent[]>([])
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [about, setAbout] = useState<AboutContent | null>(null)
  const [skillGroups, setSkillGroups] = useState<SkillGroup[]>([])

  // Project editing state
  const [editingProject, setEditingProject] = useState<ProjectContent | null>(null)
  const [projectIndex, setProjectIndex] = useState<number | null>(null)
  const [showProjectEditor, setShowProjectEditor] = useState(false)

  useEffect(() => {
    fetch('/api/admin/messages?filter=all')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.stats) setMsgStats(d.stats) })
      .catch(() => {})
  }, [])

  const loadContent = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch('/api/admin/content', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load content')
      const data = await res.json()
      setContent(data.content)
      setRedisConfigured(data.storage?.redisConfigured ?? true)
      setProjects(data.content.projects)
      setTimeline(data.content.timeline)
      setAbout(data.content.about)
      setSkillGroups(data.content.skillGroups)
    } catch {
      setLoadError('Could not load content. Please refresh the page.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadContent() }, [loadContent])

  const handleLogout = useCallback(async () => {
    setLoggingOut(true)
    try {
      await fetch('/api/admin/logout', { method: 'POST' })
    } finally {
      router.replace('/admin')
    }
  }, [router])

  const saveCurrentTab = async () => {
    setSaving(true)
    setSaved(false)
    setSaveError(null)
    try {
      let patch: Partial<ContentStore> = {}
      if (activeTab === 'projects') patch = { projects }
      else if (activeTab === 'timeline') patch = { timeline }
      else if (activeTab === 'about' && about) patch = { about }
      else if (activeTab === 'skills') patch = { skillGroups }

      const res = await fetch('/api/admin/content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSaveError(data.error || 'Failed to save. Please try again.')
        return
      }
      setContent(data.content)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setSaveError('Network error — please try again.')
    } finally {
      setSaving(false)
    }
  }

  // Canonical nav list — Visitors removed in Part 2.7
  const navItems: NavItem[] = [
    { icon: <LayoutDashboard className="h-4 w-4" />, label: 'Dashboard', href: '/admin/dashboard' },
    { icon: <MessageSquare className="h-4 w-4" />, label: 'Messages', href: '/admin/messages', badge: msgStats?.unread ?? 0 },
    { icon: <BarChart2 className="h-4 w-4" />, label: 'Analytics', href: '/admin/analytics' },
    { icon: <FileText className="h-4 w-4" />, label: 'Resume', href: '/admin/resume' },
    { icon: <FolderKanban className="h-4 w-4" />, label: 'Content', href: '/admin/content', active: true },
    { icon: <SettingsIcon className="h-4 w-4" />, label: 'Settings', href: '/admin/settings' },
    { icon: <ShieldCheck className="h-4 w-4" />, label: 'Security', href: '/admin/security' },
  ]

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'projects', label: 'Projects', icon: <FolderKanban className="h-4 w-4" /> },
    { id: 'timeline', label: 'Timeline', icon: <Clock className="h-4 w-4" /> },
    { id: 'about', label: 'About', icon: <User className="h-4 w-4" /> },
    { id: 'skills', label: 'Skills', icon: <Wrench className="h-4 w-4" /> },
  ]

  return (
    <div
      data-theme={theme}
      className="admin-viewport-height flex overflow-hidden"
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
          admin-sidebar-mobile fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r
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

          <div className="flex items-center gap-2 text-sm min-w-0">
            <span style={{ color: 'var(--muted-foreground)' }}>Admin</span>
            <span style={{ color: 'var(--border)' }}>/</span>
            <span className="font-medium truncate">Content</span>
          </div>

          <div className="flex-1" />

          <div className="relative">
            <button
              onClick={() => setShowThemePicker(v => !v)}
              className="flex items-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-medium transition-all duration-200"
              style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
              aria-label="Change theme"
            >
              <Palette className="h-3.5 w-3.5" />
              <span
                className="h-3 w-3 rounded-full hidden sm:inline"
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

          <div
            className="hidden items-center gap-2 rounded-full border px-3 py-1.5 text-xs md:flex"
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
            className="flex items-center gap-2 rounded-xl border px-2.5 sm:px-3 py-2 text-sm font-medium transition-all duration-200 disabled:opacity-50 hover:border-[var(--destructive)] hover:text-[var(--destructive)]"
            style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
          >
            {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            <span className="hidden sm:inline">Logout</span>
          </button>
        </header>

        <main className="admin-main-scroll flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 admin-content-safe-bottom">
          <div className="mb-8">
            <p className="eyebrow mb-2">Site Content</p>
            <h1 className="text-2xl font-bold sm:text-3xl">Content Management</h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
              Edit projects, timeline, about section, and skills shown on the live portfolio.
            </p>
          </div>

          {!redisConfigured && (
            <div
              className="mb-6 flex items-start gap-3 rounded-2xl border p-4"
              style={{ background: 'color-mix(in oklch, oklch(0.75 0.18 60) 12%, transparent)', borderColor: 'color-mix(in oklch, oklch(0.75 0.18 60) 35%, transparent)' }}
            >
              <AlertTriangle className="h-5 w-5 shrink-0" style={{ color: 'oklch(0.75 0.18 60)' }} />
              <div className="text-sm">
                <p className="font-medium">Content storage isn&apos;t persistent</p>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  No Upstash Redis (Vercel KV) connection was detected, so changes are only saved to a local file and won&apos;t survive a redeploy.
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
            <>
              {/* Tab bar */}
              <div className="mb-6 flex gap-1 overflow-x-auto rounded-2xl border p-1 -mx-1 px-1" style={{ borderColor: 'var(--border)' }}>
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className="flex shrink-0 items-center gap-1.5 sm:gap-2 rounded-xl px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-all"
                    style={{
                      background: activeTab === tab.id
                        ? 'color-mix(in oklch, var(--primary) 15%, transparent)'
                        : 'transparent',
                      color: activeTab === tab.id ? 'var(--primary)' : 'var(--muted-foreground)',
                    }}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Save bar */}
              <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border p-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Save changes</p>
                  <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
                    {content && content.updatedAt !== new Date(0).toISOString()
                      ? `Last updated ${new Date(content.updatedAt).toLocaleString()}`
                      : 'Using default content (no edits yet)'}
                  </p>
                </div>
                {saveError && (
                  <p className="text-xs" style={{ color: 'var(--destructive)' }}>{saveError}</p>
                )}
                <button
                  onClick={saveCurrentTab}
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

              {/* Content sections */}
              {activeTab === 'projects' && (
                <ProjectsTab
                  projects={projects}
                  setProjects={setProjects}
                  onEdit={(project, index) => {
                    setEditingProject(project)
                    setProjectIndex(index)
                    setShowProjectEditor(true)
                  }}
                />
              )}

              {activeTab === 'timeline' && (
                <TimelineTab timeline={timeline} setTimeline={setTimeline} />
              )}

              {activeTab === 'about' && about && (
                <AboutTab about={about} setAbout={setAbout} />
              )}

              {activeTab === 'skills' && (
                <SkillsTab skillGroups={skillGroups} setSkillGroups={setSkillGroups} />
              )}
            </>
          )}
        </main>
      </div>

      {/* Project editor modal */}
      {showProjectEditor && editingProject && projectIndex !== null && (
        <ProjectEditorModal
          project={editingProject}
          onClose={() => {
            setShowProjectEditor(false)
            setEditingProject(null)
            setProjectIndex(null)
          }}
          onSave={(updatedProject) => {
            const next = [...projects]
            next[projectIndex] = updatedProject
            setProjects(next)
            setShowProjectEditor(false)
            setEditingProject(null)
            setProjectIndex(null)
          }}
        />
      )}
    </div>
  )
}

// ─── Projects Tab ────────────────────────────────────────────────────────

function ProjectsTab({
  projects,
  setProjects,
  onEdit,
}: {
  projects: ProjectContent[]
  setProjects: (projects: ProjectContent[]) => void
  onEdit: (project: ProjectContent, index: number) => void
}) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  const moveProject = (from: number, to: number) => {
    if (to < 0 || to >= projects.length) return
    const next = [...projects]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setProjects(next)
  }

  const removeProject = (index: number) => {
    const next = projects.filter((_, i) => i !== index)
    setProjects(next)
  }

  const addProject = () => {
    const newProject: ProjectContent = {
      number: String(projects.length + 1).padStart(2, '0'),
      name: 'New Project',
      mark: 'N',
      year: String(new Date().getFullYear()),
      categories: ['web'],
      theme: 'project-deepdive',
      short: 'A short description of your new project.',
      problem: 'The problem this project solves.',
      features: ['Feature 1', 'Feature 2'],
      stack: ['Next.js', 'TypeScript'],
      challenges: 'Describe the challenges faced.',
      metrics: 'Key metrics or achievements.',
      live: 'https://example.com',
      github: 'https://github.com/username/project',
      images: [],
    }
    setProjects([...projects, newProject])
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium">{projects.length} projects</p>
        <button
          onClick={addProject}
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all"
          style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
        >
          <Plus className="h-3.5 w-3.5" />
          Add project
        </button>
      </div>

      {projects.map((project, index) => (
        <div
          key={`${project.number}-${project.name}-${index}`}
          className="group flex items-center gap-2 sm:gap-3 rounded-xl border p-3 sm:p-4 transition-all"
          style={{
            background: 'var(--card)',
            borderColor: draggedIndex === index ? 'var(--primary)' : 'var(--border)',
            opacity: draggedIndex === index ? 0.5 : 1,
          }}
          draggable
          onDragStart={() => setDraggedIndex(index)}
          onDragEnd={() => setDraggedIndex(null)}
          onDragOver={(e) => {
            e.preventDefault()
            if (draggedIndex !== null && draggedIndex !== index) {
              moveProject(draggedIndex, index)
              setDraggedIndex(index)
            }
          }}
        >
          <div className="flex flex-col gap-1 shrink-0">
            <button
              onClick={() => moveProject(index, index - 1)}
              disabled={index === 0}
              className="rounded-lg p-1 transition-colors hover:bg-[var(--muted)] disabled:opacity-30"
              style={{ color: 'var(--muted-foreground)' }}
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => moveProject(index, index + 1)}
              disabled={index === projects.length - 1}
              className="rounded-lg p-1 transition-colors hover:bg-[var(--muted)] disabled:opacity-30"
              style={{ color: 'var(--muted-foreground)' }}
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>

          <div
            className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold"
            style={{
              background: 'color-mix(in oklch, var(--primary) 15%, transparent)',
              color: 'var(--primary)',
            }}
          >
            {project.number}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{project.name}</p>
            <p className="truncate text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {project.year} · {project.categories.join(', ')}
            </p>
          </div>

          <div className="flex shrink-0 gap-1 opacity-100 sm:opacity-0 transition-opacity sm:group-hover:opacity-100">
            <button
              onClick={() => onEdit(project, index)}
              className="rounded-lg p-2 transition-colors hover:bg-[var(--muted)]"
              style={{ color: 'var(--muted-foreground)' }}
              title="Edit project"
            >
              <Edit3 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => removeProject(index)}
              className="rounded-lg p-2 transition-colors hover:text-[var(--destructive)]"
              style={{ color: 'var(--muted-foreground)' }}
              title="Remove project"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Timeline Tab ────────────────────────────────────────────────────────

function TimelineTab({
  timeline,
  setTimeline,
}: {
  timeline: TimelineEntry[]
  setTimeline: (timeline: TimelineEntry[]) => void
}) {
  const moveEntry = (from: number, to: number) => {
    if (to < 0 || to >= timeline.length) return
    const next = [...timeline]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setTimeline(next)
  }

  const updateEntry = (index: number, field: keyof TimelineEntry, value: string) => {
    const next = [...timeline]
    next[index] = { ...next[index], [field]: value }
    setTimeline(next)
  }

  const removeEntry = (index: number) => {
    setTimeline(timeline.filter((_, i) => i !== index))
  }

  const addEntry = () => {
    setTimeline([
      ...timeline,
      { year: String(new Date().getFullYear()), title: 'New Milestone', subtitle: 'Describe this milestone' },
    ])
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium">{timeline.length} entries</p>
        <button
          onClick={addEntry}
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all"
          style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
        >
          <Plus className="h-3.5 w-3.5" />
          Add entry
        </button>
      </div>

      {timeline.map((entry, index) => (
        <div
          key={index}
          className="rounded-xl border p-3 sm:p-4"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="flex gap-1">
              <button
                onClick={() => moveEntry(index, index - 1)}
                disabled={index === 0}
                className="rounded-lg p-1 transition-colors hover:bg-[var(--muted)] disabled:opacity-30"
                style={{ color: 'var(--muted-foreground)' }}
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => moveEntry(index, index + 1)}
                disabled={index === timeline.length - 1}
                className="rounded-lg p-1 transition-colors hover:bg-[var(--muted)] disabled:opacity-30"
                style={{ color: 'var(--muted-foreground)' }}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
            <input
              type="text"
              value={entry.year}
              onChange={e => updateEntry(index, 'year', e.target.value)}
              className="w-20 sm:w-24 rounded-lg border px-3 py-1.5 text-sm font-medium outline-none focus:border-[var(--primary)]"
              style={inputStyle}
            />
            <button
              onClick={() => removeEntry(index)}
              className="ml-auto rounded-lg p-1.5 transition-colors hover:text-[var(--destructive)]"
              style={{ color: 'var(--muted-foreground)' }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <input
            type="text"
            value={entry.title}
            onChange={e => updateEntry(index, 'title', e.target.value)}
            placeholder="Title"
            className="mb-2 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
            style={inputStyle}
          />
          <input
            type="text"
            value={entry.subtitle}
            onChange={e => updateEntry(index, 'subtitle', e.target.value)}
            placeholder="Subtitle"
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
            style={inputStyle}
          />
        </div>
      ))}
    </div>
  )
}

// ─── About Tab ───────────────────────────────────────────────────────────

function AboutTab({
  about,
  setAbout,
}: {
  about: AboutContent
  setAbout: (about: AboutContent) => void
}) {
  const updateField = (field: keyof AboutContent, value: string | string[]) => {
    setAbout({ ...about, [field]: value })
  }

  const updateParagraph = (index: number, value: string) => {
    const next = [...about.paragraphs]
    next[index] = value
    setAbout({ ...about, paragraphs: next })
  }

  const addParagraph = () => {
    setAbout({ ...about, paragraphs: [...about.paragraphs, ''] })
  }

  const removeParagraph = (index: number) => {
    setAbout({ ...about, paragraphs: about.paragraphs.filter((_, i) => i !== index) })
  }

  const updateInterest = (index: number, value: string) => {
    const next = [...about.interests]
    next[index] = value
    setAbout({ ...about, interests: next })
  }

  const addInterest = () => {
    setAbout({ ...about, interests: [...about.interests, ''] })
  }

  const removeInterest = (index: number) => {
    setAbout({ ...about, interests: about.interests.filter((_, i) => i !== index) })
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="College">
          <input
            type="text"
            value={about.college}
            onChange={e => updateField('college', e.target.value)}
            className="mt-1.5 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
            style={inputStyle}
          />
        </Field>
        <Field label="Current Year">
          <input
            type="text"
            value={about.currentYear}
            onChange={e => updateField('currentYear', e.target.value)}
            className="mt-1.5 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
            style={inputStyle}
          />
        </Field>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium">Paragraphs</p>
          <button
            onClick={addParagraph}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium"
            style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
          >
            <Plus className="h-3 w-3" /> Add
          </button>
        </div>
        <div className="space-y-2">
          {about.paragraphs.map((para, index) => (
            <div key={index} className="flex items-start gap-2">
              <textarea
                value={para}
                onChange={e => updateParagraph(index, e.target.value)}
                rows={3}
                className="flex-1 resize-none rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                style={inputStyle}
              />
              <button
                onClick={() => removeParagraph(index)}
                className="mt-1 rounded-lg p-1.5 transition-colors hover:text-[var(--destructive)]"
                style={{ color: 'var(--muted-foreground)' }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium">Interests</p>
          <button
            onClick={addInterest}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium"
            style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
          >
            <Plus className="h-3 w-3" /> Add
          </button>
        </div>
        <div className="space-y-2">
          {about.interests.map((interest, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="text"
                value={interest}
                onChange={e => updateInterest(index, e.target.value)}
                className="flex-1 rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                style={inputStyle}
              />
              <button
                onClick={() => removeInterest(index)}
                className="rounded-lg p-1.5 transition-colors hover:text-[var(--destructive)]"
                style={{ color: 'var(--muted-foreground)' }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Skills Tab ──────────────────────────────────────────────────────────

function SkillsTab({
  skillGroups,
  setSkillGroups,
}: {
  skillGroups: SkillGroup[]
  setSkillGroups: (skillGroups: SkillGroup[]) => void
}) {
  const updateGroupCategory = (index: number, value: string) => {
    const next = [...skillGroups]
    next[index] = { ...next[index], category: value }
    setSkillGroups(next)
  }

  const updateGroupItem = (groupIndex: number, itemIndex: number, value: string) => {
    const next = [...skillGroups]
    next[groupIndex].items[itemIndex] = value
    setSkillGroups(next)
  }

  const addGroup = () => {
    setSkillGroups([...skillGroups, { category: 'New Category', items: ['Skill 1'] }])
  }

  const removeGroup = (index: number) => {
    setSkillGroups(skillGroups.filter((_, i) => i !== index))
  }

  const addItem = (groupIndex: number) => {
    const next = [...skillGroups]
    next[groupIndex].items.push('')
    setSkillGroups(next)
  }

  const removeItem = (groupIndex: number, itemIndex: number) => {
    const next = [...skillGroups]
    next[groupIndex].items = next[groupIndex].items.filter((_, i) => i !== itemIndex)
    setSkillGroups(next)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium">{skillGroups.length} groups</p>
        <button
          onClick={addGroup}
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all"
          style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
        >
          <Plus className="h-3.5 w-3.5" />
          Add group
        </button>
      </div>

      {skillGroups.map((group, groupIndex) => (
        <div
          key={groupIndex}
          className="rounded-xl border p-3 sm:p-4"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <div className="mb-3 flex items-center gap-2">
            <input
              type="text"
              value={group.category}
              onChange={e => updateGroupCategory(groupIndex, e.target.value)}
              className="flex-1 rounded-lg border px-3 py-2 text-sm font-semibold outline-none focus:border-[var(--primary)]"
              style={inputStyle}
            />
            <button
              onClick={() => removeGroup(groupIndex)}
              className="rounded-lg p-1.5 transition-colors hover:text-[var(--destructive)]"
              style={{ color: 'var(--muted-foreground)' }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="space-y-2">
            {group.items.map((item, itemIndex) => (
              <div key={itemIndex} className="flex items-center gap-2">
                <input
                  type="text"
                  value={item}
                  onChange={e => updateGroupItem(groupIndex, itemIndex, e.target.value)}
                  className="flex-1 rounded-lg border px-3 py-1.5 text-sm outline-none focus:border-[var(--primary)]"
                  style={inputStyle}
                />
                <button
                  onClick={() => removeItem(groupIndex, itemIndex)}
                  className="rounded-lg p-1.5 transition-colors hover:text-[var(--destructive)]"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            <button
              onClick={() => addItem(groupIndex)}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium"
              style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
            >
              <Plus className="h-3 w-3" /> Add skill
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Project Editor Modal ────────────────────────────────────────────────

function ProjectEditorModal({
  project,
  onClose,
  onSave,
}: {
  project: ProjectContent
  onClose: () => void
  onSave: (project: ProjectContent) => void
}) {
  const [draft, setDraft] = useState<ProjectContent>({ ...project })
  const [activeSection, setActiveSection] = useState<'basic' | 'features' | 'stack' | 'images'>('basic')

  const updateField = (field: keyof ProjectContent, value: string | string[]) => {
    setDraft({ ...draft, [field]: value })
  }

  const updateArrayItem = (field: 'features' | 'stack' | 'categories' | 'images', index: number, value: string) => {
    const next = [...(draft[field] as string[])]
    next[index] = value
    setDraft({ ...draft, [field]: next })
  }

  const addArrayItem = (field: 'features' | 'stack' | 'categories' | 'images') => {
    setDraft({ ...draft, [field]: [...(draft[field] as string[]), ''] })
  }

  const removeArrayItem = (field: 'features' | 'stack' | 'categories' | 'images', index: number) => {
    setDraft({ ...draft, [field]: (draft[field] as string[]).filter((_, i) => i !== index) })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div
        className="admin-modal-mobile relative z-10 flex w-full max-w-3xl flex-col rounded-2xl border shadow-2xl"
        style={{ background: 'var(--card)', borderColor: 'var(--border)', maxHeight: 'calc(100dvh - 1rem)' }}
      >
        {/* Header */}
        <div
          className="flex shrink-0 items-center gap-3 border-b px-4 sm:px-5 py-3 sm:py-4"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">Edit Project</p>
            <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
              {draft.number} · {draft.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto shrink-0 rounded-lg p-2 transition-colors hover:bg-[var(--muted)]"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Section tabs */}
        <div className="flex shrink-0 gap-1 border-b px-3 sm:px-4 py-2 overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
          {(['basic', 'features', 'stack', 'images'] as const).map(section => (
            <button
              key={section}
              onClick={() => setActiveSection(section)}
              className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-all"
              style={{
                background: activeSection === section
                  ? 'color-mix(in oklch, var(--primary) 15%, transparent)'
                  : 'transparent',
                color: activeSection === section ? 'var(--primary)' : 'var(--muted-foreground)',
              }}
            >
              {section}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4">
          {activeSection === 'basic' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Number">
                  <input
                    type="text"
                    value={draft.number}
                    onChange={e => updateField('number', e.target.value)}
                    className="mt-1.5 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                    style={inputStyle}
                  />
                </Field>
                <Field label="Name">
                  <input
                    type="text"
                    value={draft.name}
                    onChange={e => updateField('name', e.target.value)}
                    className="mt-1.5 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                    style={inputStyle}
                  />
                </Field>
                <Field label="Mark">
                  <input
                    type="text"
                    value={draft.mark}
                    onChange={e => updateField('mark', e.target.value)}
                    className="mt-1.5 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                    style={inputStyle}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Year">
                  <input
                    type="text"
                    value={draft.year}
                    onChange={e => updateField('year', e.target.value)}
                    className="mt-1.5 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                    style={inputStyle}
                  />
                </Field>
                <Field label="Theme">
                  <input
                    type="text"
                    value={draft.theme}
                    onChange={e => updateField('theme', e.target.value)}
                    className="mt-1.5 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                    style={inputStyle}
                  />
                </Field>
              </div>

              <Field label="Short Description">
                <textarea
                  value={draft.short}
                  onChange={e => updateField('short', e.target.value)}
                  rows={3}
                  className="mt-1.5 w-full resize-none rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                  style={inputStyle}
                />
              </Field>

              <Field label="Problem">
                <textarea
                  value={draft.problem}
                  onChange={e => updateField('problem', e.target.value)}
                  rows={3}
                  className="mt-1.5 w-full resize-none rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                  style={inputStyle}
                />
              </Field>

              <Field label="Challenges">
                <textarea
                  value={draft.challenges}
                  onChange={e => updateField('challenges', e.target.value)}
                  rows={3}
                  className="mt-1.5 w-full resize-none rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                  style={inputStyle}
                />
              </Field>

              <Field label="Metrics">
                <input
                  type="text"
                  value={draft.metrics}
                  onChange={e => updateField('metrics', e.target.value)}
                  className="mt-1.5 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                  style={inputStyle}
                />
              </Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Live URL">
                  <div className="mt-1.5 flex items-center gap-2">
                    <Link2 className="h-4 w-4 shrink-0" style={{ color: 'var(--muted-foreground)' }} />
                    <input
                      type="url"
                      value={draft.live}
                      onChange={e => updateField('live', e.target.value)}
                      className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                      style={inputStyle}
                    />
                  </div>
                </Field>
                <Field label="GitHub URL">
                  <div className="mt-1.5 flex items-center gap-2">
                    <GithubIcon className="h-4 w-4 shrink-0" style={{ color: 'var(--muted-foreground)' }} />
                    <input
                      type="url"
                      value={draft.github}
                      onChange={e => updateField('github', e.target.value)}
                      className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                      style={inputStyle}
                    />
                  </div>
                </Field>
              </div>
            </div>
          )}

          {activeSection === 'features' && (
            <div className="space-y-2">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium">Features</p>
                <button
                  onClick={() => addArrayItem('features')}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium"
                  style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
                >
                  <Plus className="h-3 w-3" /> Add
                </button>
              </div>
              {draft.features.map((feature, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={feature}
                    onChange={e => updateArrayItem('features', index, e.target.value)}
                    className="flex-1 rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                    style={inputStyle}
                  />
                  <button
                    onClick={() => removeArrayItem('features', index)}
                    className="rounded-lg p-1.5 transition-colors hover:text-[var(--destructive)]"
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeSection === 'stack' && (
            <div className="space-y-2">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium">Stack</p>
                <button
                  onClick={() => addArrayItem('stack')}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium"
                  style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
                >
                  <Plus className="h-3 w-3" /> Add
                </button>
              </div>
              {draft.stack.map((tech, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={tech}
                    onChange={e => updateArrayItem('stack', index, e.target.value)}
                    className="flex-1 rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                    style={inputStyle}
                  />
                  <button
                    onClick={() => removeArrayItem('stack', index)}
                    className="rounded-lg p-1.5 transition-colors hover:text-[var(--destructive)]"
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeSection === 'images' && (
            <div className="space-y-2">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium">Images</p>
                <button
                  onClick={() => addArrayItem('images')}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium"
                  style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
                >
                  <Plus className="h-3 w-3" /> Add
                </button>
              </div>
              {draft.images.map((image, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={image}
                    onChange={e => updateArrayItem('images', index, e.target.value)}
                    placeholder="/path/to/image.png"
                    className="flex-1 rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                    style={inputStyle}
                  />
                  <button
                    onClick={() => removeArrayItem('images', index)}
                    className="rounded-lg p-1.5 transition-colors hover:text-[var(--destructive)]"
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex shrink-0 items-center gap-3 border-t px-4 sm:px-5 py-3 sm:py-4"
          style={{ borderColor: 'var(--border)' }}
        >
          <button
            onClick={onClose}
            className="rounded-xl border px-4 py-2 text-sm font-medium transition-all"
            style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(draft)}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ml-auto"
            style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            <Save className="h-4 w-4" />
            Save Project
          </button>
        </div>
      </div>
    </div>
  )
}