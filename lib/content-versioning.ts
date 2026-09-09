/**
 * lib/content-versioning.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Part 2.10 — Content Version History & Backup System
 * Updated — Fixed double version creation on rollback
 * ---------------------------------------------------------------------------
 * Adds version control capabilities to the content management system:
 *   • Version history — every save creates a snapshot that can be restored
 *   • Rollback — restore any previous version with one click
 *   • Rename — give custom names to versions for easy identification
 *   • Delete — remove unwanted versions
 *   • JSON backup — export full backup of content + settings + messages
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
import { getContent, saveContent, type ContentStore } from '@/lib/content-store'
import { getSettings, updateSettings, type SiteSettings } from '@/lib/settings'
import { getAllMessages, type ContactMessage } from '@/lib/messages'

// ─── Types ────────────────────────────────────────────────────────────────

export interface ContentVersion {
  id: string
  timestamp: string
  content: ContentStore
  /** Custom name for the version (user-editable) */
  name: string
  /** Optional note describing what changed */
  note?: string
  /** Number of changes since last version (for display) */
  changeCount?: number
}

export interface BackupBundle {
  version: string
  exportedAt: string
  content: ContentStore
  settings: SiteSettings
  messages: ContactMessage[]
  metadata: {
    exportSource: 'admin-backup'
    contentVersionsCount: number
  }
}

interface VersionStore {
  versions: ContentVersion[]
  maxVersions: number
}

const LOCAL_DIR = path.join(process.cwd(), '.data')
const LOCAL_VERSIONS_FILE = path.join(LOCAL_DIR, 'portfolio-content-versions.json')
const REDIS_VERSIONS_KEY = 'portfolio:content-versions'
const MAX_VERSIONS = 100 // Increased to allow more versions

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
    // Ensure all versions have the name field (backward compatibility)
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
      // Ensure all versions have the name field (backward compatibility)
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

// ─── Helper: Save content WITHOUT creating a version ─────────────────────

/**
 * Internal helper to save content without triggering version creation.
 * This is used during rollback to avoid double version creation.
 */
async function saveContentWithoutVersion(
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
    await redis.set('portfolio:content', next)
  } else {
    const LOCAL_FILE = path.join(LOCAL_DIR, 'portfolio-content.json')
    await fs.mkdir(LOCAL_DIR, { recursive: true })
    await fs.writeFile(LOCAL_FILE, JSON.stringify(next, null, 2), 'utf-8')
  }

  return next
}

// ─── Version Management ───────────────────────────────────────────────────

/**
 * Create a new version snapshot of the current content.
 * Called automatically after each successful content save.
 */
export async function createContentVersion(note?: string): Promise<ContentVersion> {
  const currentContent = await getContent()
  const store = await readVersionStore()
  
  const version: ContentVersion = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    content: JSON.parse(JSON.stringify(currentContent)),
    name: `Version ${new Date().toLocaleString()}`,
    note: note || 'Content update',
  }

  store.versions.unshift(version)
  
  // Trim to max versions
  if (store.versions.length > store.maxVersions) {
    store.versions = store.versions.slice(0, store.maxVersions)
  }

  await writeVersionStore(store)
  return version
}

/**
 * Get all versions, newest first.
 */
export async function getContentVersions(limit?: number): Promise<ContentVersion[]> {
  const store = await readVersionStore()
  return limit ? store.versions.slice(0, limit) : store.versions
}

/**
 * Get a specific version by ID.
 */
export async function getContentVersionById(id: string): Promise<ContentVersion | null> {
  const store = await readVersionStore()
  return store.versions.find(v => v.id === id) ?? null
}

/**
 * Rename a version with a custom name.
 */
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

/**
 * Delete a version by ID.
 */
export async function deleteContentVersion(id: string): Promise<boolean> {
  const store = await readVersionStore()
  const originalLength = store.versions.length
  store.versions = store.versions.filter(v => v.id !== id)
  
  if (store.versions.length === originalLength) {
    return false // Version not found
  }

  await writeVersionStore(store)
  return true
}

/**
 * Rollback to a specific version.
 * 
 * IMPORTANT FIX: This function now saves the content WITHOUT creating a version
 * during the save operation (using saveContentWithoutVersion), and then creates
 * exactly ONE new version snapshot of the rolled-back state. This prevents the
 * double version creation issue that was occurring before.
 */
export async function rollbackToVersion(versionId: string): Promise<ContentStore> {
  const version = await getContentVersionById(versionId)
  if (!version) {
    throw new Error('Version not found')
  }

  // Save the version content WITHOUT auto-creating a version
  // This avoids the double version creation issue
  const restored = await saveContentWithoutVersion({
    projects: version.content.projects,
    about: version.content.about,
    skillGroups: version.content.skillGroups,
    timeline: version.content.timeline,
  })

  // Now create exactly ONE new version snapshot representing the rolled-back state
  await createContentVersion(`Rolled back to: ${version.name}`)

  return restored
}

/**
 * Get version storage status for UI warnings.
 */
export function getVersionStorageStatus() {
  return { redisConfigured: hasRedis() }
}

// ─── Backup & Export ──────────────────────────────────────────────────────

/**
 * Create a complete backup bundle of all editable site data.
 */
export async function createBackupBundle(): Promise<BackupBundle> {
  const [content, settings, messages, versions] = await Promise.all([
    getContent(),
    getSettings(),
    getAllMessages(),
    getContentVersions(),
  ])

  const bundle: BackupBundle = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    content,
    settings,
    messages,
    metadata: {
      exportSource: 'admin-backup',
      contentVersionsCount: versions.length,
    },
  }

  return bundle
}

/**
 * Import a backup bundle and restore all data.
 */
export async function importBackupBundle(bundle: BackupBundle): Promise<{
  contentRestored: boolean
  settingsRestored: boolean
  messagesRestored: boolean
}> {
  const result = {
    contentRestored: false,
    settingsRestored: false,
    messagesRestored: false,
  }

  // Validate bundle structure
  if (!bundle || !bundle.content || !bundle.version) {
    throw new Error('Invalid backup file structure')
  }

  // Restore content
  if (bundle.content) {
    // Use saveContentWithoutVersion to avoid double version creation
    await saveContentWithoutVersion({
      projects: bundle.content.projects,
      about: bundle.content.about,
      skillGroups: bundle.content.skillGroups,
      timeline: bundle.content.timeline,
    })
    result.contentRestored = true
    
    // Create single version for the imported state
    await createContentVersion('Imported from backup')
  }

  // Restore settings
  if (bundle.settings) {
    await updateSettings(bundle.settings)
    result.settingsRestored = true
  }

  // Restore messages (if needed, implement message replacement)
  if (bundle.messages && Array.isArray(bundle.messages)) {
    // Note: Message import would require additional functions in lib/messages.ts
    // For now, we acknowledge messages exist but don't import them
    result.messagesRestored = false
  }

  return result
}