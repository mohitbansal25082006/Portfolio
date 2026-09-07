/**
 * app/api/content/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Part 2.7 — Public Content API
 * ---------------------------------------------------------------------------
 * GET -> returns the current live content (projects, about, skills, timeline)
 *         for the public portfolio to fetch. Falls back to static defaults
 *         if no admin edits have been made yet.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextResponse } from 'next/server'
import { getContent } from '@/lib/content-store'

export async function GET() {
  try {
    const content = await getContent()
    return NextResponse.json({ content })
  } catch (err) {
    console.error('Failed to load content:', err)
    return NextResponse.json({ error: 'Failed to load content' }, { status: 500 })
  }
}