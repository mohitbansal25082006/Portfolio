/**
 * app/api/admin/backup/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Part 2.10 — Backup Export/Import API
 * ---------------------------------------------------------------------------
 * GET  -> generates and returns a complete JSON backup bundle
 * POST -> imports a previously exported backup bundle
 *
 * The backup includes:
 *   • All content (projects, about, skills, timeline)
 *   • Site settings
 *   • Messages (contact form submissions)
 *   • Version history metadata
 *
 * Auth: same pattern as every other /api/admin/* route.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ADMIN_COOKIE_NAME, verifySessionToken } from '@/lib/admin-auth'
import {
  createBackupBundle,
  importBackupBundle,
  type BackupBundle,
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
    const bundle = await createBackupBundle()
    
    // Set headers for file download
    const filename = `portfolio-backup-${new Date().toISOString().split('T')[0]}.json`
    
    return new NextResponse(JSON.stringify(bundle, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('Failed to create backup:', err)
    return NextResponse.json({ error: 'Failed to create backup' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const authed = await requireAuth()
  if (!authed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    
    // Basic validation
    if (!body || typeof body !== 'object' || !body.content) {
      return NextResponse.json(
        { error: 'Invalid backup file. Missing content section.' },
        { status: 400 }
      )
    }

    const result = await importBackupBundle(body as BackupBundle)
    return NextResponse.json({ 
      success: true, 
      ...result,
      message: 'Backup imported successfully' 
    })
  } catch (err: any) {
    console.error('Failed to import backup:', err)
    return NextResponse.json(
      { error: err.message || 'Failed to import backup' },
      { status: 500 }
    )
  }
}