/**
 * app/api/admin/project-images/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Part 3 — Advanced Project Image Management API
 * ---------------------------------------------------------------------------
 * POST   -> Upload one or more project images (multipart/form-data)
 * GET    -> List all uploaded project images metadata
 * DELETE -> Delete a project image by URL
 *
 * Auth: Same pattern as every other /api/admin/* route.
 * Storage: Vercel Blob in prod, local /public/project-images/ in dev.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ADMIN_COOKIE_NAME, verifySessionToken } from '@/lib/admin-auth'
import {
  uploadProjectImage,
  deleteProjectImage,
  getAllProjectImages,
  getImageStorageStatus,
  validateImageFile,
} from '@/lib/project-images'

async function requireAuth() {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value
  if (!token) return false
  const payload = verifySessionToken(token)
  return !!payload
}

// GET — List all project images metadata
export async function GET() {
  const authed = await requireAuth()
  if (!authed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const [images, storage] = await Promise.all([
      getAllProjectImages(),
      Promise.resolve(getImageStorageStatus()),
    ])

    return NextResponse.json({ images, storage })
  } catch (err) {
    console.error('Failed to fetch project images:', err)
    return NextResponse.json(
      { error: 'Failed to fetch project images' },
      { status: 500 },
    )
  }
}

// POST — Upload one or more images
export async function POST(req: NextRequest) {
  const authed = await requireAuth()
  if (!authed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json(
      { error: 'Expected multipart/form-data with image files.' },
      { status: 400 },
    )
  }

  const files = formData.getAll('files') as File[]
  const projectNumber = formData.get('projectNumber') as string | null

  if (!files || files.length === 0) {
    return NextResponse.json(
      { error: 'No files provided. Use the "files" field.' },
      { status: 400 },
    )
  }

  // Validate all files first
  for (const file of files) {
    const validation = validateImageFile(file)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 },
      )
    }
  }

  try {
    const uploadResults = []

    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const result = await uploadProjectImage(
        buffer,
        file.name || 'image.png',
        file.type || 'image/png',
        projectNumber || undefined,
      )
      uploadResults.push(result)
    }

    const storage = getImageStorageStatus()

    return NextResponse.json({
      images: uploadResults,
      storage,
    })
  } catch (err) {
    console.error('Failed to upload project images:', err)
    return NextResponse.json(
      { error: 'Failed to upload images. Please try again.' },
      { status: 500 },
    )
  }
}

// DELETE — Delete a project image by URL
export async function DELETE(req: NextRequest) {
  const authed = await requireAuth()
  if (!authed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const url = searchParams.get('url')

  if (!url) {
    return NextResponse.json(
      { error: 'Image URL is required' },
      { status: 400 },
    )
  }

  try {
    const result = await deleteProjectImage(url)
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.message || 'Failed to delete image' },
        { status: 404 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Failed to delete project image:', err)
    return NextResponse.json(
      { error: 'Failed to delete image' },
      { status: 500 },
    )
  }
}