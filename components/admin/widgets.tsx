'use client'

/**
 * components/admin/widgets.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Part 3.2 (Dashboard upgrade) — Shared dashboard layout primitives
 * ---------------------------------------------------------------------------
 * Small, reusable building blocks the new Dashboard home composes from.
 * Everything here uses CSS theme tokens so all six themes work untouched.
 *
 * Includes:
 *   • Panel / PanelHeader        — consistent card shell
 *   • SkeletonBlock              — animated loading placeholder
 *   • EmptyState                 — icon + message fallback
 *   • HealthDot                  — green/amber status pill for health checks
 *   • ActivityRow                — one row in the combined activity feed
 *   • QuickActionButton          — the large tappable quick-action tiles
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { ReactNode } from 'react'
import { ArrowUpRight, Loader2 } from 'lucide-react'

// ─── Panel ────────────────────────────────────────────────────────────────

export interface PanelProps {
  children: ReactNode
  className?: string
  padded?: boolean
  hover?: boolean
}

export function Panel({ children, className = '', padded = true, hover = false }: PanelProps) {
  return (
    <div
      className={`rounded-2xl border transition-all duration-300 ${
        hover ? 'hover:-translate-y-0.5 hover:shadow-lg' : ''
      } ${padded ? 'p-5 sm:p-6' : ''} ${className}`}
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
    >
      {children}
    </div>
  )
}

export interface PanelHeaderProps {
  title: string
  subtitle?: string
  icon?: ReactNode
  action?: ReactNode
  className?: string
}

export function PanelHeader({ title, subtitle, icon, action, className = '' }: PanelHeaderProps) {
  return (
    <div className={`mb-4 flex items-start justify-between gap-3 ${className}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {icon && <span style={{ color: 'var(--primary)' }}>{icon}</span>}
          <h2 className="text-sm font-semibold truncate">{title}</h2>
        </div>
        {subtitle && (
          <p className="mt-0.5 text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────

export function SkeletonBlock({
  height = 16,
  width = '100%',
  radius = 8,
}: {
  height?: number | string
  width?: number | string
  radius?: number
}) {
  return (
    <div
      className="animate-pulse"
      style={{
        height,
        width,
        borderRadius: radius,
        background:
          'linear-gradient(90deg, var(--muted) 0%, color-mix(in oklch, var(--muted) 60%, var(--foreground) 6%) 50%, var(--muted) 100%)',
        backgroundSize: '200% 100%',
        animation: 'skeleton-shimmer 1.4s ease-in-out infinite',
      }}
    />
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────

export interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-center"
      style={{ borderColor: 'var(--border)' }}
    >
      {icon && <span style={{ color: 'var(--muted-foreground)' }}>{icon}</span>}
      <p className="text-sm font-medium">{title}</p>
      {description && (
        <p className="text-xs max-w-[260px]" style={{ color: 'var(--muted-foreground)' }}>
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

// ─── Health Dot ───────────────────────────────────────────────────────────

export function HealthDot({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div
      className="flex items-start gap-2.5 rounded-xl border p-3"
      style={{ borderColor: 'var(--border)' }}
    >
      <span className="mt-1 relative flex h-2.5 w-2.5 shrink-0">
        {ok && (
          <span
            className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping"
            style={{ background: 'oklch(0.72 0.18 150)' }}
          />
        )}
        <span
          className="relative inline-flex h-2.5 w-2.5 rounded-full"
          style={{ background: ok ? 'oklch(0.72 0.18 150)' : 'oklch(0.75 0.18 60)' }}
        />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium leading-tight">{label}</p>
        <p className="text-[11px] mt-0.5 leading-snug" style={{ color: 'var(--muted-foreground)' }}>
          {detail}
        </p>
      </div>
    </div>
  )
}

// ─── Activity Row ─────────────────────────────────────────────────────────

export interface ActivityRowProps {
  icon: ReactNode
  iconBg: string
  title: string
  description: string
  time: string
  tone?: 'positive' | 'neutral' | 'warning'
  href?: string
}

export function ActivityRow({ icon, iconBg, title, description, time, tone = 'neutral', href }: ActivityRowProps) {
  const toneColor =
    tone === 'warning'
      ? 'oklch(0.75 0.18 60)'
      : tone === 'positive'
        ? 'oklch(0.72 0.18 150)'
        : 'var(--muted-foreground)'

  const inner = (
    <div
      className="flex items-start gap-3 rounded-xl p-2.5 text-sm transition-colors group"
      style={{ background: 'transparent' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <div
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
        style={{ background: iconBg }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium leading-snug truncate">{title}</p>
        <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
          {description}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <span className="text-[10px] font-mono whitespace-nowrap" style={{ color: toneColor }}>
          {time}
        </span>
        {href && (
          <ArrowUpRight
            className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ color: 'var(--muted-foreground)' }}
          />
        )}
      </div>
    </div>
  )

  return href ? (
    <a href={href} className="block">
      {inner}
    </a>
  ) : (
    inner
  )
}

// ─── Quick Action Button ──────────────────────────────────────────────────

export interface QuickActionButtonProps {
  icon: ReactNode
  label: string
  description?: string
  href: string
  external?: boolean
  accent?: string
}

export function QuickActionButton({
  icon,
  label,
  description,
  href,
  external,
  accent = 'var(--primary)',
}: QuickActionButtonProps) {
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className="group flex items-center gap-3 rounded-xl border p-3 transition-all duration-200 hover:-translate-y-0.5"
      style={{ borderColor: 'var(--border)', background: 'transparent' }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = accent
        e.currentTarget.style.background = `color-mix(in oklch, ${accent} 8%, transparent)`
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.background = 'transparent'
      }}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        style={{ background: `color-mix(in oklch, ${accent} 15%, transparent)`, color: accent }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{label}</p>
        {description && (
          <p className="text-[11px] truncate" style={{ color: 'var(--muted-foreground)' }}>
            {description}
          </p>
        )}
      </div>
      <ArrowUpRight
        className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
        style={{ color: 'var(--muted-foreground)' }}
      />
    </a>
  )
}

// ─── Inline Spinner ───────────────────────────────────────────────────────

export function InlineSpinner({ className = 'h-4 w-4' }: { className?: string }) {
  return <Loader2 className={`${className} animate-spin`} style={{ color: 'var(--muted-foreground)' }} />
}