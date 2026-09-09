/**
 * app/api/admin/project-images/cleanup/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Part 3 — Orphaned Image Cleanup API
 * ---------------------------------------------------------------------------
 * POST — Clean up orphaned images not referenced by any project
 *
 * Auth: Same pattern as every other /api/admin/* route.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ADMIN_COOKIE_NAME, verifySessionToken } from '@/lib/admin-auth'
import { getContent, getAllImageUrls } from '@/lib/content-store'
import { cleanupOrphanedImages } from '@/lib/project-images'

async function requireAuth() {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value
  if (!token) return false
  const payload = verifySessionToken(token)
  return !!payload
}

export async function POST() {
  const authed = await requireAuth()
  if (!authed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get all active image URLs from current content
    const content = await getContent()
    const activeUrls = getAllImageUrls(content)

    // Clean up orphans
    const cleanedCount = await cleanupOrphanedImages(activeUrls)

    return NextResponse.json({
      success: true,
      cleanedCount,
      message: cleanedCount > 0 
        ? `Cleaned up ${cleanedCount} orphaned image(s)`
        : 'No orphaned images found',
    })
  } catch (err) {
    console.error('Failed to clean up orphaned images:', err)
    return NextResponse.json(
      { error: 'Failed to clean up orphaned images' },
      { status: 500 },
    )
  }
}