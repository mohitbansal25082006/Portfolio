/**
 * app/api/admin/backup/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Part 2.10 — Backup API
 * Part 3 — Enhanced with image metadata in backups
 * Part 3.1 — Updated with GET info endpoint for expanded content summary
 * Part 3.2 — Full backup coverage with all content fields
 * ---------------------------------------------------------------------------
 * GET  -> ?info=true returns backup info summary | otherwise downloads backup
 * POST -> Download a complete JSON backup including ALL content + images metadata
 * PUT  -> With body: Import a backup bundle | Without body: Get image stats
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
  getContentVersions,
} from '@/lib/content-versioning'
import { getContent } from '@/lib/content-store'
import { getSettings } from '@/lib/settings'
import { getAllMessages } from '@/lib/messages'
import { getAllProjectImages } from '@/lib/project-images'

async function requireAuth() {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value
  if (!token) return false
  const payload = verifySessionToken(token)
  return !!payload
}

/**
 * GET — Return backup info summary OR download backup
 * Usage:
 *   GET /api/admin/backup?info=true  → Returns info summary
 *   GET /api/admin/backup            → Downloads backup file
 */
export async function GET(req: NextRequest) {
  const authed = await requireAuth()
  if (!authed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const wantInfo = url.searchParams.get('info') === 'true'

  if (wantInfo) {
    return getBackupInfo()
  }

  return downloadBackup()
}

/**
 * POST — Create and download a complete backup
 */
export async function POST() {
  const authed = await requireAuth()
  if (!authed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return downloadBackup()
}

/**
 * PUT — Import backup (with body) OR Get image stats (no body)
 */
export async function PUT(req: NextRequest) {
  const authed = await requireAuth()
  if (!authed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Try to parse body — if empty, this is a stats request
  let body: any = null
  try {
    body = await req.json()
  } catch {
    body = null
  }

  // If no body, return image usage statistics
  if (!body) {
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

  // Otherwise, this is an import request
  return importBackup(body)
}

/**
 * Internal — Get backup info summary
 */
async function getBackupInfo() {
  try {
    const [content, images, settings, messages, versions] = await Promise.all([
      getContent(),
      getAllProjectImages(),
      getSettings(),
      getAllMessages(),
      getContentVersions(),
    ])

    const totalImageSize = images.reduce((sum, img) => sum + img.size, 0)

    // Count unique categories
    const categories = new Set<string>()
    for (const project of content.projects) {
      for (const cat of project.categories) {
        if (cat && cat.trim().length > 0) {
          categories.add(cat.trim().toLowerCase())
        }
      }
    }

    return NextResponse.json({
      info: {
        contentVersion: '1.3',
        projectsCount: content.projects?.length || 0,
        timelineCount: content.timeline?.length || 0,
        skillGroupsCount: content.skillGroups?.length || 0,
        statsCount: content.stats?.length || 0,
        techStackCount: content.techStack?.length || 0,
        filtersCount: content.projectFilters?.length || 0,
        navItemsCount: content.navItems?.length || 0,
        pillarsCount: content.about?.pillars?.length || 0,
        interestsCount: content.about?.interests?.length || 0,
        paragraphsCount: content.about?.paragraphs?.length || 0,
        categoriesCount: categories.size,
        imagesCount: images.length,
        totalImageSize,
        versionsCount: versions.length,
        messagesCount: messages.length,
        hasSettings: !!settings,
        hasHero: !!content.hero,
        hasStats: !!content.stats && content.stats.length > 0,
        hasTechStack: !!content.techStack && content.techStack.length > 0,
        hasFilters: !!content.projectFilters && content.projectFilters.length > 0,
        hasNavItems: !!content.navItems && content.navItems.length > 0,
      },
    })
  } catch (err) {
    console.error('Failed to get backup info:', err)
    return NextResponse.json({ error: 'Failed to get backup info' }, { status: 500 })
  }
}

/**
 * Internal — Download complete backup
 */
async function downloadBackup() {
  try {
    const bundle = await createBackupBundle()

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

/**
 * Internal — Import backup
 */
async function importBackup(bundle: any) {
  try {
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

    if (!Array.isArray(bundle.content.about.paragraphs)) {
      return NextResponse.json(
        { error: 'Invalid backup file: content.about.paragraphs must be an array.' },
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

    // Get updated stats for response
    const stats = await getImageUsageStats().catch(() => null)

    return NextResponse.json({
      success: true,
      result,
      stats,
      message: 'Backup imported successfully',
    })
  } catch (err) {
    console.error('Failed to import backup:', err)
    return NextResponse.json(
      {
        error: err instanceof Error
          ? `Failed to import backup: ${err.message}`
          : 'Failed to import backup. Please check the file and try again.',
      },
      { status: 500 },
    )
  }
}