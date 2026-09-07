/**
 * app/api/admin/content/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Part 2.7 — Content Management API
 * ---------------------------------------------------------------------------
 * GET  -> returns current content store (projects, about, skills, timeline)
 *          + storage status for the "not persistent" warning.
 * PUT  -> accepts partial patches and saves them via lib/content-store.ts.
 *
 * Auth: same pattern as every other /api/admin/* route.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ADMIN_COOKIE_NAME, verifySessionToken } from '@/lib/admin-auth'
import {
  getContent,
  saveContent,
  getContentStorageStatus,
  type ContentStore,
} from '@/lib/content-store'

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

  const [content, storage] = await Promise.all([
    getContent(),
    Promise.resolve(getContentStorageStatus()),
  ])

  return NextResponse.json({ content, storage })
}

export async function PUT(req: NextRequest) {
  const authed = await requireAuth()
  if (!authed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Partial<Omit<ContentStore, 'updatedAt'>>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // ── Basic validation ──────────────────────────────────────────────────
  if (body.projects !== undefined) {
    if (!Array.isArray(body.projects)) {
      return NextResponse.json({ error: 'Projects must be an array.' }, { status: 400 })
    }
    for (const project of body.projects) {
      if (!project.name || !project.short || !project.theme) {
        return NextResponse.json(
          { error: 'Each project needs at least a name, short description, and theme.' },
          { status: 400 },
        )
      }
    }
  }

  if (body.about !== undefined) {
    if (!body.about.paragraphs || !Array.isArray(body.about.paragraphs)) {
      return NextResponse.json({ error: 'About section needs paragraphs array.' }, { status: 400 })
    }
  }

  if (body.skillGroups !== undefined) {
    if (!Array.isArray(body.skillGroups)) {
      return NextResponse.json({ error: 'Skill groups must be an array.' }, { status: 400 })
    }
    for (const group of body.skillGroups) {
      if (!group.category || !Array.isArray(group.items)) {
        return NextResponse.json(
          { error: 'Each skill group needs a category and items array.' },
          { status: 400 },
        )
      }
    }
  }

  if (body.timeline !== undefined) {
    if (!Array.isArray(body.timeline)) {
      return NextResponse.json({ error: 'Timeline must be an array.' }, { status: 400 })
    }
    for (const entry of body.timeline) {
      if (!entry.year || !entry.title || !entry.subtitle) {
        return NextResponse.json(
          { error: 'Each timeline entry needs year, title, and subtitle.' },
          { status: 400 },
        )
      }
    }
  }

  try {
    const updated = await saveContent(body)
    return NextResponse.json({ content: updated })
  } catch (err) {
    console.error('Failed to update content:', err)
    return NextResponse.json({ error: 'Failed to save content. Please try again.' }, { status: 500 })
  }
}