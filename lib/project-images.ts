/**
 * lib/project-images.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Part 3 — Advanced Project Image Management
 * ---------------------------------------------------------------------------
 * Handles upload, deletion, and management of project images using Vercel Blob.
 * 
 * Features:
 *   • Upload images to Vercel Blob with project-specific organization
 *   • Delete images from Blob when removed from projects
 *   • Track image usage to prevent orphaned files
 *   • Support for multiple image types (PNG, JPEG, WebP, GIF)
 *   • Dual-backend storage: Vercel Blob (prod) / local public folder (dev)
 *   • Automatic cleanup of unused images
 *
 * Storage pattern mirrors lib/resume.ts and lib/messages.ts:
 *   • Production: Vercel Blob + Upstash Redis for metadata
 *   • Local dev:  .data/project-images.json + /public/project-images/
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { promises as fs } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

// ─── Types ────────────────────────────────────────────────────────────────

export interface ProjectImageMetadata {
  /** Public URL of the image */
  url: string
  /** Original filename */
  fileName: string
  /** Size in bytes */
  size: number
  /** MIME type */
  contentType: string
  /** Vercel Blob pathname (for deletion) */
  blobPathname?: string
  /** Project this image belongs to */
  projectNumber?: string
  /** Upload timestamp */
  uploadedAt: string
}

export interface ImageUploadResult {
  url: string
  fileName: string
  size: number
  contentType: string
  blobPathname?: string
}

export interface ImageDeleteResult {
  success: boolean
  message?: string
}

interface ProjectImagesStore {
  images: ProjectImageMetadata[]
}

const LOCAL_DIR = path.join(process.cwd(), '.data')
const LOCAL_META_FILE = path.join(LOCAL_DIR, 'project-images.json')
const LOCAL_IMAGES_DIR = path.join(process.cwd(), 'public', 'project-images')
const REDIS_KEY = 'portfolio:project-images'

// Supported image types
const SUPPORTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]

const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10MB per image

// ─── Backend detection ────────────────────────────────────────────────────

function hasRedis(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

function hasBlob(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN)
}

async function getRedis() {
  const { Redis } = await import('@upstash/redis')
  return new Redis({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
  })
}

// ─── Local JSON fallback helpers ──────────────────────────────────────────

async function readLocalStore(): Promise<ProjectImagesStore> {
  try {
    const raw = await fs.readFile(LOCAL_META_FILE, 'utf-8')
    return JSON.parse(raw) as ProjectImagesStore
  } catch {
    return { images: [] }
  }
}

async function writeLocalStore(store: ProjectImagesStore) {
  await fs.mkdir(LOCAL_DIR, { recursive: true })
  await fs.writeFile(LOCAL_META_FILE, JSON.stringify(store, null, 2), 'utf-8')
}

// ─── Unified read/write ───────────────────────────────────────────────────

async function readStore(): Promise<ProjectImagesStore> {
  if (hasRedis()) {
    const redis = await getRedis()
    const data = await redis.get<ProjectImagesStore>(REDIS_KEY)
    return data ?? { images: [] }
  }
  return readLocalStore()
}

async function writeStore(store: ProjectImagesStore) {
  if (hasRedis()) {
    const redis = await getRedis()
    await redis.set(REDIS_KEY, store)
  } else {
    await writeLocalStore(store)
  }
}

// ─── Validation helpers ───────────────────────────────────────────────────

export function validateImageFile(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'No file provided.' }
  }

  if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Unsupported file type: ${file.type}. Supported types: PNG, JPEG, WebP, GIF, SVG.`,
    }
  }

  if (file.size === 0) {
    return { valid: false, error: 'The uploaded file is empty.' }
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return {
      valid: false,
      error: `File is too large. Max size is ${Math.floor(MAX_IMAGE_SIZE / (1024 * 1024))}MB.`,
    }
  }

  return { valid: true }
}

// ─── Upload functions ─────────────────────────────────────────────────────

/**
 * Upload a project image to storage (Vercel Blob in prod, local disk in dev)
 */
export async function uploadProjectImage(
  buffer: Buffer,
  fileName: string,
  contentType: string,
  projectNumber?: string,
): Promise<ImageUploadResult> {
  let url: string
  let blobPathname: string | undefined
  const uniqueId = randomUUID().slice(0, 8)
  const safeFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
  const uploadFileName = `${projectNumber ? `${projectNumber}-` : ''}${uniqueId}-${safeFileName}`

  if (hasBlob()) {
    const { put } = await import('@vercel/blob')
    const blob = await put(`project-images/${uploadFileName}`, buffer, {
      access: 'public',
      addRandomSuffix: false,
      contentType,
    })
    url = blob.url
    blobPathname = blob.pathname
  } else {
    // Local dev fallback: write to /public/project-images/
    await fs.mkdir(LOCAL_IMAGES_DIR, { recursive: true })
    const localPath = path.join(LOCAL_IMAGES_DIR, uploadFileName)
    await fs.writeFile(localPath, buffer)
    url = `/project-images/${uploadFileName}`
  }

  // Store metadata
  const metadata: ProjectImageMetadata = {
    url,
    fileName: uploadFileName,
    size: buffer.byteLength,
    contentType,
    blobPathname,
    projectNumber,
    uploadedAt: new Date().toISOString(),
  }

  const store = await readStore()
  store.images.push(metadata)
  await writeStore(store)

  return {
    url,
    fileName: uploadFileName,
    size: buffer.byteLength,
    contentType,
    blobPathname,
  }
}

/**
 * Upload multiple project images in sequence
 */
export async function uploadProjectImages(
  files: Array<{ buffer: Buffer; fileName: string; contentType: string }>,
  projectNumber?: string,
): Promise<ImageUploadResult[]> {
  const results: ImageUploadResult[] = []
  
  for (const file of files) {
    const result = await uploadProjectImage(
      file.buffer,
      file.fileName,
      file.contentType,
      projectNumber,
    )
    results.push(result)
  }

  return results
}

// ─── Delete functions ─────────────────────────────────────────────────────

/**
 * Delete a project image from storage and remove metadata
 */
export async function deleteProjectImage(url: string): Promise<ImageDeleteResult> {
  const store = await readStore()
  const imageIndex = store.images.findIndex((img) => img.url === url)

  if (imageIndex === -1) {
    return { success: false, message: 'Image not found in metadata store.' }
  }

  const image = store.images[imageIndex]

  // Delete from Blob storage if applicable
  if (image.blobPathname && hasBlob()) {
    try {
      const { del } = await import('@vercel/blob')
      await del(image.blobPathname)
    } catch (err) {
      console.error('Failed to delete blob:', err)
      // Continue with metadata removal even if blob deletion fails
    }
  } else if (!image.blobPathname && image.url.startsWith('/project-images/')) {
    // Local dev: delete from public folder
    try {
      const localPath = path.join(process.cwd(), 'public', image.url)
      await fs.unlink(localPath)
    } catch (err) {
      console.error('Failed to delete local image:', err)
    }
  }

  // Remove from metadata
  store.images.splice(imageIndex, 1)
  await writeStore(store)

  return { success: true }
}

/**
 * Delete multiple project images
 */
export async function deleteProjectImages(urls: string[]): Promise<ImageDeleteResult[]> {
  const results: ImageDeleteResult[] = []
  
  for (const url of urls) {
    const result = await deleteProjectImage(url)
    results.push(result)
  }

  return results
}

// ─── Query functions ──────────────────────────────────────────────────────

/**
 * Get all project images metadata
 */
export async function getAllProjectImages(): Promise<ProjectImageMetadata[]> {
  const store = await readStore()
  return store.images
}

/**
 * Get images for a specific project
 */
export async function getProjectImages(projectNumber: string): Promise<ProjectImageMetadata[]> {
  const store = await readStore()
  return store.images.filter((img) => img.projectNumber === projectNumber)
}

/**
 * Get storage status for UI warnings
 */
export function getImageStorageStatus() {
  return {
    blobConfigured: hasBlob(),
    redisConfigured: hasRedis(),
  }
}

/**
 * Clean up orphaned images (images not referenced by any project)
 */
export async function cleanupOrphanedImages(activeUrls: string[]): Promise<number> {
  const store = await readStore()
  const orphans = store.images.filter((img) => !activeUrls.includes(img.url))
  
  let cleanedCount = 0
  for (const orphan of orphans) {
    const result = await deleteProjectImage(orphan.url)
    if (result.success) {
      cleanedCount++
    }
  }

  return cleanedCount
}