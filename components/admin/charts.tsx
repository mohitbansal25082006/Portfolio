'use client'

/**
 * components/admin/charts.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Part 3.2 (Dashboard upgrade) — Theme-aware, dependency-free SVG charts
 *
 * REVISION:
 *   • Exported DISTINCT_DEVICE_COLORS — 3 visibly different hues so the
 *     Devices donut never renders two identical slices.
 *   • DonutChart now falls back through that palette when a slice's color
 *     is missing or would collide with a previous slice.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useId, useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'

// ─── Distinct colour palette for categorical charts ───────────────────────

/**
 * Three visually distinct, theme-agnostic hues. Kept as literal oklch
 * values (not var(--…)) so two slices can never collapse to the same colour
 * when the active theme reuses --primary and --accent.
 */
export const DISTINCT_DEVICE_COLORS = {
  desktop: 'oklch(0.72 0.18 250)', // blue
  mobile: 'oklch(0.78 0.20 145)', // green
  tablet: 'oklch(0.75 0.20 45)', // amber
} as const

export const DISTINCT_PALETTE = [
  'oklch(0.72 0.18 250)',
  'oklch(0.78 0.20 145)',
  'oklch(0.75 0.20 45)',
  'oklch(0.72 0.20 330)',
  'oklch(0.70 0.18 190)',
  'oklch(0.74 0.20 20)',
]

// ─── Shared helpers ───────────────────────────────────────────────────────

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function niceMax(value: number): number {
  if (value <= 4) return 4
  const pow = Math.pow(10, Math.floor(Math.log10(value)))
  const norm = value / pow
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10
  return step * pow
}

// ─── Sparkline ────────────────────────────────────────────────────────────

export interface SparklineProps {
  data: number[]
  height?: number
  stroke?: string
  fill?: string
  ariaLabel?: string
  showDot?: boolean
}

export function Sparkline({
  data,
  height = 44,
  stroke = 'var(--primary)',
  fill = 'color-mix(in oklch, var(--primary) 22%, transparent)',
  ariaLabel = 'Trend sparkline',
  showDot = true,
}: SparklineProps) {
  const gradientId = useId()
  const width = 120

  const { path, area, lastX, lastY } = useMemo(() => {
    if (!data || data.length === 0) {
      return { path: '', area: '', lastX: 0, lastY: height }
    }
    const max = Math.max(1, ...data)
    const stepX = data.length > 1 ? width / (data.length - 1) : width
    const points = data.map((v, i) => {
      const x = i * stepX
      const y = height - (v / max) * (height - 4) - 2
      return [x, y] as const
    })

    let d = `M ${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}`
    for (let i = 1; i < points.length; i++) {
      const [px, py] = points[i - 1]
      const [cx, cy] = points[i]
      const mx = (px + cx) / 2
      d += ` Q ${mx.toFixed(2)} ${py.toFixed(2)} ${cx.toFixed(2)} ${cy.toFixed(2)}`
    }
    const last = points[points.length - 1]
    const areaPath = `${d} L ${last[0].toFixed(2)} ${height} L 0 ${height} Z`
    return { path: d, area: areaPath, lastX: last[0], lastY: last[1] }
  }, [data, height])

  if (!data || data.length === 0) {
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
        role="img"
        aria-label="No data"
      >
        <line
          x1="0"
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="var(--border)"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
      </svg>
    )
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height }}
      role="img"
      aria-label={ariaLabel}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fill} />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={path} fill="none" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" />
      {showDot && (
        <circle cx={lastX} cy={lastY} r="2.5" fill={stroke}>
          <animate attributeName="r" values="2.5;3.5;2.5" dur="2s" repeatCount="indefinite" />
        </circle>
      )}
    </svg>
  )
}

// ─── Delta Badge ──────────────────────────────────────────────────────────

export interface DeltaBadgeProps {
  value: number | null
  suffix?: string
  invert?: boolean
  size?: 'sm' | 'md'
}

export function DeltaBadge({ value, suffix = '%', invert = false, size = 'sm' }: DeltaBadgeProps) {
  const isFlat = value === null || value === 0
  const isUp = (value ?? 0) > 0
  const good = invert ? !isUp : isUp

  const color = isFlat
    ? 'var(--muted-foreground)'
    : good
      ? 'oklch(0.72 0.18 150)'
      : 'oklch(0.68 0.2 25)'
  const bg = isFlat
    ? 'color-mix(in oklch, var(--muted-foreground) 14%, transparent)'
    : good
      ? 'color-mix(in oklch, oklch(0.72 0.18 150) 16%, transparent)'
      : 'color-mix(in oklch, oklch(0.68 0.2 25) 16%, transparent)'

  const Icon = isFlat ? Minus : isUp ? ArrowUpRight : ArrowDownRight

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium tabular-nums ${
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
      }`}
      style={{ background: bg, color }}
      aria-label={
        isFlat ? 'No change' : `${isUp ? 'Up' : 'Down'} ${Math.abs(value ?? 0)}${suffix}`
      }
    >
      <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      {isFlat ? 'flat' : `${Math.abs(value ?? 0)}${suffix}`}
    </span>
  )
}

// ─── Interactive Bar Chart ────────────────────────────────────────────────

export interface BarChartProps {
  data: { label: string; value: number; sublabel?: string }[]
  height?: number
  ariaLabel?: string
  barColor?: string
  barColorHover?: string
  formatValue?: (v: number) => string
  showXLabels?: boolean
}

export function BarChart({
  data,
  height = 180,
  ariaLabel = 'Bar chart',
  barColor = 'color-mix(in oklch, var(--primary) 55%, transparent)',
  barColorHover = 'var(--primary)',
  formatValue = v => String(v),
  showXLabels = true,
}: BarChartProps) {
  const [hovered, setHovered] = useState<number | null>(null)
  const max = niceMax(Math.max(1, ...data.map(d => d.value)))
  const n = data.length || 1
  const labelEvery = n > 14 ? Math.ceil(n / 7) : 1

  return (
    <div className="w-full" role="img" aria-label={ariaLabel}>
      <div className="relative" style={{ height }}>
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
          {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
            <div
              key={i}
              className="border-t"
              style={{
                borderColor:
                  p === 0 ? 'var(--border)' : 'color-mix(in oklch, var(--border) 45%, transparent)',
                borderStyle: p === 0 ? 'solid' : 'dashed',
              }}
            >
              <span
                className="absolute -translate-y-1/2 text-[9px] font-mono tabular-nums"
                style={{ color: 'var(--muted-foreground)', left: 0 }}
              >
                {formatValue(Math.round(max * (1 - p)))}
              </span>
            </div>
          ))}
        </div>

        <div className="absolute inset-0 flex items-end gap-[3px] pl-6">
          {data.map((d, i) => {
            const h = max > 0 ? (d.value / max) * 100 : 0
            const isHover = hovered === i
            return (
              <button
                key={`${d.label}-${i}`}
                type="button"
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(i)}
                onBlur={() => setHovered(null)}
                className="group relative flex-1 min-w-0 rounded-t-md transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                style={{
                  height: `${Math.max(h, d.value > 0 ? 3 : 1.5)}%`,
                  background: isHover ? barColorHover : barColor,
                  boxShadow: isHover
                    ? '0 0 0 1px var(--primary), 0 6px 18px -6px color-mix(in oklch, var(--primary) 60%, transparent)'
                    : undefined,
                  minHeight: 2,
                }}
                aria-label={`${d.label}: ${formatValue(d.value)}`}
              />
            )
          })}
        </div>

        {hovered !== null && data[hovered] && (
          <div
            className="pointer-events-none absolute z-20 min-w-[110px] rounded-lg border px-2.5 py-1.5 text-xs shadow-xl"
            style={{
              background: 'var(--popover)',
              borderColor: 'var(--border)',
              color: 'var(--popover-foreground)',
              left: `calc(1.5rem + ${(hovered + 0.5) * (100 / n)}% - 55px)`,
              bottom: `calc(${clamp((data[hovered].value / max) * 100, 4, 92)}% + 8px)`,
            }}
          >
            <div className="font-medium whitespace-nowrap">{data[hovered].sublabel ?? data[hovered].label}</div>
            <div className="font-mono tabular-nums" style={{ color: 'var(--primary)' }}>
              {formatValue(data[hovered].value)}
            </div>
          </div>
        )}
      </div>

      {showXLabels && (
        <div className="mt-2 flex gap-[3px] pl-6">
          {data.map((d, i) => (
            <div
              key={`x-${d.label}-${i}`}
              className="flex-1 min-w-0 text-center text-[9px] font-mono"
              style={{ color: 'var(--muted-foreground)' }}
            >
              {i % labelEvery === 0 ? d.label : ''}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Donut Chart (with distinct-colour guarantee) ─────────────────────────

export interface DonutSlice {
  label: string
  value: number
  color: string
}

export interface DonutChartProps {
  slices: DonutSlice[]
  size?: number
  thickness?: number
  centerLabel?: string
  centerSub?: string
  ariaLabel?: string
}

export function DonutChart({
  slices,
  size = 148,
  thickness = 16,
  centerLabel,
  centerSub,
  ariaLabel = 'Donut chart',
}: DonutChartProps) {
  const [hovered, setHovered] = useState<number | null>(null)

  // Guarantee each slice has a unique colour — if two slices would collide
  // (or a slice is missing a colour), replace with the next distinct palette
  // entry that isn't already in use.
  const safeSlices = useMemo(() => {
    const used = new Set<string>()
    return slices.map((s, i) => {
      let color = s.color
      if (!color || used.has(color)) {
        color = DISTINCT_PALETTE.find(c => !used.has(c)) ?? DISTINCT_PALETTE[i % DISTINCT_PALETTE.length]
      }
      used.add(color)
      return { ...s, color }
    })
  }, [slices])

  const total = safeSlices.reduce((s, d) => s + d.value, 0)
  const r = (size - thickness) / 2
  const c = size / 2
  const circumference = 2 * Math.PI * r

  let acc = 0
  const segs = safeSlices.map((s, i) => {
    const frac = total > 0 ? s.value / total : 0
    const dash = frac * circumference
    const seg = {
      i,
      dash,
      offset: -acc * circumference,
      color: s.color,
      label: s.label,
      value: s.value,
      pct: Math.round(frac * 100),
    }
    acc += frac
    return seg
  })

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4" role="img" aria-label={ariaLabel}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke="var(--muted)"
            strokeWidth={thickness}
            opacity={0.4}
          />
          {segs.map(seg => (
            <circle
              key={seg.i}
              cx={c}
              cy={c}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={hovered === seg.i ? thickness + 3 : thickness}
              strokeDasharray={`${seg.dash} ${circumference - seg.dash}`}
              strokeDashoffset={seg.offset}
              strokeLinecap="butt"
              className="transition-all duration-200 cursor-pointer"
              onMouseEnter={() => setHovered(seg.i)}
              onMouseLeave={() => setHovered(null)}
              opacity={hovered === null || hovered === seg.i ? 1 : 0.35}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-lg font-bold tabular-nums">
            {hovered !== null ? `${segs[hovered].pct}%` : (centerLabel ?? total)}
          </span>
          <span
            className="text-[10px] font-mono uppercase tracking-wider"
            style={{ color: 'var(--muted-foreground)' }}
          >
            {hovered !== null ? segs[hovered].label : (centerSub ?? 'total')}
          </span>
        </div>
      </div>

      <div className="flex-1 min-w-0 w-full space-y-1.5">
        {segs.map(seg => (
          <button
            key={seg.i}
            type="button"
            onMouseEnter={() => setHovered(seg.i)}
            onMouseLeave={() => setHovered(null)}
            className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-xs transition-colors text-left"
            style={{ background: hovered === seg.i ? 'var(--muted)' : 'transparent' }}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: seg.color }} />
            <span className="flex-1 truncate capitalize">{seg.label}</span>
            <span className="font-mono tabular-nums font-medium">{seg.value}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Progress Ring ────────────────────────────────────────────────────────

export interface ProgressRingProps {
  value: number
  size?: number
  thickness?: number
  color?: string
  trackColor?: string
  label?: string
  sublabel?: string
}

export function ProgressRing({
  value,
  size = 84,
  thickness = 8,
  color = 'var(--primary)',
  trackColor = 'var(--muted)',
  label,
  sublabel,
}: ProgressRingProps) {
  const v = clamp(value, 0, 100)
  const r = (size - thickness) / 2
  const c = size / 2
  const circ = 2 * Math.PI * r
  const dash = (v / 100) * circ

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={c} cy={c} r={r} fill="none" stroke={trackColor} strokeWidth={thickness} opacity={0.5} />
          <circle
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={thickness}
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeLinecap="round"
            className="transition-all duration-700"
            style={{ filter: `drop-shadow(0 0 4px ${color})` }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold tabular-nums">{Math.round(v)}%</span>
        </div>
      </div>
      {label && <span className="text-xs font-medium">{label}</span>}
      {sublabel && (
        <span
          className="text-[10px] font-mono uppercase tracking-wider"
          style={{ color: 'var(--muted-foreground)' }}
        >
          {sublabel}
        </span>
      )}
    </div>
  )
}

// ─── Mini Stacked Bar ─────────────────────────────────────────────────────

export interface MiniStackedBarProps {
  segments: { label: string; value: number; color: string }[]
  height?: number
  ariaLabel?: string
}

export function MiniStackedBar({ segments, height = 8, ariaLabel = 'Breakdown' }: MiniStackedBarProps) {
  const total = segments.reduce((s, d) => s + d.value, 0) || 1
  return (
    <div
      className="w-full overflow-hidden rounded-full flex"
      style={{ height, background: 'var(--muted)' }}
      role="img"
      aria-label={ariaLabel}
    >
      {segments.map((s, i) => (
        <div
          key={i}
          className="h-full transition-all duration-500"
          style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
          title={`${s.label}: ${s.value}`}
        />
      ))}
    </div>
  )
}