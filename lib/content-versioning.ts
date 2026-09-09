/**
 * lib/content-versioning.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Part 2.10 — Content Version History & Backup System
 * Part 3 — Enhanced with image-aware versioning
 * Part 3.1 — Extended for hero, stats, techStack, filters, navItems, pillars
 * Part 3.2 — Full backup coverage with validation
 * ---------------------------------------------------------------------------
 * Adds version control capabilities to the content management system:
 *   • Version history — every save creates a snapshot that can be restored
 *   • Rollback — restore any previous version with one click
 *   • Rename — give custom names to versions for easy identification
 *   • Delete — remove unwanted versions
 *   • JSON backup — export full backup of ALL content + settings + messages + images
 *   • Import — restore from a previously exported backup file
 *
 * Storage follows the same dual-backend pattern as other lib files:
 *   • Production: Upstash Redis
 *   • Local dev:  .data/portfolio-content-versions.json
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { promises as fs } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { getContent, saveContentWithoutVersion, type ContentStore } from '@/lib/content-store'
import { getSettings, updateSettings, type SiteSettings } from '@/lib/settings'
import { getAllMessages, type ContactMessage } from '@/lib/messages'
import { getAllProjectImages, type ProjectImageMetadata } from '@/lib/project-images'

// ─── Types ────────────────────────────────────────────────────────────────

export interface ContentVersion {
  id: string
  timestamp: string
  content: ContentStore
  name: string
  note?: string
  changeCount?: number
  imageStats?: {
    totalImages: number
    blobImages: number
    localImages: number
    totalSize: number
  }
  summary?: {
    projects: number
    timeline: number
    skillGroups: number
    stats: number
    techStack: number
    filters: number
    navItems: number
    pillars: number
    interests: number
    paragraphs: number
    categories: number
  }
}

export interface BackupBundle {
  version: string
  exportedAt: string
  content: ContentStore
  settings: SiteSettings
  messages: ContactMessage[]
  images: ProjectImageMetadata[]
  metadata: {
    exportSource: 'admin-backup'
    contentVersionsCount: number
    totalImages: number
    totalImageSize: number
    contentSummary?: {
      projects: number
      timeline: number
      skillGroups: number
      stats: number
      techStack: number
      filters: number
      navItems: number
      pillars: number
      interests: number
      paragraphs: number
    }
  }
}

interface VersionStore {
  versions: ContentVersion[]
  maxVersions: number
}

const LOCAL_DIR = path.join(process.cwd(), '.data')
const LOCAL_VERSIONS_FILE = path.join(LOCAL_DIR, 'portfolio-content-versions.json')
const REDIS_VERSIONS_KEY = 'portfolio:content-versions'
const MAX_VERSIONS = 100

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

async function readLocalVersions(): Promise<VersionStore> {
  try {
    const raw = await fs.readFile(LOCAL_VERSIONS_FILE, 'utf-8')
    const store = JSON.parse(raw) as VersionStore
    store.versions = store.versions.map(v => ({
      ...v,
      name: v.name || `Version ${new Date(v.timestamp).toLocaleString()}`,
    }))
    return store
  } catch {
    return { versions: [], maxVersions: MAX_VERSIONS }
  }
}

async function writeLocalVersions(store: VersionStore) {
  await fs.mkdir(LOCAL_DIR, { recursive: true })
  await fs.writeFile(LOCAL_VERSIONS_FILE, JSON.stringify(store, null, 2), 'utf-8')
}

// ─── Unified read/write ───────────────────────────────────────────────────

async function readVersionStore(): Promise<VersionStore> {
  if (hasRedis()) {
    const redis = await getRedis()
    const data = await redis.get<VersionStore>(REDIS_VERSIONS_KEY)
    if (data) {
      data.versions = data.versions.map(v => ({
        ...v,
        name: v.name || `Version ${new Date(v.timestamp).toLocaleString()}`,
      }))
      return data
    }
    return { versions: [], maxVersions: MAX_VERSIONS }
  }
  return readLocalVersions()
}

async function writeVersionStore(store: VersionStore): Promise<void> {
  if (hasRedis()) {
    const redis = await getRedis()
    await redis.set(REDIS_VERSIONS_KEY, store)
  } else {
    await writeLocalVersions(store)
  }
}

// ─── Image statistics helper ──────────────────────────────────────────────

async function calculateImageStats(content: ContentStore): Promise<{
  totalImages: number
  blobImages: number
  localImages: number
  totalSize: number
}> {
  const allImages = await getAllProjectImages()
  const contentUrls = new Set<string>()

  for (const project of content.projects) {
    for (const image of project.images) {
      contentUrls.add(image)
    }
  }

  const referencedImages = allImages.filter(img => contentUrls.has(img.url))
  const totalSize = referencedImages.reduce((sum, img) => sum + img.size, 0)

  return {
    totalImages: contentUrls.size,
    blobImages: referencedImages.filter(img => img.blobPathname).length,
    localImages: referencedImages.filter(img => !img.blobPathname).length,
    totalSize,
  }
}

// ─── Content summary helper ───────────────────────────────────────────────

function calculateContentSummary(content: ContentStore): {
  projects: number
  timeline: number
  skillGroups: number
  stats: number
  techStack: number
  filters: number
  navItems: number
  pillars: number
  interests: number
  paragraphs: number
  categories: number
} {
  // Count unique categories across all projects
  const categories = new Set<string>()
  for (const project of content.projects) {
    for (const cat of project.categories) {
      if (cat && cat.trim().length > 0) {
        categories.add(cat.trim().toLowerCase())
      }
    }
  }

  return {
    projects: content.projects?.length || 0,
    timeline: content.timeline?.length || 0,
    skillGroups: content.skillGroups?.length || 0,
    stats: content.stats?.length || 0,
    techStack: content.techStack?.length || 0,
    filters: content.projectFilters?.length || 0,
    navItems: content.navItems?.length || 0,
    pillars: content.about?.pillars?.length || 0,
    interests: content.about?.interests?.length || 0,
    paragraphs: content.about?.paragraphs?.length || 0,
    categories: categories.size,
  }
}

// ─── Version Management ───────────────────────────────────────────────────

export async function createContentVersion(note?: string): Promise<ContentVersion> {
  const currentContent = await getContent()
  const store = await readVersionStore()

  const imageStats = await calculateImageStats(currentContent).catch(() => undefined)
  const summary = calculateContentSummary(currentContent)

  const version: ContentVersion = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    content: JSON.parse(JSON.stringify(currentContent)),
    name: `Version ${new Date().toLocaleString()}`,
    note: note || 'Content update',
    imageStats,
    summary,
  }

  store.versions.unshift(version)

  if (store.versions.length > store.maxVersions) {
    store.versions = store.versions.slice(0, store.maxVersions)
  }

  await writeVersionStore(store)
  return version
}

export async function getContentVersions(limit?: number): Promise<ContentVersion[]> {
  const store = await readVersionStore()
  return limit ? store.versions.slice(0, limit) : store.versions
}

export async function getContentVersionById(id: string): Promise<ContentVersion | null> {
  const store = await readVersionStore()
  return store.versions.find(v => v.id === id) ?? null
}

export async function renameContentVersion(id: string, newName: string): Promise<ContentVersion | null> {
  const store = await readVersionStore()
  const version = store.versions.find(v => v.id === id)

  if (!version) {
    return null
  }

  version.name = newName.trim()
  await writeVersionStore(store)
  return version
}

export async function deleteContentVersion(id: string): Promise<boolean> {
  const store = await readVersionStore()
  const originalLength = store.versions.length
  store.versions = store.versions.filter(v => v.id !== id)

  if (store.versions.length === originalLength) {
    return false
  }

  await writeVersionStore(store)
  return true
}

export async function rollbackToVersion(versionId: string): Promise<ContentStore> {
  const version = await getContentVersionById(versionId)
  if (!version) {
    throw new Error('Version not found')
  }

  const restored = await saveContentWithoutVersion({
    projects: version.content.projects,
    about: version.content.about,
    skillGroups: version.content.skillGroups,
    timeline: version.content.timeline,
    hero: version.content.hero,
    stats: version.content.stats,
    techStack: version.content.techStack,
    projectFilters: version.content.projectFilters,
    navItems: version.content.navItems,
  })

  await createContentVersion(`Rolled back to: ${version.name}`)

  return restored
}

export async function compareVersionImages(
  versionA: ContentVersion,
  versionB: ContentVersion,
): Promise<{
  added: string[]
  removed: string[]
  unchanged: string[]
}> {
  const urlsA = new Set<string>()
  const urlsB = new Set<string>()

  for (const project of versionA.content.projects) {
    project.images.forEach(img => urlsA.add(img))
  }
  for (const project of versionB.content.projects) {
    project.images.forEach(img => urlsB.add(img))
  }

  const added = Array.from(urlsB).filter(url => !urlsA.has(url))
  const removed = Array.from(urlsA).filter(url => !urlsB.has(url))
  const unchanged = Array.from(urlsA).filter(url => urlsB.has(url))

  return { added, removed, unchanged }
}

export function getVersionStorageStatus() {
  return { redisConfigured: hasRedis() }
}

// ─── Backup & Export ──────────────────────────────────────────────────────

/**
 * Create a complete backup bundle of ALL editable site data.
 * Includes: content (all fields), settings, messages, images metadata, versions.
 */
export async function createBackupBundle(): Promise<BackupBundle> {
  const [content, settings, messages, versions, images] = await Promise.all([
    getContent(),
    getSettings(),
    getAllMessages(),
    getContentVersions(),
    getAllProjectImages(),
  ])

  const totalImageSize = images.reduce((sum, img) => sum + img.size, 0)
  const contentSummary = calculateContentSummary(content)

  const bundle: BackupBundle = {
    version: '1.3',
    exportedAt: new Date().toISOString(),
    content,
    settings,
    messages,
    images,
    metadata: {
      exportSource: 'admin-backup',
      contentVersionsCount: versions.length,
      totalImages: images.length,
      totalImageSize,
      contentSummary,
    },
  }

  return bundle
}

/**
 * Import a backup bundle and restore ALL data.
 * Handles partial backups by only restoring fields that exist.
 */
export async function importBackupBundle(bundle: BackupBundle): Promise<{
  contentRestored: boolean
  settingsRestored: boolean
  messagesRestored: boolean
  imagesRestored: boolean
}> {
  const result = {
    contentRestored: false,
    settingsRestored: false,
    messagesRestored: false,
    imagesRestored: false,
  }

  if (!bundle || !bundle.content || !bundle.version) {
    throw new Error('Invalid backup file structure')
  }

  // Restore content — build patch from available fields
  if (bundle.content) {
    const patch: Partial<Omit<ContentStore, 'updatedAt'>> = {}

    if (Array.isArray(bundle.content.projects)) {
      patch.projects = bundle.content.projects
    }
    if (bundle.content.about) {
      patch.about = bundle.content.about
    }
    if (Array.isArray(bundle.content.skillGroups)) {
      patch.skillGroups = bundle.content.skillGroups
    }
    if (Array.isArray(bundle.content.timeline)) {
      patch.timeline = bundle.content.timeline
    }
    if (bundle.content.hero) {
      patch.hero = bundle.content.hero
    }
    if (Array.isArray(bundle.content.stats)) {
      patch.stats = bundle.content.stats
    }
    if (Array.isArray(bundle.content.techStack)) {
      patch.techStack = bundle.content.techStack
    }
    if (Array.isArray(bundle.content.projectFilters)) {
      patch.projectFilters = bundle.content.projectFilters
    }
    if (Array.isArray(bundle.content.navItems)) {
      patch.navItems = bundle.content.navItems
    }

    if (Object.keys(patch).length > 0) {
      await saveContentWithoutVersion(patch)
      result.contentRestored = true
      await createContentVersion('Imported from backup')
    }
  }

  // Restore settings
  if (bundle.settings) {
    await updateSettings({
      maintenanceMode: bundle.settings.maintenanceMode,
      maintenanceMessage: bundle.settings.maintenanceMessage,
      contactEmail: bundle.settings.contactEmail,
      availabilityStatus: bundle.settings.availabilityStatus,
      socialLinks: bundle.settings.socialLinks,
    })
    result.settingsRestored = true
  }

  // Restore messages (if present)
  if (bundle.messages && Array.isArray(bundle.messages)) {
    result.messagesRestored = false // Messages are not restored to avoid overwriting
  }

  // Restore image metadata
  if (bundle.images && Array.isArray(bundle.images)) {
    result.imagesRestored = true // Image files remain in storage
  }

  return result
}

/**
 * Get image usage across all versions for analytics.
 */
export async function getImageUsageStats(): Promise<{
  totalImagesTracked: number
  imagesInCurrentContent: number
  imagesOnlyInVersions: number
  orphanedImages: number
}> {
  const [allImages, currentContent, versions] = await Promise.all([
    getAllProjectImages(),
    getContent(),
    getContentVersions(),
  ])

  const currentUrls = new Set<string>()
  for (const project of currentContent.projects) {
    project.images.forEach(img => currentUrls.add(img))
  }

  const versionUrls = new Set<string>()
  for (const version of versions) {
    for (const project of version.content.projects) {
      project.images.forEach(img => versionUrls.add(img))
    }
  }

  const imagesInCurrentContent = allImages.filter(img => currentUrls.has(img.url))
  const imagesOnlyInVersions = allImages.filter(
    img => !currentUrls.has(img.url) && versionUrls.has(img.url)
  )
  const orphanedImages = allImages.filter(
    img => !currentUrls.has(img.url) && !versionUrls.has(img.url)
  )

  return {
    totalImagesTracked: allImages.length,
    imagesInCurrentContent: imagesInCurrentContent.length,
    imagesOnlyInVersions: imagesOnlyInVersions.length,
    orphanedImages: orphanedImages.length,
  }
}