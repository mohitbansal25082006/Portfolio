/**
 * lib/content-store.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Part 2.7 — Content Management Store
 * ---------------------------------------------------------------------------
 * Dual-backend storage for dynamic content (projects, about, skills, timeline)
 * that the admin can edit from the Content Management page.
 *
 * This REPLACES the static exports in lib/content.ts as the source of truth
 * for the public site when edits exist. If no edits have been made yet,
 * the system falls back to the static defaults (which are the current
 * hardcoded values in lib/content.ts).
 *
 * Storage backends (mirrors lib/messages.ts / lib/settings.ts / lib/resume.ts):
 *   • Production: Upstash Redis (KV_REST_API_URL + KV_REST_API_TOKEN)
 *   • Local dev:  .data/portfolio-content.json
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { promises as fs } from 'fs'
import path from 'path'

// ─── Types ────────────────────────────────────────────────────────────────

export interface ProjectContent {
  number: string
  name: string
  mark: string
  year: string
  categories: string[]
  theme: string
  short: string
  problem: string
  features: string[]
  stack: string[]
  challenges: string
  metrics: string
  live: string
  github: string
  images: string[]
}

export interface AboutContent {
  college: string
  currentYear: string
  paragraphs: string[]
  interests: string[]
  pillars: Array<{ num: string; label: string; text: string }>
}

export interface SkillGroup {
  category: string
  items: string[]
}

export interface TimelineEntry {
  year: string
  title: string
  subtitle: string
}

export interface ContentStore {
  projects: ProjectContent[]
  about: AboutContent
  skillGroups: SkillGroup[]
  timeline: TimelineEntry[]
  updatedAt: string
}

const LOCAL_DIR = path.join(process.cwd(), '.data')
const LOCAL_FILE = path.join(LOCAL_DIR, 'portfolio-content.json')
const REDIS_KEY = 'portfolio:content'

// ─── Backend detection ────────────────────────────────────────────────────

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

// ─── Local JSON fallback ──────────────────────────────────────────────────

async function readLocal(): Promise<ContentStore | null> {
  try {
    const raw = await fs.readFile(LOCAL_FILE, 'utf-8')
    return JSON.parse(raw) as ContentStore
  } catch {
    return null
  }
}

async function writeLocal(store: ContentStore) {
  await fs.mkdir(LOCAL_DIR, { recursive: true })
  await fs.writeFile(LOCAL_FILE, JSON.stringify(store, null, 2), 'utf-8')
}

// ─── Default content (imported from static lib/content.ts) ────────────────

// We'll import statically to avoid circular deps
async function getDefaultContent(): Promise<ContentStore> {
  const { projects, about, skillGroups, timeline } = await import('@/lib/content')
  return {
    projects: JSON.parse(JSON.stringify(projects)),
    about: JSON.parse(JSON.stringify(about)),
    skillGroups: JSON.parse(JSON.stringify(skillGroups)),
    timeline: JSON.parse(JSON.stringify(timeline)),
    updatedAt: new Date(0).toISOString(),
  }
}

// ─── Public API ───────────────────────────────────────────────────────────

export async function getContent(): Promise<ContentStore> {
  if (hasRedis()) {
    const redis = await getRedis()
    const data = await redis.get<ContentStore>(REDIS_KEY)
    if (data) return data
    return getDefaultContent()
  }
  const local = await readLocal()
  return local ?? getDefaultContent()
}

export async function saveContent(
  patch: Partial<Omit<ContentStore, 'updatedAt'>>,
): Promise<ContentStore> {
  const current = await getContent()
  const next: ContentStore = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  }

  if (hasRedis()) {
    const redis = await getRedis()
    await redis.set(REDIS_KEY, next)
  } else {
    await writeLocal(next)
  }

  return next
}

export function getContentStorageStatus() {
  return { redisConfigured: hasRedis() }
}

// ─── Convenience helpers for partial updates ──────────────────────────────

export async function updateProjects(projects: ProjectContent[]): Promise<ContentStore> {
  return saveContent({ projects })
}

export async function updateAbout(about: AboutContent): Promise<ContentStore> {
  return saveContent({ about })
}

export async function updateSkillGroups(skillGroups: SkillGroup[]): Promise<ContentStore> {
  return saveContent({ skillGroups })
}

export async function updateTimeline(timeline: TimelineEntry[]): Promise<ContentStore> {
  return saveContent({ timeline })
}