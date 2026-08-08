// ============================================================================
//  components/github-section.tsx
//  Real-time GitHub section — pulls live data via useGitHubProfile (hits
//  /api/github, backed by lib/github.ts + GitHub's GraphQL/REST APIs).
//
//  Features:
//   - Total (all-time) contributions instead of a static followers count
//   - Year selector for the contribution calendar
//   - Month labels above the heatmap
//   - Click a day to see that day's actual commits, linked to GitHub
//   - All languages (byte-weighted) / Pinned repos (max 4) / Recent activity
//     in one
//     equal-height row on desktop
//   - Fully responsive down to small mobile widths
// ============================================================================

'use client'

import { useMemo, useRef, useState } from 'react'
import {
  BookOpen, ChevronDown, Flame, GitCommitHorizontal, GitFork, GitPullRequest,
  RefreshCw, Star, Tag, TrendingUp, Users, AlertTriangle, X, ExternalLink,
} from 'lucide-react'
import { useGitHubProfile } from '@/hooks/use-github-profile'
import { useDayCommits } from '@/hooks/use-day-commits'
import type { RecentActivityItem } from '@/lib/github'

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  // Lightweight local reveal to avoid a circular import with portfolio-site.tsx.
  return (
    <div className="reveal is-visible" style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  )
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

const activityIcon: Record<RecentActivityItem['type'], typeof Star> = {
  commit: GitPullRequest,
  pr: GitPullRequest,
  issue: AlertTriangle,
  star: Star,
  repo: BookOpen,
  release: Tag,
  fork: GitFork,
  review: GitPullRequest,
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** GitHub-brand-accurate contribution level colors, theme-tinted via oklch mix. */
function levelColor(level: number): string {
  if (level === 0) return 'var(--muted)'
  const lightness = 0.42 + level * 0.11
  return `oklch(${lightness} 0.16 130)`
}

export function GitHubSection({ username }: { username: string }) {
  const [selectedYear, setSelectedYear] = useState<number | undefined>(undefined)
  const [yearMenuOpen, setYearMenuOpen] = useState(false)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const { data, loading, error, refetch } = useGitHubProfile(username, selectedYear)
  const dayCommits = useDayCommits(username, selectedDay)
  const yearMenuRef = useRef<HTMLDivElement>(null)

  const handleRefresh = async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }

  // Group days into week-columns for the heatmap grid.
  const weeks = useMemo(() => {
    if (!data) return []
    const days = data.contributionData
    const out: typeof days[] = []
    for (let i = 0; i < days.length; i += 7) {
      out.push(days.slice(i, i + 7))
    }
    return out
  }, [data])

  // Compute which week-column each month label should sit above, so labels
  // line up with the heatmap without repeating.
  const monthMarkers = useMemo(() => {
    const markers: { weekIndex: number; label: string }[] = []
    let lastMonth = -1
    weeks.forEach((week, wi) => {
      const firstDayOfWeek = week[0]
      if (!firstDayOfWeek) return
      const month = new Date(`${firstDayOfWeek.date}T00:00:00`).getMonth()
      if (month !== lastMonth) {
        markers.push({ weekIndex: wi, label: MONTH_LABELS[month] })
        lastMonth = month
      }
    })
    return markers
  }, [weeks])

  const displayedYear = data?.selectedYear ?? selectedYear ?? new Date().getFullYear()
  const pinnedRepos = data?.pinnedRepos.slice(0, 4) ?? []

  return (
    <section id="github" className="mx-auto max-w-350 px-5 py-24 md:px-10 md:py-36 lg:px-14">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <Reveal>
          <div>
            <p className="eyebrow">Open source · Live</p>
            <h2 className="mt-4 max-w-xl text-4xl font-medium tracking-[-0.05em] md:text-6xl">
              Code in<br /><span className="text-muted-foreground">the open.</span>
            </h2>
          </div>
        </Reveal>
        <Reveal delay={80}>
          <div className="flex flex-wrap items-center gap-3">
            {data && (
              <span className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
                <span className="size-1.5 rounded-full bg-primary" />
                Synced {timeAgo(data.fetchedAt)}
              </span>
            )}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading || refreshing}
              className="grid size-9 shrink-0 place-items-center rounded-full border border-border transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
              aria-label="Refresh GitHub data"
              title="Refresh GitHub data"
            >
              <RefreshCw className={`size-3.5 ${loading || refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </Reveal>
      </div>

      {/* ERROR STATE */}
      {error && !data && (
        <Reveal delay={100}>
          <div className="mt-14 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-destructive/40 bg-destructive/5 px-6 py-16 text-center">
            <AlertTriangle className="size-6 text-destructive" />
            <p className="font-mono text-xs tracking-[0.12em] text-destructive uppercase">Couldn&apos;t load live GitHub data</p>
            <p className="max-w-sm text-sm text-muted-foreground">{error}</p>
            <button
              type="button"
              onClick={handleRefresh}
              className="mt-2 inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 font-mono text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
            >
              Try again <RefreshCw className="size-3.5" />
            </button>
          </div>
        </Reveal>
      )}

      {/* LOADING SKELETON */}
      {loading && !data && (
        <div className="mt-14 animate-pulse space-y-6">
          <div className="grid gap-4 sm:gap-6 grid-cols-2 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 rounded-2xl border border-border bg-muted/30" />
            ))}
          </div>
          <div className="h-48 rounded-2xl border border-border bg-muted/30" />
          <div className="grid gap-6 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-64 rounded-2xl border border-border bg-muted/30" />
            ))}
          </div>
        </div>
      )}

      {/* LIVE CONTENT */}
      {data && (
        <>
          <div className="mt-14 grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-4">
            {[
              { label: 'Repositories', value: data.publicRepos, icon: BookOpen },
              { label: 'Stars earned', value: data.totalStars, icon: Star },
              { label: 'Total contributions', value: data.allTimeContributions, icon: Users },
              { label: 'Longest streak', value: data.longestStreak, icon: Flame, suffix: ' days' },
            ].map((s, i) => (
              <Reveal key={s.label} delay={i * 60}>
                <div className="flex h-full items-center gap-3 rounded-2xl border border-border bg-muted/30 p-4 backdrop-blur-sm sm:gap-4 sm:p-6">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary sm:size-11">
                    <s.icon className="size-4 sm:size-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-2xl font-semibold sm:text-3xl">
                      {s.value.toLocaleString()}
                      {s.suffix ?? ''}
                    </div>
                    <p className="font-mono text-[9px] tracking-[0.1em] text-muted-foreground uppercase sm:text-[10px] sm:tracking-[0.14em]">{s.label}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          {/* CONTRIBUTION HEATMAP */}
          <Reveal delay={80}>
            <div className="mt-6 rounded-2xl border border-border bg-muted/30 p-4 backdrop-blur-sm sm:p-6 md:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="size-4 shrink-0 text-primary" />
                  <p className="font-mono text-[10px] tracking-[0.12em] uppercase sm:text-[11px] sm:tracking-[0.14em]">
                    {data.totalContributions.toLocaleString()} contributions in {displayedYear}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {/* YEAR SELECTOR */}
                  {data.contributionYears.length > 0 && (
                    <div className="relative" ref={yearMenuRef}>
                      <button
                        type="button"
                        onClick={() => setYearMenuOpen((v) => !v)}
                        className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 font-mono text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
                      >
                        {displayedYear} <ChevronDown className={`size-3 transition-transform ${yearMenuOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {yearMenuOpen && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setYearMenuOpen(false)} />
                          <div className="absolute right-0 z-20 mt-2 max-h-56 min-w-24 overflow-y-auto rounded-xl border border-border bg-card p-1.5 shadow-2xl backdrop-blur-xl">
                            {data.contributionYears.map((y) => (
                              <button
                                key={y}
                                onClick={() => { setSelectedYear(y); setYearMenuOpen(false) }}
                                className={`block w-full rounded-lg px-3 py-1.5 text-left font-mono text-[11px] tracking-[0.1em] uppercase transition-colors hover:bg-muted ${y === displayedYear ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}
                              >
                                {y}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  <a
                    href={data.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase hover:text-foreground"
                  >
                    @{data.username} ↗
                  </a>
                </div>
              </div>

              {data.currentStreak > 0 && (
                <p className="mt-2 flex items-center gap-1.5 font-mono text-[10px] tracking-[0.12em] text-primary uppercase">
                  <Flame className="size-3.5" /> {data.currentStreak}-day current streak
                </p>
              )}

              {/* HEATMAP + MONTH LABELS (horizontally scrollable on small screens) */}
              <div className="mt-5 overflow-x-auto pb-2">
                <div className="inline-block min-w-full">
                  <div className="relative mb-1 h-4" style={{ minWidth: weeks.length * 13 }}>
                    {monthMarkers.map((m) => (
                      <span
                        key={`${m.label}-${m.weekIndex}`}
                        className="absolute font-mono text-[9px] tracking-[0.08em] text-muted-foreground uppercase"
                        style={{ left: m.weekIndex * 13 }}
                      >
                        {m.label}
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-[3px]" style={{ minWidth: weeks.length * 13 }}>
                    {weeks.map((week, wi) => (
                      <div key={wi} className="flex flex-col gap-[3px]">
                        {week.map((day) => (
                          <button
                            key={day.date}
                            type="button"
                            onClick={() => setSelectedDay(day.date)}
                            className="size-[10px] rounded-[2px] transition-transform hover:scale-125 focus-visible:scale-125 focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary"
                            style={{ background: levelColor(day.level) }}
                            title={`${day.count} contribution${day.count === 1 ? '' : 's'} on ${day.date} — click to view commits`}
                            aria-label={`${day.count} contributions on ${day.date}`}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="font-mono text-[9px] tracking-[0.1em] text-muted-foreground/70 uppercase sm:text-[10px]">
                  Click a square to see that day&apos;s commits
                </p>
                <div className="flex items-center gap-2 font-mono text-[9px] tracking-[0.14em] text-muted-foreground uppercase">
                  <span>Less</span>
                  {[0, 1, 2, 3, 4].map((l) => (
                    <span key={l} className="size-[10px] rounded-[2px]" style={{ background: levelColor(l) }} />
                  ))}
                  <span>More</span>
                </div>
              </div>
            </div>
          </Reveal>

          {/* TOP LANGUAGES / PINNED REPOS / RECENT ACTIVITY — equal height row */}
          <div className="mt-6 grid gap-6 md:grid-cols-3 md:items-stretch">
            {/* ALL LANGUAGES (byte-weighted, full breakdown) */}
            <Reveal>
              <div className="flex h-full flex-col rounded-2xl border border-border bg-muted/30 p-6 backdrop-blur-sm md:p-8">
                <p className="font-mono text-[11px] tracking-[0.14em] uppercase">All languages</p>
                {data.topLanguages.length === 0 ? (
                  <p className="mt-5 text-xs text-muted-foreground">No language data available yet.</p>
                ) : (
                  <>
                    <div className="mt-5 flex h-2.5 overflow-hidden rounded-full">
                      {data.topLanguages.map((l) => (
                        <div key={l.name} style={{ width: `${l.pct}%`, background: l.color }} title={`${l.name} — ${l.pct}%`} />
                      ))}
                    </div>
                    <div className="mt-5 max-h-64 space-y-2 overflow-y-auto pr-1">
                      {data.topLanguages.map((l) => (
                        <div key={l.name} className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-2 text-foreground/80">
                            <span className="size-2.5 shrink-0 rounded-full" style={{ background: l.color }} /> {l.name}
                          </span>
                          <span className="font-mono text-muted-foreground">{l.pct}%</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </Reveal>

            {/* PINNED REPOS (max 4) */}
            <Reveal delay={80}>
              <div className="flex h-full flex-col rounded-2xl border border-border bg-muted/30 p-6 backdrop-blur-sm md:p-8">
                <p className="font-mono text-[11px] tracking-[0.14em] uppercase">Pinned repositories</p>
                <div className="mt-5 flex-1 space-y-3">
                  {pinnedRepos.length === 0 && (
                    <p className="text-xs text-muted-foreground">No pinned repositories yet — pin some on GitHub to feature them here.</p>
                  )}
                  {pinnedRepos.map((r) => (
                    <a
                      key={r.name}
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-xl border border-border p-4 transition-colors hover:border-primary/50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">{r.name}</span>
                        <span className="flex shrink-0 items-center gap-2 font-mono text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1"><Star className="size-3" /> {r.stars}</span>
                          <span className="flex items-center gap-1"><GitFork className="size-3" /> {r.forks}</span>
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.desc}</p>
                      <span className="mt-2 inline-flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                        <span className="size-2 rounded-full" style={{ background: r.languageColor }} /> {r.language}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            </Reveal>

            {/* RECENT ACTIVITY */}
            <Reveal delay={160}>
              <div className="flex h-full flex-col rounded-2xl border border-border bg-muted/30 p-6 backdrop-blur-sm md:p-8">
                <p className="font-mono text-[11px] tracking-[0.14em] uppercase">Recent activity</p>
                <div className="mt-5 flex-1 space-y-4">
                  {data.recentActivity.length === 0 && (
                    <p className="text-xs text-muted-foreground">No recent public activity found.</p>
                  )}
                  {data.recentActivity.map((a, i) => {
                    const Icon = activityIcon[a.type] ?? BookOpen
                    return (
                      <a key={i} href={a.url} target="_blank" rel="noreferrer" className="group flex gap-3">
                        <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                          <Icon className="size-3" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs leading-5 text-foreground/80 group-hover:text-foreground">{a.text}</p>
                          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground uppercase">{timeAgo(a.time)}</p>
                        </div>
                      </a>
                    )
                  })}
                </div>
              </div>
            </Reveal>
          </div>
        </>
      )}

      {/* DAY-COMMITS POPOVER (modal) */}
      {selectedDay && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-background/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setSelectedDay(null)}
        >
          <div
            className="max-h-[80vh] w-full overflow-y-auto rounded-t-2xl border border-border bg-card shadow-2xl sm:max-w-lg sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card px-5 py-4">
              <div>
                <p className="font-mono text-[10px] tracking-[0.12em] text-primary uppercase">Contribution activity</p>
                <h3 className="mt-1 text-sm font-medium">{formatDayLabel(selectedDay)}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDay(null)}
                className="grid size-8 shrink-0 place-items-center rounded-full border border-border transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="p-5">
              {dayCommits.loading && (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-14 animate-pulse rounded-xl border border-border bg-muted/30" />
                  ))}
                </div>
              )}

              {dayCommits.error && (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <AlertTriangle className="size-5 text-destructive" />
                  <p className="text-xs text-muted-foreground">{dayCommits.error}</p>
                </div>
              )}

              {!dayCommits.loading && !dayCommits.error && dayCommits.commits && dayCommits.commits.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <GitCommitHorizontal className="size-5 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">No public commits found for this day.</p>
                  <p className="text-[11px] text-muted-foreground/70">
                    Contributions can also include issues, PRs, and reviews that don&apos;t show up as commits here.
                  </p>
                </div>
              )}

              {!dayCommits.loading && dayCommits.commits && dayCommits.commits.length > 0 && (
                <ul className="space-y-2.5">
                  {dayCommits.commits.map((c) => (
                    <li key={c.sha}>
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noreferrer"
                        className="group flex items-start gap-3 rounded-xl border border-border p-3.5 transition-colors hover:border-primary/50"
                      >
                        <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                          <GitCommitHorizontal className="size-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs leading-5 text-foreground/90 group-hover:text-foreground">{c.message}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[10px] text-muted-foreground">
                            <span className="truncate">{c.repo}</span>
                            <span>·</span>
                            <span>{c.shortSha}</span>
                          </div>
                        </div>
                        <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}