/**
 * app/api/content/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Part 2.7 — Public content endpoint
 * Part 3.1 — Exposes hero, stats, techStack, projectFilters, navItems
 * Part 3.5 — Ensures techStack is always a clean string[] (never null/undefined)
 * ---------------------------------------------------------------------------
 * Public (unauthenticated) read-only view of the editable content store.
 * The portfolio site fetches this on mount and falls back to static
 * lib/content.ts values until it resolves.
 *
 * This endpoint deliberately EXCLUDES admin-only fields (imageMetadata,
 * updatedAt) but INCLUDES every field the public site renders.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextResponse } from 'next/server'
import { getContent, normalizeTechStack } from '@/lib/content-store'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const content = await getContent()

    // Public-safe payload — omit internal bookkeeping fields.
    const payload = {
      projects: content.projects,
      about: content.about,
      skillGroups: content.skillGroups,
      timeline: content.timeline,
      hero: content.hero,
      stats: content.stats,
      // Always return a clean string[] — never null, never with empty entries.
      techStack: normalizeTechStack(content.techStack),
      projectFilters: content.projectFilters,
      navItems: content.navItems,
    }

    return NextResponse.json(
      { content: payload },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      },
    )
  } catch (err) {
    console.error('Failed to load public content:', err)
    return NextResponse.json(
      { error: 'Failed to load content.' },
      { status: 500 },
    )
  }
}