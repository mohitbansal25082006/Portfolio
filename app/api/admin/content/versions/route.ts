/**
 * app/api/admin/content/versions/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Part 2.10 — Content Version History API
 * Updated — Added rename and delete functionality
 * ---------------------------------------------------------------------------
 * GET    -> returns version history list
 * POST   -> creates a new version snapshot manually
 * PUT    -> renames a version
 * DELETE -> deletes a version
 *
 * Auth: same pattern as every other /api/admin/* route.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ADMIN_COOKIE_NAME, verifySessionToken } from '@/lib/admin-auth'
import {
  getContentVersions,
  createContentVersion,
  getVersionStorageStatus,
  renameContentVersion,
  deleteContentVersion,
} from '@/lib/content-versioning'

async function requireAuth() {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value
  if (!token) return false
  const payload = verifySessionToken(token)
  return !!payload
}

export async function GET() {
  const authed = await requireAuth()
  if (!authed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const versions = await getContentVersions()
    const storage = getVersionStorageStatus()
    return NextResponse.json({ versions, storage })
  } catch (err) {
    console.error('Failed to fetch versions:', err)
    return NextResponse.json({ error: 'Failed to fetch versions' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const authed = await requireAuth()
  if (!authed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const version = await createContentVersion(body.note || 'Manual snapshot')
    return NextResponse.json({ version })
  } catch (err) {
    console.error('Failed to create version:', err)
    return NextResponse.json({ error: 'Failed to create version' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const authed = await requireAuth()
  if (!authed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { id, name } = body

    if (!id || !name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Version ID and name are required' },
        { status: 400 }
      )
    }

    const updatedVersion = await renameContentVersion(id, name)
    if (!updatedVersion) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 })
    }

    return NextResponse.json({ version: updatedVersion })
  } catch (err) {
    console.error('Failed to rename version:', err)
    return NextResponse.json({ error: 'Failed to rename version' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const authed = await requireAuth()
  if (!authed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Version ID is required' },
        { status: 400 }
      )
    }

    const deleted = await deleteContentVersion(id)
    if (!deleted) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Failed to delete version:', err)
    return NextResponse.json({ error: 'Failed to delete version' }, { status: 500 })
  }
}