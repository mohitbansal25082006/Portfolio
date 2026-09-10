'use client'

/**
 * components/admin/stat-card.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Part 3.2 (Dashboard upgrade) — Rich, interactive stat card
 * ---------------------------------------------------------------------------
 * Upgrades the previous inline StatCard with:
 *   • Big animated numeric value (count-up on first paint)
 *   • Optional sparkline trend row
 *   • Optional delta badge vs previous period
 *   • Optional progress bar (e.g. "unread / total")
 *   • Optional secondary metric line (e.g. "+3 this week")
 *   • Whole card is a link when `href` is provided, with hover lift + shine
 *   • Zero external deps; every colour from theme tokens
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { Sparkline, DeltaBadge, MiniStackedBar } from './charts'

// ─── Count-up hook (respects reduced motion) ──────────────────────────────

function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0)
  const raf = useRef<number | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) {
      setValue(target)
      return
    }
    if (started.current) {
      setValue(target)
      return
    }
    started.current = true
    const start = performance.now()
    const from = 0

    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      // easeOutCubic
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(Math.round(from + (target - from) * eased))
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current)
    }
  }, [target, duration])

  return value
}

// ─── Types ────────────────────────────────────────────────────────────────

export interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: number | string
  /** Optional suffix appended to numeric values, e.g. "k", "%" */
  valueSuffix?: string
  /** Sub-line under the value, e.g. "12 unread · 4 replied" */
  sub?: string
  /** Tint colour — defaults to primary */
  accent?: string
  loading?: boolean
  href?: string
  /** Sparkline data (any numeric array) */
  trend?: number[]
  /** Delta vs previous period, shown as a badge */
  deltaPct?: number | null
  deltaInvert?: boolean
  /** Progress bar 0..100 — used for e.g. read ratio */
  progress?: number
  /** Custom stacked bar segments (overrides `progress`) */
  segments?: { label: string; value: number; color: string }[]
  /** Small pill shown top-right of card, e.g. a status word */
  badge?: { label: string; color: string }
  /** Render value as a static string (skip count-up) */
  static?: boolean
}

// ─── Formatter ────────────────────────────────────────────────────────────

function formatDisplay(v: number | string, suffix?: string): string {
  if (typeof v === 'string') return v
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M${suffix ?? ''}`
  if (v >= 10_000) return `${(v / 1_000).toFixed(1)}k${suffix ?? ''}`
  if (v >= 1_000) return `${(v / 1_000).toFixed(2)}k${suffix ?? ''}`
  return `${v}${suffix ?? ''}`
}

// ─── Card ─────────────────────────────────────────────────────────────────

export function StatCard({
  icon,
  label,
  value,
  valueSuffix,
  sub,
  accent = 'var(--primary)',
  loading,
  href,
  trend,
  deltaPct,
  deltaInvert,
  progress,
  segments,
  badge,
  static: isStatic,
}: StatCardProps) {
  const numericTarget = typeof value === 'number' ? value : 0
  const counted = useCountUp(numericTarget)
  const display = isStatic || typeof value === 'string' ? value : counted

  const inner = (
    <div
      className="stat-card group relative overflow-hidden rounded-2xl border p-4 sm:p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg h-full flex flex-col"
      style={{
        background: 'var(--card)',
        borderColor: 'var(--border)',
        cursor: href ? 'pointer' : 'default',
      }}
    >
      <div className="stat-card-shine" />

      {/* Top row: icon + badge */}
      <div className="relative z-10 mb-3 flex items-start justify-between gap-2">
        <div
          className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: `color-mix(in oklch, ${accent} 15%, transparent)`, color: accent }}
        >
          {icon}
        </div>
        {badge ? (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide"
            style={{
              background: `color-mix(in oklch, ${badge.color} 18%, transparent)`,
              color: badge.color,
            }}
          >
            {badge.label}
          </span>
        ) : (
          href && (
            <ArrowUpRight
              className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100"
              style={{ color: 'var(--muted-foreground)' }}
            />
          )
        )}
      </div>

      {/* Value + label */}
      <div className="relative z-10">
        <p className="text-2xl sm:text-3xl font-bold tabular-nums leading-none tracking-tight">
          {loading ? (
            <span
              className="inline-block h-6 w-16 rounded-md animate-pulse"
              style={{ background: 'var(--muted)' }}
            />
          ) : (
            formatDisplay(display as number | string, valueSuffix)
          )}
        </p>
        <p className="mt-1.5 text-[13px] sm:text-sm font-medium">{label}</p>
        {sub && (
          <p className="mt-0.5 text-[11px] sm:text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
            {sub}
          </p>
        )}
      </div>

      {/* Bottom visual row */}
      <div className="relative z-10 mt-auto pt-3 space-y-2">
        {trend && trend.length > 1 && (
          <Sparkline data={trend} height={28} stroke={accent} />
        )}

        {segments && segments.length > 0 ? (
          <MiniStackedBar segments={segments} height={6} ariaLabel={`${label} breakdown`} />
        ) : progress !== undefined ? (
          <div className="w-full overflow-hidden rounded-full" style={{ height: 6, background: 'var(--muted)' }}>
            <div
              className="h-full transition-all duration-700"
              style={{
                width: `${Math.max(0, Math.min(100, progress))}%`,
                background: accent,
              }}
            />
          </div>
        ) : null}

        {deltaPct !== undefined && (
          <div className="flex items-center gap-2">
            <DeltaBadge value={deltaPct} invert={deltaInvert} />
            <span className="text-[10px] font-mono uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
              vs prev
            </span>
          </div>
        )}
      </div>
    </div>
  )

  return href ? (
    <a href={href} className="block h-full">
      {inner}
    </a>
  ) : (
    <div className="h-full">{inner}</div>
  )
}