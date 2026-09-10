/**
 * lib/dashboard-aggregator.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Part 3.2 (Dashboard upgrade) — Aggregated dashboard data source
 * ---------------------------------------------------------------------------
 * Pulls everything the /admin/dashboard home needs into ONE server-side call.
 *
 * REVISION:
 *   • Image counts / sizes read the SAME source the Content page reads
 *     (project.images + lib/project-images.ts) so the dashboard can never
 *     show 0 when the Content page shows >0.
 *   • `content.images` is now the deduped count of every non-empty image URL
 *     across all projects, falling back to the upload records when the store
 *     hasn't recorded URLs yet.
 *   • `content.imageBytes` sums sizes from both sources and is only >0 when
 *     at least one real byte size is known (never fabricated).
 *   • Settings block enriched with contactEmail + social link count.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { getSiteAnalytics, getSiteAnalyticsStorageStatus } from '@/lib/site-analytics'
import { getAllMessages, getMessageStats } from '@/lib/messages'
import { getResumeMeta, getResumeStorageStatus } from '@/lib/resume'
import { getContent, getContentStorageStatus } from '@/lib/content-store'
import { getContentVersions } from '@/lib/content-versioning'
import { getActiveSessions, getLoginAttempts, getSecurityStorageStatus } from '@/lib/admin-security'
import { getSettings, getSettingsStorageStatus } from '@/lib/settings'
import { getAllProjectImages } from '@/lib/project-images'

// ─── Types ────────────────────────────────────────────────────────────────

export interface DashboardActivityItem {
  id: string
  type: 'message' | 'login' | 'content' | 'resume' | 'security' | 'settings'
  title: string
  description: string
  timestamp: string
  tone?: 'positive' | 'neutral' | 'warning'
}

export interface DashboardHealthCheck {
  id: string
  label: string
  ok: boolean
  detail: string
}

export interface DashboardPayload {
  generatedAt: string
  period: 7 | 30

  analytics: {
    totalViews: number
    uniqueVisitors: number
    trend: { date: string; views: number }[]
    devices: { desktop: number; mobile: number; tablet: number }
    referrers: { source: string; views: number }[]
    previousTotalViews: number
    viewsDeltaPct: number | null
    storage: { redisConfigured: boolean }
  }

  messages: {
    total: number
    unread: number
    read: number
    replied: number
    recent: {
      id: string
      name: string
      email: string
      subject: string
      timestamp: string
      read: boolean
      replied: boolean
    }[]
  }

  resume: {
    downloadCount: number
    fileName: string
    size: number
    uploadedAt: string
    storage: { blobConfigured: boolean; redisConfigured: boolean }
  }

  content: {
    updatedAt: string
    projects: number
    timeline: number
    skillGroups: number
    techStack: number
    categories: number
    /** Deduped count of every non-empty image URL across all projects */
    images: number
    /**
     * Total bytes for the images, when known. Zero if none of the images
     * have a recorded size (URLs without metadata). Callers should hide the
     * "Size" cell entirely when this is 0.
     */
    imageBytes: number
    versions: number
    storage: { redisConfigured: boolean }
  }

  security: {
    activeSessions: number
    failedAttempts: number
    totalAttempts: number
    lastFailedAt: string | null
    storage: { redisConfigured: boolean }
  }

  settings: {
    maintenanceMode: boolean
    sitePaused: boolean
    availabilityStatus: string
    contactEmail: string
    socialLinksCount: number
    updatedAt: string
    storage: { redisConfigured: boolean }
  }

  activity: DashboardActivityItem[]
  health: DashboardHealthCheck[]

  _degraded?: boolean
}

// ─── Safe fallbacks ───────────────────────────────────────────────────────

const EMPTY_ANALYTICS: DashboardPayload['analytics'] = {
  totalViews: 0,
  uniqueVisitors: 0,
  trend: [],
  devices: { desktop: 0, mobile: 0, tablet: 0 },
  referrers: [],
  previousTotalViews: 0,
  viewsDeltaPct: null,
  storage: { redisConfigured: false },
}

const EMPTY_MESSAGES: DashboardPayload['messages'] = {
  total: 0,
  unread: 0,
  read: 0,
  replied: 0,
  recent: [],
}

const EMPTY_RESUME: DashboardPayload['resume'] = {
  downloadCount: 0,
  fileName: 'resume.pdf',
  size: 0,
  uploadedAt: new Date(0).toISOString(),
  storage: { blobConfigured: false, redisConfigured: false },
}

const EMPTY_CONTENT: DashboardPayload['content'] = {
  updatedAt: new Date(0).toISOString(),
  projects: 0,
  timeline: 0,
  skillGroups: 0,
  techStack: 0,
  categories: 0,
  images: 0,
  imageBytes: 0,
  versions: 0,
  storage: { redisConfigured: false },
}

const EMPTY_SECURITY: DashboardPayload['security'] = {
  activeSessions: 0,
  failedAttempts: 0,
  totalAttempts: 0,
  lastFailedAt: null,
  storage: { redisConfigured: false },
}

const EMPTY_SETTINGS: DashboardPayload['settings'] = {
  maintenanceMode: false,
  sitePaused: false,
  availabilityStatus: '',
  contactEmail: '',
  socialLinksCount: 0,
  updatedAt: new Date(0).toISOString(),
  storage: { redisConfigured: false },
}

function safeStatus<T>(fn: () => T, fallback: T): T {
  try {
    return fn()
  } catch {
    return fallback
  }
}

// ─── Image helpers ────────────────────────────────────────────────────────

/**
 * Collect every non-empty image URL across every project, deduped. This is
 * the authoritative count the dashboard shows — identical to what the
 * Content page iterates over when it lists images.
 */
function collectImageUrls(content: Awaited<ReturnType<typeof getContent>>): string[] {
  const urls = new Set<string>()
  for (const project of content.projects) {
    for (const img of project.images ?? []) {
      const trimmed = typeof img === 'string' ? img.trim() : ''
      if (trimmed) urls.add(trimmed)
    }
  }
  return Array.from(urls)
}

/**
 * Build a URL → byte-size map from every source we can find. Priority:
 *   1. lib/project-images.ts upload records (real blob sizes)
 *   2. content.imageMetadata written by the uploader
 * Missing URLs stay absent from the map (not defaulted to 0) so callers can
 * tell "known size" apart from "unknown size".
 */
function buildSizeMap(
  content: Awaited<ReturnType<typeof getContent>>,
  projectImageRecords: { url: string; size: number }[],
): Map<string, number> {
  const map = new Map<string, number>()

  for (const rec of projectImageRecords) {
    if (rec?.url && Number(rec.size) > 0) {
      map.set(rec.url, Number(rec.size))
    }
  }

  const meta = (content.imageMetadata ?? {}) as Record<string, { size?: number }>
  for (const [url, info] of Object.entries(meta)) {
    if (!map.has(url) && typeof info?.size === 'number' && info.size > 0) {
      map.set(url, info.size)
    }
  }

  return map
}

// ─── Main aggregator ──────────────────────────────────────────────────────

export async function getDashboardPayload(period: 7 | 30 = 7): Promise<DashboardPayload> {
  const generatedAt = new Date().toISOString()
  let degraded = false

  // ── Analytics (current window) ───────────────────────────────────────
  let analytics = EMPTY_ANALYTICS
  try {
    const site = await getSiteAnalytics(period)
    analytics = {
      ...analytics,
      totalViews: site.totalViews,
      uniqueVisitors: site.uniqueVisitors,
      trend: site.trend,
      devices: site.devices,
      referrers: site.referrers,
      storage: safeStatus(getSiteAnalyticsStorageStatus, { redisConfigured: false }),
    }
  } catch (err) {
    console.error('[dashboard] analytics failed:', err)
    degraded = true
  }

  // ── Analytics (previous window, for delta badge) ─────────────────────
  try {
    if (analytics.totalViews > 0 || period === 30) {
      const doubled = await getSiteAnalytics(period * 2)
      const currentSum = analytics.trend.reduce((s, d) => s + d.views, 0)
      const doubledSum = doubled.trend.reduce((s, d) => s + d.views, 0)
      const previousTotalViews = Math.max(0, doubledSum - currentSum)
      analytics.previousTotalViews = previousTotalViews
      if (previousTotalViews > 0) {
        analytics.viewsDeltaPct = Math.round(
          ((analytics.totalViews - previousTotalViews) / previousTotalViews) * 100,
        )
      }
    }
  } catch (err) {
    console.error('[dashboard] previous-window analytics failed (non-fatal):', err)
  }

  // ── Messages ─────────────────────────────────────────────────────────
  let messages = EMPTY_MESSAGES
  try {
    const [stats, all] = await Promise.all([getMessageStats(), getAllMessages()])
    messages = {
      total: stats.total,
      unread: stats.unread,
      read: stats.read,
      replied: stats.replied,
      recent: all.slice(0, 6).map(m => ({
        id: m.id,
        name: m.name,
        email: m.email,
        subject: m.subject,
        timestamp: m.timestamp,
        read: m.read,
        replied: m.replied,
      })),
    }
  } catch (err) {
    console.error('[dashboard] messages failed:', err)
    degraded = true
  }

  // ── Resume ───────────────────────────────────────────────────────────
  let resume = EMPTY_RESUME
  try {
    const meta = await getResumeMeta()
    resume = {
      downloadCount: meta.downloadCount,
      fileName: meta.fileName,
      size: meta.size,
      uploadedAt: meta.uploadedAt,
      storage: safeStatus(getResumeStorageStatus, { blobConfigured: false, redisConfigured: false }),
    }
  } catch (err) {
    console.error('[dashboard] resume failed:', err)
    degraded = true
  }

  // ── Content + images + versions ──────────────────────────────────────
  let content = EMPTY_CONTENT
  try {
    const [store, versions, projectImageRecords] = await Promise.all([
      getContent(),
      getContentVersions(200).catch(() => []),
      getAllProjectImages().catch(() => []),
    ])

    const categories = new Set<string>()
    for (const p of store.projects) {
      for (const c of p.categories ?? []) {
        const t = c?.trim().toLowerCase()
        if (t) categories.add(t)
      }
    }

    // Images: project.images is the source of truth (matches Content page).
    const imageUrls = collectImageUrls(store)
    const sizeMap = buildSizeMap(
      store,
      projectImageRecords.map(r => ({ url: r.url, size: r.size ?? 0 })),
    )

    // Bytes: only count real, known sizes. Never fabricate a 0 into a
    // meaningful number, and never invent bytes we don't have.
    let imageBytes = 0
    for (const url of imageUrls) {
      const size = sizeMap.get(url)
      if (typeof size === 'number' && size > 0) imageBytes += size
    }
    if (imageBytes === 0 && projectImageRecords.length > 0) {
      imageBytes = projectImageRecords.reduce(
        (s, r) => s + (Number(r.size) > 0 ? Number(r.size) : 0),
        0,
      )
    }

    content = {
      updatedAt: store.updatedAt,
      projects: store.projects.length,
      timeline: store.timeline.length,
      skillGroups: store.skillGroups.length,
      techStack: store.techStack.length,
      categories: categories.size,
      images: Math.max(imageUrls.length, projectImageRecords.length),
      imageBytes,
      versions: versions.length,
      storage: safeStatus(getContentStorageStatus, { redisConfigured: false }),
    }
  } catch (err) {
    console.error('[dashboard] content failed:', err)
    degraded = true
  }

  // ── Security ─────────────────────────────────────────────────────────
  let security = EMPTY_SECURITY
  try {
    const [sessions, attempts] = await Promise.all([getActiveSessions(), getLoginAttempts()])
    const failed = attempts.filter(a => !a.success)
    security = {
      activeSessions: sessions.length,
      failedAttempts: failed.length,
      totalAttempts: attempts.length,
      lastFailedAt: failed[0]?.timestamp ?? null,
      storage: safeStatus(getSecurityStorageStatus, { redisConfigured: false }),
    }
  } catch (err) {
    console.error('[dashboard] security failed:', err)
    degraded = true
  }

  // ── Settings ─────────────────────────────────────────────────────────
  let settings = EMPTY_SETTINGS
  try {
    const s = await getSettings()
    const socialLinksCount = Object.values(s.socialLinks ?? {}).filter(
      v => typeof v === 'string' && v.trim().length > 0,
    ).length
    settings = {
      maintenanceMode: s.maintenanceMode,
      sitePaused: s.sitePaused,
      availabilityStatus: s.availabilityStatus,
      contactEmail: s.contactEmail,
      socialLinksCount,
      updatedAt: s.updatedAt,
      storage: safeStatus(getSettingsStorageStatus, { redisConfigured: false }),
    }
  } catch (err) {
    console.error('[dashboard] settings failed:', err)
    degraded = true
  }

  // ── Combined activity feed ───────────────────────────────────────────
  const activity: DashboardActivityItem[] = []

  for (const m of messages.recent) {
    activity.push({
      id: `msg-${m.id}`,
      type: 'message',
      title: `New message from ${m.name}`,
      description: m.subject || '(no subject)',
      timestamp: m.timestamp,
      tone: m.read ? 'neutral' : 'positive',
    })
  }

  if (content.updatedAt && content.updatedAt !== new Date(0).toISOString()) {
    activity.push({
      id: 'content-update',
      type: 'content',
      title: 'Portfolio content updated',
      description: `${content.projects} projects · ${content.timeline} timeline entries`,
      timestamp: content.updatedAt,
      tone: 'neutral',
    })
  }

  if (resume.uploadedAt && resume.uploadedAt !== new Date(0).toISOString()) {
    activity.push({
      id: 'resume-update',
      type: 'resume',
      title: 'Resume updated',
      description: resume.fileName,
      timestamp: resume.uploadedAt,
      tone: 'neutral',
    })
  }

  if (security.lastFailedAt) {
    activity.push({
      id: 'security-fail',
      type: 'security',
      title: 'Failed login attempt',
      description: `${security.failedAttempts} failed attempt${security.failedAttempts === 1 ? '' : 's'} this week`,
      timestamp: security.lastFailedAt,
      tone: 'warning',
    })
  }

  if (settings.updatedAt && settings.updatedAt !== new Date(0).toISOString()) {
    activity.push({
      id: 'settings-update',
      type: 'settings',
      title: settings.sitePaused ? 'Site paused' : 'Settings updated',
      description: settings.sitePaused
        ? 'Public site is in maintenance mode'
        : `Availability: ${settings.availabilityStatus}`,
      timestamp: settings.updatedAt,
      tone: settings.sitePaused ? 'warning' : 'neutral',
    })
  }

  activity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  // ── Health checks ────────────────────────────────────────────────────
  const redisOk =
    analytics.storage.redisConfigured ||
    content.storage.redisConfigured ||
    security.storage.redisConfigured

  const health: DashboardHealthCheck[] = [
    {
      id: 'redis',
      label: 'Persistent storage',
      ok: redisOk,
      detail: redisOk ? 'Upstash Redis connected' : 'Local dev fallback — data won’t persist on Vercel',
    },
    {
      id: 'blob',
      label: 'Blob storage',
      ok: resume.storage.blobConfigured,
      detail: resume.storage.blobConfigured
        ? 'Vercel Blob connected'
        : 'Resume uploads fall back to local disk',
    },
    {
      id: 'site',
      label: 'Public site',
      ok: !settings.sitePaused,
      detail: settings.sitePaused
        ? 'Full-site maintenance screen is LIVE'
        : settings.maintenanceMode
          ? 'Maintenance banner is showing'
          : 'Live and accepting visitors',
    },
    {
      id: 'content',
      label: 'Content versioning',
      ok: content.versions > 0,
      detail:
        content.versions > 0
          ? `${content.versions} version${content.versions === 1 ? '' : 's'} saved`
          : 'No versions yet — first edit will create one',
    },
  ]

  return {
    generatedAt,
    period,
    analytics,
    messages,
    resume,
    content,
    security,
    settings,
    activity: activity.slice(0, 12),
    health,
    ...(degraded ? { _degraded: true } : {}),
  }
}