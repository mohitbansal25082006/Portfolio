/**
 * lib/settings.ts
 *
 * Part 2.5 — Site Settings
 * Part 3.2 — Added full site pause/maintenance mode
 * ---------------------------------------------------------------------------
 * Handles storage for site-wide, editable-by-admin settings:
 *   - Maintenance mode (toggle site availability + banner message)
 *   - Full site pause (complete site takeover with animated maintenance screen)
 *   - Contact email shown on the public site
 *   - Availability status text (the "Open to Internships..." line)
 *   - Social links (github / linkedin / email / twitter / leetcode / custom)
 *
 * DUAL-BACKEND STORAGE (mirrors lib/messages.ts / lib/resume.ts pattern)
 * ---------------------------------------------------------------------------
 * Production (Vercel):
 *   - Upstash Redis via @upstash/redis, using the SAME KV_REST_API_URL /
 *     KV_REST_API_TOKEN already configured for messages + resume metadata.
 *     No new env vars needed.
 *
 * Local dev / fallback (no KV token configured):
 *   - JSON file at `.data/portfolio-settings.json`, same folder Part 2.2/2.4
 *     already gitignores.
 * ---------------------------------------------------------------------------
 */

import { promises as fs } from 'fs'
import path from 'path'

// ─── Types ────────────────────────────────────────────────────────────────

export interface SocialLinks {
  github: string
  linkedin: string
  email: string
  twitter: string
  leetcode: string
}

export interface SiteSettings {
  /** When true, the public site shows a maintenance banner at the top. */
  maintenanceMode: boolean
  /** Optional custom message shown in the maintenance banner. */
  maintenanceMessage: string
  /** Part 3.2 — When true, the ENTIRE site is replaced with a full-screen
   *  animated maintenance page. Overrides maintenanceMode. */
  sitePaused: boolean
  /** Part 3.2 — Title shown on the full-site maintenance screen. */
  sitePausedTitle: string
  /** Part 3.2 — Description shown on the full-site maintenance screen. */
  sitePausedMessage: string
  /** Contact email displayed across the site (hero, contact section, footer copy button). */
  contactEmail: string
  /** The short "Open to Internships & Collaborations" status line in the hero. */
  availabilityStatus: string
  /** Social links — same shape as siteConfig.social in lib/content.ts. */
  socialLinks: SocialLinks
  /** ISO timestamp of the last update, for display in the admin UI. */
  updatedAt: string
}

const LOCAL_DIR = path.join(process.cwd(), '.data')
const LOCAL_FILE = path.join(LOCAL_DIR, 'portfolio-settings.json')
const REDIS_KEY = 'portfolio:settings'

// ─── Backend detection (same convention as lib/messages.ts / lib/resume.ts) ──

function hasRedis(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

async function getRedis() {
  const { Redis } = await import('@upstash/redis')
  return new Redis({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
  })
}

// ─── Defaults — mirrors current static values in lib/content.ts ─────────────

function defaultSettings(): SiteSettings {
  return {
    maintenanceMode: false,
    maintenanceMessage: "We're currently making some improvements. Please check back shortly.",
    sitePaused: false,
    sitePausedTitle: 'Site Under Maintenance',
    sitePausedMessage: 'We are currently performing scheduled maintenance. We will be back shortly. Thank you for your patience!',
    contactEmail: 'mohitbansal25082006@gmail.com',
    availabilityStatus: 'Open to Internships & Collaborations',
    socialLinks: {
      github: 'https://github.com/mohitbansal25082006',
      linkedin: 'https://www.linkedin.com/in/mohit-bansal-383440315',
      email: 'mailto:mohitbansal2508@gmail.com',
      twitter: '',
      leetcode: 'https://leetcode.com/u/mohitbansal25082006/',
    },
    updatedAt: new Date(0).toISOString(),
  }
}

// ─── Local JSON fallback helpers ─────────────────────────────────────────────

async function readLocal(): Promise<SiteSettings | null> {
  try {
    const raw = await fs.readFile(LOCAL_FILE, 'utf-8')
    return JSON.parse(raw) as SiteSettings
  } catch {
    return null
  }
}

async function writeLocal(settings: SiteSettings) {
  await fs.mkdir(LOCAL_DIR, { recursive: true })
  await fs.writeFile(LOCAL_FILE, JSON.stringify(settings, null, 2), 'utf-8')
}

// ─── Merge helper — ensures partial/older saved records still validate ──────

function withDefaults(partial: Partial<SiteSettings> | null): SiteSettings {
  const defaults = defaultSettings()
  if (!partial) return defaults
  return {
    maintenanceMode: partial.maintenanceMode ?? defaults.maintenanceMode,
    maintenanceMessage: partial.maintenanceMessage ?? defaults.maintenanceMessage,
    sitePaused: partial.sitePaused ?? defaults.sitePaused,
    sitePausedTitle: partial.sitePausedTitle ?? defaults.sitePausedTitle,
    sitePausedMessage: partial.sitePausedMessage ?? defaults.sitePausedMessage,
    contactEmail: partial.contactEmail ?? defaults.contactEmail,
    availabilityStatus: partial.availabilityStatus ?? defaults.availabilityStatus,
    socialLinks: {
      github: partial.socialLinks?.github ?? defaults.socialLinks.github,
      linkedin: partial.socialLinks?.linkedin ?? defaults.socialLinks.linkedin,
      email: partial.socialLinks?.email ?? defaults.socialLinks.email,
      twitter: partial.socialLinks?.twitter ?? defaults.socialLinks.twitter,
      leetcode: partial.socialLinks?.leetcode ?? defaults.socialLinks.leetcode,
    },
    updatedAt: partial.updatedAt ?? defaults.updatedAt,
  }
}

// ─── Public API ───────────────────────────────────────────────────────────

/** Fetch current site settings. Always returns a fully-populated object. */
export async function getSettings(): Promise<SiteSettings> {
  if (hasRedis()) {
    const redis = await getRedis()
    const data = await redis.get<Partial<SiteSettings>>(REDIS_KEY)
    return withDefaults(data)
  }
  const local = await readLocal()
  return withDefaults(local)
}

/**
 * Update settings. Accepts a partial patch and merges it over the current
 * settings so the admin UI can save one section (e.g. just social links)
 * without needing to resend everything.
 */
export async function updateSettings(
  patch: Partial<Omit<SiteSettings, 'updatedAt'>>,
): Promise<SiteSettings> {
  const current = await getSettings()
  const next: SiteSettings = withDefaults({
    ...current,
    ...patch,
    socialLinks: {
      ...current.socialLinks,
      ...(patch.socialLinks ?? {}),
    },
    updatedAt: new Date().toISOString(),
  })

  if (hasRedis()) {
    const redis = await getRedis()
    await redis.set(REDIS_KEY, next)
  } else {
    await writeLocal(next)
  }

  return next
}

/** Which backend is actually configured — surfaced to the admin UI. */
export function getSettingsStorageStatus() {
  return {
    redisConfigured: hasRedis(),
  }
}