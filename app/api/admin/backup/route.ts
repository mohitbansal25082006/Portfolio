/**
 * app/api/admin/backup/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Part 2.10 — Backup API
 * Part 3 — Enhanced with image metadata in backups
 * ---------------------------------------------------------------------------
 * GET  -> Download a complete JSON backup including image metadata
 * POST -> Import a backup bundle to restore content, settings, and images
 * PUT  -> Get image usage statistics
 *
 * Auth: Same pattern as every other /api/admin/* route.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ADMIN_COOKIE_NAME, verifySessionToken } from '@/lib/admin-auth'
import {
  createBackupBundle,
  importBackupBundle,
  getImageUsageStats,
} from '@/lib/content-versioning'

async function requireAuth() {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value
  if (!token) return false
  const payload = verifySessionToken(token)
  return !!payload
}

// GET — Download complete backup bundle
export async function GET() {
  const authed = await requireAuth()
  if (!authed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const bundle = await createBackupBundle()
    
    // Return as downloadable JSON file
    return new NextResponse(JSON.stringify(bundle, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="portfolio-backup-${new Date().toISOString().split('T')[0]}.json"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  } catch (err) {
    console.error('Failed to create backup:', err)
    return NextResponse.json(
      { error: 'Failed to create backup. Please try again.' },
      { status: 500 },
    )
  }
}

// POST — Import backup bundle
export async function POST(req: NextRequest) {
  const authed = await requireAuth()
  if (!authed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    let bundle: any
    try {
      bundle = await req.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body. Please provide a valid backup file.' },
        { status: 400 },
      )
    }

    // Validate bundle structure
    if (!bundle || typeof bundle !== 'object') {
      return NextResponse.json(
        { error: 'Invalid backup file: not a valid object.' },
        { status: 400 },
      )
    }

    if (!bundle.version) {
      return NextResponse.json(
        { error: 'Invalid backup file: missing version field.' },
        { status: 400 },
      )
    }

    if (!bundle.content || typeof bundle.content !== 'object') {
      return NextResponse.json(
        { error: 'Invalid backup file: missing content object.' },
        { status: 400 },
      )
    }

    // Validate content structure
    if (!Array.isArray(bundle.content.projects)) {
      return NextResponse.json(
        { error: 'Invalid backup file: content.projects must be an array.' },
        { status: 400 },
      )
    }

    if (!bundle.content.about || typeof bundle.content.about !== 'object') {
      return NextResponse.json(
        { error: 'Invalid backup file: content.about is missing.' },
        { status: 400 },
      )
    }

    if (!Array.isArray(bundle.content.skillGroups)) {
      return NextResponse.json(
        { error: 'Invalid backup file: content.skillGroups must be an array.' },
        { status: 400 },
      )
    }

    if (!Array.isArray(bundle.content.timeline)) {
      return NextResponse.json(
        { error: 'Invalid backup file: content.timeline must be an array.' },
        { status: 400 },
      )
    }

    const result = await importBackupBundle(bundle)

    return NextResponse.json({
      success: true,
      result,
      message: 'Backup imported successfully',
    })
  } catch (err) {
    console.error('Failed to import backup:', err)
    return NextResponse.json(
      { error: 'Failed to import backup. Please check the file and try again.' },
      { status: 500 },
    )
  }
}

// PUT — Get image usage statistics
export async function PUT() {
  const authed = await requireAuth()
  if (!authed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const stats = await getImageUsageStats()
    return NextResponse.json({ stats })
  } catch (err) {
    console.error('Failed to get image statistics:', err)
    return NextResponse.json(
      { error: 'Failed to get image statistics' },
      { status: 500 },
    )
  }
}