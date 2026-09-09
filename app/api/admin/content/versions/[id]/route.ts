/**
 * app/api/admin/content/versions/[id]/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Part 2.10 — Content Version Rollback API
 * Updated — Fixed rollback and added single version operations
 * ---------------------------------------------------------------------------
 * GET  -> returns specific version details
 * POST -> rolls back to the specified version
 *
 * Auth: same pattern as every other /api/admin/* route.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ADMIN_COOKIE_NAME, verifySessionToken } from '@/lib/admin-auth'
import {
  getContentVersionById,
  rollbackToVersion,
} from '@/lib/content-versioning'

async function requireAuth() {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value
  if (!token) return false
  const payload = verifySessionToken(token)
  return !!payload
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authed = await requireAuth()
  if (!authed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const version = await getContentVersionById(id)
    if (!version) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 })
    }
    return NextResponse.json({ version })
  } catch (err) {
    console.error('Failed to fetch version:', err)
    return NextResponse.json({ error: 'Failed to fetch version' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authed = await requireAuth()
  if (!authed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const restoredContent = await rollbackToVersion(id)
    
    // Return success with the restored content and a flag indicating rollback
    return NextResponse.json({ 
      success: true,
      content: restoredContent,
      message: 'Successfully rolled back to version'
    })
  } catch (err: any) {
    console.error('Failed to rollback:', err)
    return NextResponse.json(
      { 
        success: false,
        error: err.message || 'Failed to rollback to version' 
      },
      { status: 500 }
    )
  }
}