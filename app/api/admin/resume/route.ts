/**
 * app/api/admin/resume/route.ts
 *
 * Part 2.4 — Resume Management
 * ---------------------------------------------------------------------------
 * GET  -> returns current resume metadata (url, fileName, size, uploadedAt,
 *         downloadCount, storage status) for the admin dashboard's Resume
 *         page. Auth-guarded like every other /api/admin/* route.
 *
 * POST -> accepts a multipart/form-data upload with a single "file" field,
 *         validates it's actually a PDF, and stores it via lib/resume.ts
 *         (Vercel Blob in prod, local /public/resume.pdf in dev), replacing
 *         whatever resume was previously live.
 *
 * Both handlers are guarded by the same session-cookie check used by
 * /api/admin/messages and /api/admin/analytics (Part 2.1's
 * lib/admin-auth.ts) — no separate auth mechanism introduced here.
 * ---------------------------------------------------------------------------
 */

import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_COOKIE_NAME, verifySessionToken } from '@/lib/admin-auth'
import { getResumeMeta, saveResume, getResumeStorageStatus } from '@/lib/resume'

const MAX_FILE_BYTES = 15 * 1024 * 1024 // 15MB — generous ceiling for a resume PDF
const PDF_MAGIC_BYTES = Buffer.from('%PDF-')

/**
 * This route already sits behind proxy.ts's edge-level session check (see
 * proxy.ts matcher: '/api/admin/:path*'), but every other /api/admin/*
 * route in this codebase (messages, analytics, login) also re-verifies the
 * session token itself as a defense-in-depth DAL check rather than trusting
 * the proxy alone — same pattern followed here.
 */
function requireAdmin(req: NextRequest): boolean {
  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value
  if (!token) return false
  return verifySessionToken(token) != null
}

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const [meta, storage] = await Promise.all([getResumeMeta(), Promise.resolve(getResumeStorageStatus())])
    return NextResponse.json({ ...meta, storage })
  } catch (err) {
    console.error('GET /api/admin/resume failed:', err)
    return NextResponse.json({ error: 'Failed to load resume metadata' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data with a "file" field.' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided.' }, { status: 400 })
  }

  if (file.size === 0) {
    return NextResponse.json({ error: 'The uploaded file is empty.' }, { status: 400 })
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: `File is too large. Max size is ${Math.floor(MAX_FILE_BYTES / (1024 * 1024))}MB.` },
      { status: 413 },
    )
  }

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  // Validate this is actually a PDF (check magic bytes, not just the
  // filename extension or the browser-supplied MIME type, either of which
  // can be spoofed or simply wrong).
  const looksLikePdf =
    buffer.subarray(0, PDF_MAGIC_BYTES.length).equals(PDF_MAGIC_BYTES) ||
    file.type === 'application/pdf'
  if (!buffer.subarray(0, PDF_MAGIC_BYTES.length).equals(PDF_MAGIC_BYTES)) {
    return NextResponse.json({ error: 'The uploaded file does not look like a valid PDF.' }, { status: 400 })
  }
  void looksLikePdf // (kept for clarity above; magic-byte check is authoritative)

  try {
    const meta = await saveResume(buffer, file.name || 'resume.pdf')
    return NextResponse.json({ ...meta, storage: getResumeStorageStatus() })
  } catch (err) {
    console.error('POST /api/admin/resume failed:', err)
    return NextResponse.json({ error: 'Failed to save the resume. Please try again.' }, { status: 500 })
  }
}