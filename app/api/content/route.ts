/**
 * app/api/admin/content/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Part 2.7 — Content Management API
 * Part 2.10 — Added version history integration
 * Part 3.1 — Extended validation for hero, stats, techStack, filters, navItems
 * ---------------------------------------------------------------------------
 * GET  -> returns current content store + storage status + version count
 * PUT  -> accepts partial patches, saves them, and creates version snapshot
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
import { getContentVersions, getVersionStorageStatus } from '@/lib/content-versioning'

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

  const [content, storage, versions] = await Promise.all([
    getContent(),
    Promise.resolve(getContentStorageStatus()),
    getContentVersions(5),
  ])

  return NextResponse.json({
    content,
    storage,
    versions: {
      recent: versions,
      totalCount: versions.length,
      storage: getVersionStorageStatus(),
    }
  })
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

  // ── Projects validation ────────────────────────────────────────────────
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
      if (!Array.isArray(project.images)) {
        return NextResponse.json(
          { error: `Project "${project.name}" needs an images array.` },
          { status: 400 },
        )
      }
      if (!Array.isArray(project.features)) {
        return NextResponse.json(
          { error: `Project "${project.name}" needs a features array.` },
          { status: 400 },
        )
      }
      if (!Array.isArray(project.stack)) {
        return NextResponse.json(
          { error: `Project "${project.name}" needs a stack array.` },
          { status: 400 },
        )
      }
      if (!Array.isArray(project.categories)) {
        return NextResponse.json(
          { error: `Project "${project.name}" needs a categories array.` },
          { status: 400 },
        )
      }
    }
  }

  // ── About validation ───────────────────────────────────────────────────
  if (body.about !== undefined) {
    if (!body.about.paragraphs || !Array.isArray(body.about.paragraphs)) {
      return NextResponse.json({ error: 'About section needs paragraphs array.' }, { status: 400 })
    }
    if (!Array.isArray(body.about.interests)) {
      return NextResponse.json({ error: 'About section needs interests array.' }, { status: 400 })
    }
    if (!Array.isArray(body.about.pillars)) {
      return NextResponse.json({ error: 'About section needs pillars array.' }, { status: 400 })
    }
    for (const pillar of body.about.pillars) {
      if (!pillar.num || !pillar.label || !pillar.text) {
        return NextResponse.json(
          { error: 'Each pillar needs num, label, and text.' },
          { status: 400 },
        )
      }
    }
  }

  // ── Skill groups validation ────────────────────────────────────────────
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

  // ── Timeline validation ────────────────────────────────────────────────
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

  // ── Hero validation ────────────────────────────────────────────────────
  if (body.hero !== undefined) {
    const hero = body.hero
    if (!hero.name || !hero.firstName || !hero.lastName || !hero.initials) {
      return NextResponse.json(
        { error: 'Hero section needs name, firstName, lastName, and initials.' },
        { status: 400 },
      )
    }
    if (!hero.title || !hero.oneLiner) {
      return NextResponse.json(
        { error: 'Hero section needs title and oneLiner.' },
        { status: 400 },
      )
    }
    if (!hero.location || !hero.availability || !hero.established) {
      return NextResponse.json(
        { error: 'Hero section needs location, availability, and established.' },
        { status: 400 },
      )
    }
  }

  // ── Stats validation ───────────────────────────────────────────────────
  if (body.stats !== undefined) {
    if (!Array.isArray(body.stats)) {
      return NextResponse.json({ error: 'Stats must be an array.' }, { status: 400 })
    }
    for (const stat of body.stats) {
      if (!stat.label || typeof stat.value !== 'number' || stat.suffix === undefined) {
        return NextResponse.json(
          { error: 'Each stat needs label (string), value (number), and suffix (string).' },
          { status: 400 },
        )
      }
    }
  }

  // ── TechStack validation ───────────────────────────────────────────────
  if (body.techStack !== undefined) {
    if (!Array.isArray(body.techStack)) {
      return NextResponse.json({ error: 'TechStack must be an array.' }, { status: 400 })
    }
    for (const tech of body.techStack) {
      if (!tech || typeof tech !== 'string') {
        return NextResponse.json(
          { error: 'Each tech stack item must be a non-empty string.' },
          { status: 400 },
        )
      }
    }
  }

  // ── ProjectFilters validation ──────────────────────────────────────────
  if (body.projectFilters !== undefined) {
    if (!Array.isArray(body.projectFilters)) {
      return NextResponse.json({ error: 'ProjectFilters must be an array.' }, { status: 400 })
    }
    for (const filter of body.projectFilters) {
      if (!filter || typeof filter !== 'string') {
        return NextResponse.json(
          { error: 'Each filter must be a non-empty string.' },
          { status: 400 },
        )
      }
    }
  }

  // ── NavItems validation ────────────────────────────────────────────────
  if (body.navItems !== undefined) {
    if (!Array.isArray(body.navItems)) {
      return NextResponse.json({ error: 'NavItems must be an array.' }, { status: 400 })
    }
    for (const item of body.navItems) {
      if (!item.label || !item.href) {
        return NextResponse.json(
          { error: 'Each nav item needs label and href.' },
          { status: 400 },
        )
      }
    }
  }

  try {
    const updated = await saveContent(body)

    const versions = await getContentVersions(5)

    return NextResponse.json({
      content: updated,
      versions: {
        recent: versions,
        totalCount: versions.length,
        storage: getVersionStorageStatus(),
      }
    })
  } catch (err) {
    console.error('Failed to update content:', err)
    return NextResponse.json({ error: 'Failed to save content. Please try again.' }, { status: 500 })
  }
}