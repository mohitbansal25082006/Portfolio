/**
 * lib/settings.ts
 *
 * Part 2.5 — Site Settings
 * ---------------------------------------------------------------------------
 * Handles storage for site-wide, editable-by-admin settings:
 *   - Maintenance mode (toggle site availability + banner message)
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
 *
 * Detection: identical strategy to lib/messages.ts and lib/resume.ts —
 * presence of `KV_REST_API_URL` + `KV_REST_API_TOKEN` selects the Redis
 * backend, otherwise falls back to the local JSON file.
 *
 * Defaults are seeded from the existing static values in lib/content.ts
 * (siteConfig.email, siteConfig.availability, siteConfig.social) so the
 * site behaves identically before any admin edit is ever made.
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
  /** When true, the public site shows a maintenance banner (or blocks access,
   *  depending on how strict you want it — see app/layout.tsx). */
  maintenanceMode: boolean
  /** Optional custom message shown in the maintenance banner. */
  maintenanceMessage: string
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
// Keeping these in sync with siteConfig means a fresh deploy with no settings
// saved yet behaves exactly like it did before Part 2.5.

function defaultSettings(): SiteSettings {
  return {
    maintenanceMode: false,
    maintenanceMessage: "We're currently making some improvements. Please check back shortly.",
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
// If a field is missing (e.g. settings were saved before a new field was
// added), fall back to the default rather than surfacing `undefined` to
// callers or the admin UI.

function withDefaults(partial: Partial<SiteSettings> | null): SiteSettings {
  const defaults = defaultSettings()
  if (!partial) return defaults
  return {
    maintenanceMode: partial.maintenanceMode ?? defaults.maintenanceMode,
    maintenanceMessage: partial.maintenanceMessage ?? defaults.maintenanceMessage,
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

/** Which backend is actually configured — surfaced to the admin UI so it can
 *  warn if settings would only persist locally (no Redis token configured). */
export function getSettingsStorageStatus() {
  return {
    redisConfigured: hasRedis(),
  }
}