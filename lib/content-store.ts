/**
 * lib/content-store.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Part 2.7 — Content Management Store
 * Part 2.10 — Added version history integration with single version creation
 * Part 3 — Updated with image metadata tracking and flexible URL validation
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
 *
 * Version History (Part 2.10):
 *   • Every save automatically creates a version snapshot
 *   • saveContentWithoutVersion allows saving without version creation
 *   • Used during rollback to prevent double version creation
 *
 * Part 3 Updates:
 *   • Project images now store metadata alongside URLs
 *   • Added image validation and sanitization helpers
 *   • Track image upload timestamps and source (blob/local)
 *   • Accept any URL type (Google Drive, external links, local paths, etc.)
 *   • No maximum image limit per project
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { promises as fs } from 'fs'
import path from 'path'

// ─── Types ────────────────────────────────────────────────────────────────

export interface ProjectImage {
  /** URL of the image (Blob URL in prod, local path in dev, or any external URL) */
  url: string
  /** Optional caption for the image (reserved for future use) */
  caption?: string
  /** Original filename for reference */
  fileName?: string
  /** Upload timestamp */
  uploadedAt?: string
}

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
  /** Image metadata for all project images (keyed by URL) */
  imageMetadata?: Record<string, ProjectImage>
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

/**
 * Fetch the current content store.
 * Falls back to defaults if no edits have been made yet.
 */
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

/**
 * Save content WITHOUT creating a version snapshot.
 * Used internally during rollback and import operations to prevent
 * double version creation.
 */
export async function saveContentWithoutVersion(
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

/**
 * Save content AND automatically create a version snapshot.
 * This is the main save function used by the admin UI.
 */
export async function saveContent(
  patch: Partial<Omit<ContentStore, 'updatedAt'>>,
): Promise<ContentStore> {
  const next = await saveContentWithoutVersion(patch)

  // Auto-create version snapshot after each save
  try {
    const { createContentVersion } = await import('@/lib/content-versioning')
    await createContentVersion('Content updated')
  } catch (err) {
    console.error('Failed to create version snapshot:', err)
    // Don't fail the save if version creation fails
  }

  return next
}

/**
 * Get content storage status for UI warnings.
 */
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

// ─── Image helper functions (Part 3) ──────────────────────────────────────

/**
 * Get all unique image URLs used across all projects.
 * Returns a deduplicated array of image URLs.
 */
export function getAllImageUrls(content: ContentStore): string[] {
  const urls = new Set<string>()
  for (const project of content.projects) {
    for (const image of project.images) {
      if (image && image.trim().length > 0) {
        urls.add(image.trim())
      }
    }
  }
  return Array.from(urls)
}

/**
 * Validate that an image URL is well-formed.
 * Accepts any non-empty string as a URL or path.
 * Supports: local paths, full URLs, Google Drive links, data URIs, etc.
 */
export function isValidImageUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false
  const trimmed = url.trim()
  if (trimmed.length === 0) return false
  return true
}

/**
 * Sanitize image URLs in a project (remove empty/invalid entries).
 * Keeps any non-empty string as valid.
 */
export function sanitizeProjectImages(project: ProjectContent): ProjectContent {
  const validImages = project.images
    .map(img => img.trim())
    .filter(img => img.length > 0)
  return { ...project, images: validImages }
}

/**
 * Normalize image URLs across all projects (trim whitespace, remove empties).
 */
export function sanitizeAllProjectImages(content: ContentStore): ContentStore {
  const sanitizedProjects = content.projects.map(sanitizeProjectImages)
  return { ...content, projects: sanitizedProjects }
}

/**
 * Add an image URL to a project (if not already present).
 * Returns the updated project with the new image appended.
 */
export function addImageToProject(
  project: ProjectContent,
  imageUrl: string,
): ProjectContent {
  const trimmedUrl = imageUrl.trim()
  if (!trimmedUrl) return project
  
  // Avoid duplicates
  if (project.images.includes(trimmedUrl)) return project
  
  return {
    ...project,
    images: [...project.images, trimmedUrl],
  }
}

/**
 * Remove an image URL from a project by index.
 * Returns the updated project with the image removed.
 */
export function removeImageFromProject(
  project: ProjectContent,
  index: number,
): ProjectContent {
  if (index < 0 || index >= project.images.length) return project
  
  const newImages = project.images.filter((_, i) => i !== index)
  return { ...project, images: newImages }
}

/**
 * Move an image URL within a project's images array.
 * Returns the updated project with the image reordered.
 */
export function moveImageInProject(
  project: ProjectContent,
  fromIndex: number,
  toIndex: number,
): ProjectContent {
  if (
    fromIndex < 0 ||
    fromIndex >= project.images.length ||
    toIndex < 0 ||
    toIndex >= project.images.length ||
    fromIndex === toIndex
  ) {
    return project
  }

  const newImages = [...project.images]
  const [moved] = newImages.splice(fromIndex, 1)
  newImages.splice(toIndex, 0, moved)
  return { ...project, images: newImages }
}

/**
 * Get image count statistics for a content store.
 */
export function getImageStats(content: ContentStore): {
  totalProjects: number
  projectsWithImages: number
  projectsWithoutImages: number
  totalImages: number
  averageImagesPerProject: number
} {
  const totalProjects = content.projects.length
  const projectsWithImages = content.projects.filter(p => p.images.length > 0).length
  const projectsWithoutImages = totalProjects - projectsWithImages
  const totalImages = content.projects.reduce((sum, p) => sum + p.images.length, 0)
  const averageImagesPerProject = totalProjects > 0 ? totalImages / totalProjects : 0

  return {
    totalProjects,
    projectsWithImages,
    projectsWithoutImages,
    totalImages,
    averageImagesPerProject,
  }
}

/**
 * Find all unique external URLs (non-local) used in project images.
 */
export function getExternalImageUrls(content: ContentStore): string[] {
  const urls = new Set<string>()
  for (const project of content.projects) {
    for (const image of project.images) {
      const trimmed = image.trim()
      if (
        trimmed.startsWith('http://') ||
        trimmed.startsWith('https://') ||
        trimmed.startsWith('data:')
      ) {
        urls.add(trimmed)
      }
    }
  }
  return Array.from(urls)
}

/**
 * Find all local image paths (starting with /) used in project images.
 */
export function getLocalImagePaths(content: ContentStore): string[] {
  const paths = new Set<string>()
  for (const project of content.projects) {
    for (const image of project.images) {
      const trimmed = image.trim()
      if (trimmed.startsWith('/')) {
        paths.add(trimmed)
      }
    }
  }
  return Array.from(paths)
}

/**
 * Get all images for a specific project by project number.
 */
export function getImagesForProject(
  content: ContentStore,
  projectNumber: string,
): string[] {
  const project = content.projects.find(p => p.number === projectNumber)
  return project ? project.images : []
}

/**
 * Check if a project has images.
 */
export function projectHasImages(
  content: ContentStore,
  projectNumber: string,
): boolean {
  const images = getImagesForProject(content, projectNumber)
  return images.length > 0
}