// ============================================================================
//  app/api/github/route.ts
//  GET /api/github?username=<login>
//
//  Thin Route Handler wrapping lib/github.ts so the client component can
//  refresh data on demand (e.g. a manual "refresh" button) without needing
//  the GITHUB_TOKEN to ever reach the browser.
//
//  Data is cached for 1 hour at the fetch layer (see lib/github.ts) and this
//  route additionally sets an HTTP cache header so any CDN in front of it
//  behaves the same way.
// ============================================================================

import { NextResponse } from 'next/server'
import { fetchGitHubProfile } from '@/lib/github'

export const revalidate = 3600 // 1 hour ISR for this route

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const username = searchParams.get('username') ?? process.env.GITHUB_USERNAME
  const yearParam = searchParams.get('year')
  const year = yearParam ? Number.parseInt(yearParam, 10) : undefined
  // Presence of `_t` signals a forced manual refresh from the client (see
  // hooks/use-github-profile.ts). When present, we bypass Next's server-side
  // fetch cache too, so "refresh" always talks to GitHub instead of
  // returning the same cached data the browser cache-bust was meant to skip.
  const isForcedRefresh = searchParams.has('_t')

  if (!username) {
    return NextResponse.json(
      { error: 'No GitHub username provided. Pass ?username=<login> or set GITHUB_USERNAME.' },
      { status: 400 },
    )
  }

  if (yearParam && (Number.isNaN(year) || String(year).length !== 4)) {
    return NextResponse.json({ error: 'Invalid year parameter. Expected a 4-digit year.' }, { status: 400 })
  }

  try {
    const profile = await fetchGitHubProfile(username, year, { bypassCache: isForcedRefresh })
    return NextResponse.json(profile, {
      headers: {
        // Forced refreshes should never be cached by any intermediary either.
        'Cache-Control': isForcedRefresh
          ? 'no-store'
          : 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    })
  } catch (error) {
    console.error('GitHub API route error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error fetching GitHub data.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}