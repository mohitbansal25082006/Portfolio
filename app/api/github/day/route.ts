// ============================================================================
//  app/api/github/day/route.ts
//  GET /api/github/day?username=<login>&date=YYYY-MM-DD
//
//  Powers the "click a contribution square to see that day's commits"
//  feature. Returns each commit's message, repo, and a direct permalink.
// ============================================================================

import { NextResponse } from 'next/server'
import { fetchCommitsForDay } from '@/lib/github'

export const revalidate = 3600

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const username = searchParams.get('username') ?? process.env.GITHUB_USERNAME
  const date = searchParams.get('date')

  if (!username) {
    return NextResponse.json(
      { error: 'No GitHub username provided. Pass ?username=<login> or set GITHUB_USERNAME.' },
      { status: 400 },
    )
  }

  if (!date || !DATE_RE.test(date)) {
    return NextResponse.json({ error: 'Missing or invalid ?date=YYYY-MM-DD parameter.' }, { status: 400 })
  }

  try {
    const commits = await fetchCommitsForDay(username, date)
    return NextResponse.json(
      { date, commits },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      },
    )
  } catch (error) {
    console.error('GitHub day-commits API route error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error fetching commit data.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}