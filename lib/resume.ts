/**
 * lib/resume.ts
 *
 * Part 2.4 — Resume Management
 * ---------------------------------------------------------------------------
 * Handles storage + metadata for the site's resume PDF.
 *
 * Why not just overwrite /public/resume.pdf on upload?
 * Vercel's production filesystem is read-only at runtime (each request may
 * even hit a different, ephemeral instance), so writing to /public from an
 * API route silently does nothing useful in production — the same reason
 * Part 2.2 had to move contact messages out of a local JSON file and into
 * Upstash Redis for prod. Resume uploads need the same treatment, but for
 * binary file storage specifically, so this uses **Vercel Blob** instead of
 * stuffing base64 PDF bytes into Redis (which has per-value size limits and
 * isn't meant for large binary blobs).
 *
 * DUAL-BACKEND STORAGE (mirrors lib/messages.ts pattern from Part 2.2)
 * ---------------------------------------------------------------------------
 * Production (Vercel):
 *   - File bytes  -> Vercel Blob (`@vercel/blob`), public access, addRandomSuffix
 *                    so re-uploads don't collide with CDN caching of the old file.
 *   - Metadata    -> Upstash Redis (`@upstash/redis`) — same KV_REST_API_URL /
 *                    KV_REST_API_TOKEN already configured for messages.
 *
 * Local dev (no Blob/KV token configured):
 *   - File bytes  -> written straight to `public/resume.pdf` on disk. This is
 *                    fine locally because `next dev` reads directly off disk
 *                    and there's no ephemeral-instance problem.
 *   - Metadata    -> `.data/resume-meta.json`, same folder Part 2.2 already
 *                    gitignores for portfolio-messages.json.
 *
 * Detection: identical strategy to lib/messages.ts — presence of
 * `KV_REST_API_URL` + `KV_REST_API_TOKEN` selects the Redis backend.
 * `BLOB_READ_WRITE_TOKEN` (auto-injected by Vercel when you connect a Blob
 * store to the project) selects the Blob backend for file bytes. The two are
 * checked independently so local dev can still exercise Redis-metadata +
 * disk-file if only KV is configured, but in practice you'll have both or
 * neither.
 * ---------------------------------------------------------------------------
 */

import { promises as fs } from 'fs'
import path from 'path'

// ─── Types ────────────────────────────────────────────────────────────────

export interface ResumeMeta {
  /** Public URL to fetch/download the current resume. */
  url: string
  /** Original uploaded filename, e.g. "Mohit_Bansal_Resume.pdf". */
  fileName: string
  /** Size in bytes. */
  size: number
  /** ISO timestamp of the last upload. */
  uploadedAt: string
  /** Running count of tracked downloads. */
  downloadCount: number
  /** Vercel Blob pathname, needed to delete the previous blob on re-upload. */
  blobPathname?: string
}

const LOCAL_META_DIR = path.join(process.cwd(), '.data')
const LOCAL_META_FILE = path.join(LOCAL_META_DIR, 'resume-meta.json')
const LOCAL_PUBLIC_PDF = path.join(process.cwd(), 'public', 'resume.pdf')

const REDIS_KEY = 'resume:meta'

// ─── Backend detection ────────────────────────────────────────────────────

function hasRedis() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

function hasBlob() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN)
}

// ─── Redis client (lazy) ──────────────────────────────────────────────────

async function getRedis() {
  const { Redis } = await import('@upstash/redis')
  return new Redis({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
  })
}

// ─── Local JSON fallback helpers ──────────────────────────────────────────

async function readLocalMeta(): Promise<ResumeMeta | null> {
  try {
    const raw = await fs.readFile(LOCAL_META_FILE, 'utf-8')
    return JSON.parse(raw) as ResumeMeta
  } catch {
    return null
  }
}

async function writeLocalMeta(meta: ResumeMeta) {
  await fs.mkdir(LOCAL_META_DIR, { recursive: true })
  await fs.writeFile(LOCAL_META_FILE, JSON.stringify(meta, null, 2), 'utf-8')
}

// ─── Default metadata (bootstrap for the resume.pdf already in /public) ───

function defaultMeta(): ResumeMeta {
  return {
    url: '/resume.pdf',
    fileName: 'resume.pdf',
    size: 0,
    uploadedAt: new Date(0).toISOString(),
    downloadCount: 0,
  }
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Fetch the current resume metadata. Falls back to a sensible default
 * (pointing at the static /public/resume.pdf shipped with the repo) if no
 * upload has happened yet in either backend.
 */
export async function getResumeMeta(): Promise<ResumeMeta> {
  if (hasRedis()) {
    const redis = await getRedis()
    const meta = await redis.get<ResumeMeta>(REDIS_KEY)
    return meta ?? defaultMeta()
  }
  const local = await readLocalMeta()
  return local ?? defaultMeta()
}

/**
 * Store a newly uploaded resume PDF and update metadata.
 * `buffer` is the raw PDF file content; `fileName` is the original name the
 * admin uploaded (used for the Content-Disposition filename and display).
 */
export async function saveResume(buffer: Buffer, fileName: string): Promise<ResumeMeta> {
  const prevMeta = await getResumeMeta()

  let url: string
  let blobPathname: string | undefined

  if (hasBlob()) {
    const { put, del } = await import('@vercel/blob')

    // Best-effort cleanup of the previous blob so orphaned files don't pile
    // up in the store. Never let a cleanup failure block a new upload.
    if (prevMeta.blobPathname) {
      try {
        await del(prevMeta.blobPathname)
      } catch (err) {
        console.error('Failed to delete previous resume blob (continuing):', err)
      }
    }

    const blob = await put('resume.pdf', buffer, {
      access: 'public',
      addRandomSuffix: true,
      contentType: 'application/pdf',
    })
    url = blob.url
    blobPathname = blob.pathname
  } else {
    // Local dev fallback: write straight into /public so `next dev` serves
    // it immediately at /resume.pdf, same URL as the original static file.
    await fs.mkdir(path.dirname(LOCAL_PUBLIC_PDF), { recursive: true })
    await fs.writeFile(LOCAL_PUBLIC_PDF, buffer)
    // Cache-bust the local URL so the browser doesn't serve a stale cached
    // copy after re-upload during a dev session.
    url = `/resume.pdf?v=${Date.now()}`
  }

  const meta: ResumeMeta = {
    url,
    fileName,
    size: buffer.byteLength,
    uploadedAt: new Date().toISOString(),
    downloadCount: prevMeta.downloadCount, // preserve download history across re-uploads
    blobPathname,
  }

  if (hasRedis()) {
    const redis = await getRedis()
    await redis.set(REDIS_KEY, meta)
  } else {
    await writeLocalMeta(meta)
  }

  return meta
}

/**
 * Atomically increment the download counter and return the new count.
 * Safe to call frequently — a failed increment (e.g. Redis hiccup) never
 * blocks the actual file download, since callers should redirect/serve the
 * file regardless of whether this succeeds.
 */
export async function incrementDownloadCount(): Promise<number> {
  if (hasRedis()) {
    const redis = await getRedis()
    // Fetch-modify-write on the whole object so downloadCount stays bundled
    // with the rest of the metadata rather than living as a separate key
    // that could drift out of sync after a re-upload.
    const meta = (await redis.get<ResumeMeta>(REDIS_KEY)) ?? defaultMeta()
    meta.downloadCount += 1
    await redis.set(REDIS_KEY, meta)
    return meta.downloadCount
  }

  const meta = (await readLocalMeta()) ?? defaultMeta()
  meta.downloadCount += 1
  await writeLocalMeta(meta)
  return meta.downloadCount
}

/** Which backends are actually configured — surfaced to the admin UI so it
 *  can warn if uploads would only persist locally (no Blob token yet). */
export function getResumeStorageStatus() {
  return {
    blobConfigured: hasBlob(),
    redisConfigured: hasRedis(),
  }
}