'use client'

/**
 * app/admin/messages/messages-client.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Full-featured messages inbox for the admin dashboard.
 *
 * Sidebar fix (applied to match dashboard-client.tsx):
 *  - Added `min-h-0` to the sidebar `<nav>` so the flex item can actually
 *    shrink and scroll internally instead of clipping the bottom-most nav
 *    links (this page's nav list was also missing Analytics and Resume,
 *    which combined with the layout bug made it look like items were
 *    "missing" from the sidebar — both issues are fixed here).
 *  - Nav list now matches the canonical 7-item list used on every other
 *    admin page (Dashboard, Messages, Analytics, Resume, Content, Visitors,
 *    Settings), in the same order, so the sidebar is identical everywhere.
 *
 * Features:
 *  • Lists all contact form submissions with live search & filter tabs
 *  • Read / Unread toggle (per message + bulk)
 *  • Delete single or bulk
 *  • Detail modal — full message, reply composer (sends via nodemailer)
 *  • Unread badge on sidebar nav item
 *  • All 6 portfolio themes respected
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  LogOut,
  Mail,
  MailOpen,
  MessageSquare,
  FileText,
  Users,
  Settings,
  ExternalLink,
  Trash2,
  Reply,
  Search,
  RefreshCw,
  X,
  Loader2,
  Menu,
  Palette,
  CheckSquare,
  Square,
  Send,
  ChevronDown,
  BarChart2,
} from 'lucide-react'
import { themes } from '@/lib/content'
import type { ContactMessage } from '@/lib/messages'

// ─── Types ────────────────────────────────────────────────────────────────────

type Filter = 'all' | 'unread' | 'read' | 'replied'

interface Stats {
  total: number
  unread: number
  read: number
  replied: number
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

// ─── Message Row ──────────────────────────────────────────────────────────────

function MessageRow({
  msg,
  selected,
  onSelect,
  onClick,
  onDelete,
  onToggleRead,
}: {
  msg: ContactMessage
  selected: boolean
  onSelect: (id: string, v: boolean) => void
  onClick: (msg: ContactMessage) => void
  onDelete: (id: string) => void
  onToggleRead: (msg: ContactMessage) => void
}) {
  return (
    <div
      className="group flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-all duration-150"
      style={{
        background: msg.read
          ? 'transparent'
          : 'color-mix(in oklch, var(--primary) 5%, var(--card))',
        borderColor: selected
          ? 'var(--primary)'
          : 'var(--border)',
      }}
      onClick={() => onClick(msg)}
    >
      {/* Checkbox */}
      <button
        className="mt-0.5 shrink-0"
        onClick={e => { e.stopPropagation(); onSelect(msg.id, !selected) }}
        aria-label={selected ? 'Deselect' : 'Select'}
      >
        {selected
          ? <CheckSquare className="h-4 w-4" style={{ color: 'var(--primary)' }} />
          : <Square className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />}
      </button>

      {/* Unread dot */}
      <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full transition-colors"
        style={{ background: msg.read ? 'transparent' : 'var(--primary)' }} />

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
            {msg.name}
          </p>
          <span className="shrink-0 text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {new Date(msg.timestamp).toLocaleDateString('en-IN', {
              day: '2-digit', month: 'short', year: '2-digit',
            })}
          </span>
        </div>
        <p className="truncate text-xs" style={{ color: 'var(--primary)' }}>{msg.email}</p>
        <p className="mt-0.5 truncate text-xs font-medium" style={{ color: 'var(--foreground)' }}>
          {msg.subject}
        </p>
        <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--muted-foreground)' }}>
          {msg.message}
        </p>
      </div>

      {/* Badges + actions */}
      <div
        className="flex shrink-0 flex-col items-end gap-1.5"
        onClick={e => e.stopPropagation()}
      >
        {msg.replied && (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: 'color-mix(in oklch, oklch(0.75 0.18 150) 15%, transparent)', color: 'oklch(0.75 0.18 150)' }}
          >
            Replied
          </span>
        )}
        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={() => onToggleRead(msg)}
            className="rounded-lg p-1.5 transition-colors"
            style={{ color: 'var(--muted-foreground)' }}
            title={msg.read ? 'Mark unread' : 'Mark read'}
          >
            {msg.read
              ? <Mail className="h-3.5 w-3.5" />
              : <MailOpen className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={() => onDelete(msg.id)}
            className="rounded-lg p-1.5 transition-colors hover:text-[var(--destructive)]"
            style={{ color: 'var(--muted-foreground)' }}
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function MessageModal({
  msg,
  onClose,
  onDelete,
  onToggleRead,
  onReply,
}: {
  msg: ContactMessage
  onClose: () => void
  onDelete: (id: string) => void
  onToggleRead: (msg: ContactMessage) => void
  onReply: (id: string, text: string) => Promise<void>
}) {
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [replyError, setReplyError] = useState('')
  const [showReply, setShowReply] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = async () => {
    if (!replyText.trim()) return
    setSending(true)
    setReplyError('')
    try {
      await onReply(msg.id, replyText)
      setSent(true)
      setReplyText('')
      setShowReply(false)
    } catch (e: unknown) {
      setReplyError(e instanceof Error ? e.message : 'Failed to send reply')
    } finally {
      setSending(false)
    }
  }

  useEffect(() => {
    if (showReply) textareaRef.current?.focus()
  }, [showReply])

  // close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="relative z-10 flex w-full max-w-xl flex-col rounded-2xl border shadow-2xl"
        style={{ background: 'var(--card)', borderColor: 'var(--border)', maxHeight: '90vh' }}
      >
        {/* Header */}
        <div
          className="flex shrink-0 items-center gap-3 border-b px-5 py-4"
          style={{ borderColor: 'var(--border)' }}
        >
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold"
            style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            {msg.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{msg.name}</p>
            <p className="truncate text-xs" style={{ color: 'var(--primary)' }}>{msg.email}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={() => onToggleRead(msg)}
              className="rounded-lg p-2 transition-colors hover:bg-[var(--muted)]"
              style={{ color: 'var(--muted-foreground)' }}
              title={msg.read ? 'Mark unread' : 'Mark read'}
            >
              {msg.read ? <Mail className="h-4 w-4" /> : <MailOpen className="h-4 w-4" />}
            </button>
            <button
              onClick={() => { onDelete(msg.id); onClose() }}
              className="rounded-lg p-2 transition-colors hover:text-[var(--destructive)]"
              style={{ color: 'var(--muted-foreground)' }}
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-2 transition-colors hover:bg-[var(--muted)]"
              style={{ color: 'var(--muted-foreground)' }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <div>
            <p
              className="mb-1 font-mono text-[10px] uppercase tracking-widest"
              style={{ color: 'var(--muted-foreground)' }}
            >
              Subject
            </p>
            <p className="text-sm font-semibold">{msg.subject}</p>
          </div>

          <div>
            <p
              className="mb-1 font-mono text-[10px] uppercase tracking-widest"
              style={{ color: 'var(--muted-foreground)' }}
            >
              Received
            </p>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {new Date(msg.timestamp).toLocaleString('en-IN', {
                dateStyle: 'long', timeStyle: 'short',
              })}
            </p>
          </div>

          <div
            className="rounded-xl border p-4"
            style={{ background: 'var(--background)', borderColor: 'var(--border)' }}
          >
            <p
              className="mb-2 font-mono text-[10px] uppercase tracking-widest"
              style={{ color: 'var(--muted-foreground)' }}
            >
              Message
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.message}</p>
          </div>

          {msg.replied && (
            <div
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium"
              style={{
                background: 'color-mix(in oklch, oklch(0.75 0.18 150) 12%, transparent)',
                color: 'oklch(0.75 0.18 150)',
              }}
            >
              <Reply className="h-3.5 w-3.5" />
              You already replied to this message.
            </div>
          )}

          {sent && (
            <div
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium"
              style={{
                background: 'color-mix(in oklch, oklch(0.75 0.18 150) 12%, transparent)',
                color: 'oklch(0.75 0.18 150)',
              }}
            >
              <Send className="h-3.5 w-3.5" />
              Reply sent successfully!
            </div>
          )}

          {/* Reply composer */}
          {showReply ? (
            <div className="space-y-2">
              <p
                className="font-mono text-[10px] uppercase tracking-widest"
                style={{ color: 'var(--muted-foreground)' }}
              >
                Your reply to {msg.name}
              </p>
              <textarea
                ref={textareaRef}
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                rows={5}
                placeholder="Type your reply…"
                className="w-full resize-none rounded-xl border px-3 py-2.5 text-sm outline-none transition-all"
                style={{
                  background: 'var(--background)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
                onFocus={e => (e.target.style.borderColor = 'var(--primary)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
              {replyError && (
                <p className="text-xs" style={{ color: 'var(--destructive)' }}>{replyError}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleSend}
                  disabled={sending || !replyText.trim()}
                  className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all disabled:opacity-50"
                  style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Send Reply
                </button>
                <button
                  onClick={() => setShowReply(false)}
                  className="rounded-xl border px-4 py-2 text-sm transition-all"
                  style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowReply(true)}
              className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all duration-200 w-full justify-center"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--primary)'
                e.currentTarget.style.background = 'color-mix(in oklch, var(--primary) 8%, transparent)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <Reply className="h-4 w-4" style={{ color: 'var(--primary)' }} />
              Reply via Email
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MessagesClient({ adminEmail }: { adminEmail: string }) {
  const router = useRouter()
  const { theme, setTheme } = useAdminTheme()

  const [messages, setMessages] = useState<ContactMessage[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, unread: 0, read: 0, replied: 0 })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [openMsg, setOpenMsg] = useState<ContactMessage | null>(null)

  const [loggingOut, setLoggingOut] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showThemePicker, setShowThemePicker] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  // ── Fetch ────────────────────────────────────────────────────────────────────

  const fetchMessages = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const params = new URLSearchParams({ filter })
      if (search.trim()) params.set('search', search.trim())
      const res = await fetch(`/api/admin/messages?${params}`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages)
        setStats(data.stats)
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [filter, search])

  // Fetch on filter/search change (debounced for search)
  useEffect(() => {
    const t = setTimeout(() => fetchMessages(), search ? 300 : 0)
    return () => clearTimeout(t)
  }, [fetchMessages, search, filter])

  // ── Actions ──────────────────────────────────────────────────────────────────

  const handleToggleRead = async (msg: ContactMessage) => {
    const next = !msg.read
    // Optimistic
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, read: next } : m))
    setStats(prev => ({
      ...prev,
      unread: next ? prev.unread - 1 : prev.unread + 1,
      read: next ? prev.read + 1 : prev.read - 1,
    }))
    if (openMsg?.id === msg.id) setOpenMsg(m => m ? { ...m, read: next } : m)

    await fetch(`/api/admin/messages/${msg.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ read: next }),
    })
  }

  const handleDelete = async (id: string) => {
    setMessages(prev => prev.filter(m => m.id !== id))
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n })
    await fetch(`/api/admin/messages/${id}`, { method: 'DELETE' })
    await fetchMessages(true)
  }

  const handleBulkDelete = async () => {
    if (selected.size === 0) return
    setBulkDeleting(true)
    const ids = Array.from(selected)
    setMessages(prev => prev.filter(m => !selected.has(m.id)))
    setSelected(new Set())
    await fetch('/api/admin/messages', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    await fetchMessages(true)
    setBulkDeleting(false)
  }

  const handleBulkMarkRead = async (read: boolean) => {
    const ids = Array.from(selected)
    setMessages(prev => prev.map(m => selected.has(m.id) ? { ...m, read } : m))
    setSelected(new Set())
    await Promise.all(
      ids.map(id =>
        fetch(`/api/admin/messages/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ read }),
        }),
      ),
    )
    await fetchMessages(true)
  }

  const handleReply = async (id: string, replyText: string) => {
    const res = await fetch('/api/admin/messages/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, replyText }),
    })
    if (!res.ok) {
      const d = await res.json()
      throw new Error(d.error ?? 'Failed to send reply')
    }
    // Update replied status locally
    setMessages(prev => prev.map(m => m.id === id ? { ...m, replied: true } : m))
    if (openMsg?.id === id) setOpenMsg(m => m ? { ...m, replied: true } : m)
  }

  const handleSelect = (id: string, v: boolean) => {
    setSelected(prev => {
      const n = new Set(prev)
      v ? n.add(id) : n.delete(id)
      return n
    })
  }

  const handleSelectAll = () => {
    if (selected.size === messages.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(messages.map(m => m.id)))
    }
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    try { await fetch('/api/admin/logout', { method: 'POST' }) } finally {
      router.replace('/admin')
    }
  }

  // open msg → mark read automatically
  const handleOpenMsg = (msg: ContactMessage) => {
    setOpenMsg(msg)
    if (!msg.read) handleToggleRead(msg)
  }

  // ── Nav ──────────────────────────────────────────────────────────────────────
  // Canonical 7-item nav list — kept identical (order + items) across
  // dashboard-client.tsx, messages-client.tsx, and settings-client.tsx.

  const navItems: NavItem[] = [
    { icon: <LayoutDashboard className="h-4 w-4" />, label: 'Dashboard', href: '/admin/dashboard' },
    { icon: <MessageSquare className="h-4 w-4" />, label: 'Messages', href: '/admin/messages', active: true, badge: stats.unread },
    { icon: <BarChart2 className="h-4 w-4" />, label: 'Analytics', href: '/admin/analytics' },
    { icon: <FileText className="h-4 w-4" />, label: 'Resume', href: '/admin/resume' },
    { icon: <FileText className="h-4 w-4" />, label: 'Content', href: '/admin/content' },
    { icon: <Users className="h-4 w-4" />, label: 'Visitors', href: '/admin/visitors' },
    { icon: <Settings className="h-4 w-4" />, label: 'Settings', href: '/admin/settings' },
  ]

  const filterTabs: { id: Filter; label: string; count?: number }[] = [
    { id: 'all', label: 'All', count: stats.total },
    { id: 'unread', label: 'Unread', count: stats.unread },
    { id: 'read', label: 'Read', count: stats.read },
    { id: 'replied', label: 'Replied', count: stats.replied },
  ]

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div
      data-theme={theme}
      className="flex h-screen overflow-hidden"
      style={{ background: 'var(--background)', color: 'var(--foreground)' }}
    >
      {/* Mobile sidebar overlay */}
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
          <button onClick={() => setSidebarOpen(false)} className="ml-auto shrink-0 rounded-lg p-1 lg:hidden" style={{ color: 'var(--muted-foreground)' }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav items — scrollable middle zone.
            `min-h-0` is required alongside `flex-1` so this flex child can
            actually shrink and scroll internally instead of clipping the
            bottom-most nav links (Content / Visitors / Settings). */}
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

        {/* Top nav */}
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
            <span className="font-medium">Messages</span>
          </div>

          <div className="flex-1" />

          {/* Theme picker */}
          <div className="relative">
            <button
              onClick={() => setShowThemePicker(v => !v)}
              className="flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-medium transition-all duration-200"
              style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
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

          {/* Admin email */}
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

        {/* Page body */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">

          {/* Page title + refresh */}
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold">Inbox</h1>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                {stats.total} total · {stats.unread} unread
              </p>
            </div>
            <button
              onClick={() => fetchMessages(true)}
              disabled={refreshing}
              className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-all"
              style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>

          {/* Search bar */}
          <div
            className="mb-4 flex items-center gap-2 rounded-xl border px-3 py-2.5"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <Search className="h-4 w-4 shrink-0" style={{ color: 'var(--muted-foreground)' }} />
            <input
              type="text"
              placeholder="Search name, email, subject, message…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: 'var(--foreground)' }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ color: 'var(--muted-foreground)' }}>
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filter tabs */}
          <div className="mb-4 flex gap-1 overflow-x-auto pb-1">
            {filterTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => { setFilter(tab.id); setSelected(new Set()) }}
                className="flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all"
                style={{
                  background: filter === tab.id
                    ? 'color-mix(in oklch, var(--primary) 15%, transparent)'
                    : 'var(--card)',
                  color: filter === tab.id ? 'var(--primary)' : 'var(--muted-foreground)',
                  border: `1px solid ${filter === tab.id ? 'color-mix(in oklch, var(--primary) 30%, transparent)' : 'var(--border)'}`,
                }}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                    style={{
                      background: filter === tab.id
                        ? 'color-mix(in oklch, var(--primary) 25%, transparent)'
                        : 'var(--muted)',
                    }}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Bulk action bar */}
          {selected.size > 0 && (
            <div
              className="mb-4 flex items-center gap-2 rounded-xl border px-4 py-2.5"
              style={{
                background: 'color-mix(in oklch, var(--primary) 8%, var(--card))',
                borderColor: 'color-mix(in oklch, var(--primary) 30%, transparent)',
              }}
            >
              <span className="text-xs font-semibold" style={{ color: 'var(--primary)' }}>
                {selected.size} selected
              </span>
              <div className="flex gap-2 ml-auto">
                <button
                  onClick={() => handleBulkMarkRead(true)}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
                  style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
                >
                  <MailOpen className="h-3 w-3" /> Mark read
                </button>
                <button
                  onClick={() => handleBulkMarkRead(false)}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
                  style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
                >
                  <Mail className="h-3 w-3" /> Mark unread
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all hover:text-[var(--destructive)]"
                  style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
                >
                  {bulkDeleting
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <Trash2 className="h-3 w-3" />}
                  Delete
                </button>
                <button
                  onClick={() => setSelected(new Set())}
                  className="rounded-lg p-1.5 transition-all"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Select all bar */}
          {messages.length > 0 && (
            <div className="mb-2 flex items-center gap-2 px-1">
              <button
                onClick={handleSelectAll}
                className="flex items-center gap-2 text-xs"
                style={{ color: 'var(--muted-foreground)' }}
              >
                {selected.size === messages.length && messages.length > 0
                  ? <CheckSquare className="h-3.5 w-3.5" style={{ color: 'var(--primary)' }} />
                  : <Square className="h-3.5 w-3.5" />}
                {selected.size === messages.length && messages.length > 0 ? 'Deselect all' : 'Select all'}
              </button>
            </div>
          )}

          {/* Messages list */}
          <div className="space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--primary)' }} />
              </div>
            ) : messages.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center gap-3 rounded-2xl border py-16 text-center"
                style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
              >
                <MessageSquare className="h-10 w-10" style={{ color: 'var(--muted-foreground)' }} />
                <p className="text-sm font-medium">No messages found</p>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  {search ? 'Try a different search term' : 'Contact form submissions will appear here'}
                </p>
              </div>
            ) : (
              messages.map(msg => (
                <MessageRow
                  key={msg.id}
                  msg={msg}
                  selected={selected.has(msg.id)}
                  onSelect={handleSelect}
                  onClick={handleOpenMsg}
                  onDelete={handleDelete}
                  onToggleRead={handleToggleRead}
                />
              ))
            )}
          </div>
        </main>
      </div>

      {/* Detail modal */}
      {openMsg && (
        <MessageModal
          msg={openMsg}
          onClose={() => setOpenMsg(null)}
          onDelete={handleDelete}
          onToggleRead={handleToggleRead}
          onReply={handleReply}
        />
      )}
    </div>
  )
}