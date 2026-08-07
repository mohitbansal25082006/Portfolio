// ============================================================================
//  lib/github.ts
//  Server-only GitHub GraphQL client.
//  Fetches real-time profile stats, contribution calendar, pinned repos,
//  top languages, and recent public activity for the GitHub section.
//
//  NEVER import this file from a 'use client' component — it uses a
//  server-side secret (GITHUB_TOKEN) and must only run on the server
//  (Route Handlers, Server Components, etc).
// ============================================================================

const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql'
const GITHUB_REST_URL = 'https://api.github.com'

export type ContributionDay = {
  date: string
  count: number
  level: 0 | 1 | 2 | 3 | 4
}

export type TopLanguage = {
  name: string
  pct: number
  color: string
}

export type PinnedRepo = {
  name: string
  desc: string
  stars: number
  forks: number
  url: string
  language: string
  languageColor: string
}

export type RecentActivityItem = {
  type: 'commit' | 'pr' | 'issue' | 'star' | 'repo' | 'release' | 'fork' | 'review'
  text: string
  url: string
  time: string // ISO timestamp
}

export type GitHubProfile = {
  username: string
  url: string
  avatarUrl: string
  bio: string | null
  followers: number
  following: number
  publicRepos: number
  totalStars: number
  allTimeContributions: number
  totalContributions: number
  currentStreak: number
  longestStreak: number
  contributionData: ContributionDay[]
  contributionYears: number[]
  selectedYear: number
  topLanguages: TopLanguage[]
  pinnedRepos: PinnedRepo[]
  recentActivity: RecentActivityItem[]
  fetchedAt: string
}

export type DayCommit = {
  sha: string
  shortSha: string
  message: string
  url: string
  repo: string
  committedDate: string
}

// Mirrors GitHub's own contribution-graph color buckets (Level 0–4).
const LANGUAGE_FALLBACK_COLOR = 'oklch(0.65 0.02 280)'

/**
 * Raw shape returned by the GraphQL query below.
 */
interface GraphQLResponse {
  data?: {
    user: {
      login: string
      url: string
      avatarUrl: string
      bio: string | null
      followers: { totalCount: number }
      following: { totalCount: number }
      contributionsCollection: {
        contributionYears: number[]
      }
      repositories: {
        totalCount: number
        nodes: Array<{
          stargazerCount: number
          primaryLanguage: { name: string; color: string | null } | null
        }>
      }
      selectedYearContributions: {
        contributionCalendar: {
          totalContributions: number
          weeks: Array<{
            contributionDays: Array<{
              date: string
              contributionCount: number
              contributionLevel: string
            }>
          }>
        }
      }
      pinnedItems: {
        nodes: Array<{
          name: string
          description: string | null
          url: string
          stargazerCount: number
          forkCount: number
          primaryLanguage: { name: string; color: string | null } | null
        }>
      }
    }
  }
  errors?: Array<{ message: string }>
}

/** Per-year commit-contribution totals, used to sum an all-time count. */
interface AllTimeGraphQLResponse {
  data?: {
    user: {
      contributionsCollection: {
        contributionYears: number[]
      }
    } & Record<string, { contributionCalendar: { totalContributions: number } } | undefined>
  }
  errors?: Array<{ message: string }>
}

const CONTRIBUTIONS_QUERY = /* GraphQL */ `
  query UserProfile($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      login
      url
      avatarUrl
      bio
      followers {
        totalCount
      }
      following {
        totalCount
      }
      contributionsCollection {
        contributionYears
      }
      repositories(
        first: 100
        ownerAffiliations: OWNER
        isFork: false
        orderBy: { field: STARGAZERS, direction: DESC }
      ) {
        totalCount
        nodes {
          stargazerCount
          primaryLanguage {
            name
            color
          }
        }
      }
      selectedYearContributions: contributionsCollection(from: $from, to: $to) {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              contributionCount
              contributionLevel
            }
          }
        }
      }
      pinnedItems(first: 6, types: [REPOSITORY]) {
        nodes {
          ... on Repository {
            name
            description
            url
            stargazerCount
            forkCount
            primaryLanguage {
              name
              color
            }
          }
        }
      }
    }
  }
`

/**
 * Builds a query requesting one aliased `contributionsCollection` field per
 * year, so the all-time total can be computed in a single round trip.
 */
function buildAllTimeQuery(years: number[]): string {
  const fields = years
    .map(
      (year) => `
        y${year}: contributionsCollection(from: "${year}-01-01T00:00:00Z", to: "${year}-12-31T23:59:59Z") {
          contributionCalendar {
            totalContributions
          }
        }`,
    )
    .join('\n')

  return /* GraphQL */ `
    query AllTimeContributions($login: String!) {
      user(login: $login) {
        contributionsCollection {
          contributionYears
        }
        ${fields}
      }
    }
  `
}

function levelFromLabel(label: string): 0 | 1 | 2 | 3 | 4 {
  switch (label) {
    case 'FIRST_QUARTILE':
      return 1
    case 'SECOND_QUARTILE':
      return 2
    case 'THIRD_QUARTILE':
      return 3
    case 'FOURTH_QUARTILE':
      return 4
    default:
      return 0
  }
}

/** Computes current + longest daily contribution streaks from a flat day list. */
function computeStreaks(days: ContributionDay[]): { current: number; longest: number } {
  let longest = 0
  let run = 0
  for (const day of days) {
    if (day.count > 0) {
      run += 1
      longest = Math.max(longest, run)
    } else {
      run = 0
    }
  }

  // Current streak: walk backward from the most recent day. Allow "today"
  // to have zero contributions so far without breaking the streak.
  let current = 0
  for (let i = days.length - 1; i >= 0; i--) {
    const day = days[i]
    if (day.count > 0) {
      current += 1
    } else if (i === days.length - 1) {
      continue // today may not have contributions yet
    } else {
      break
    }
  }

  return { current, longest }
}

async function graphqlRequest(query: string, variables: Record<string, unknown>): Promise<GraphQLResponse> {
  const token = process.env.GITHUB_TOKEN

  if (!token) {
    throw new Error(
      'Missing GITHUB_TOKEN environment variable. Create a fine-grained personal access token with read-only access to public repositories and profile data, then set GITHUB_TOKEN in your .env.local file.',
    )
  }

  const res = await fetch(GITHUB_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'portfolio-github-section',
    },
    body: JSON.stringify({ query, variables }),
    // Revalidate this data at most once per hour (Next.js fetch cache / ISR).
    next: { revalidate: 3600, tags: ['github-profile'] },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`GitHub GraphQL request failed: ${res.status} ${res.statusText} ${body}`)
  }

  const json = (await res.json()) as GraphQLResponse

  if (json.errors?.length) {
    throw new Error(`GitHub GraphQL error: ${json.errors.map((e) => e.message).join('; ')}`)
  }

  return json
}

/**
 * Fetches recent public events via the REST API (Events don't have a
 * first-class GraphQL equivalent for "recent activity feed").
 */
async function fetchRecentActivity(username: string): Promise<RecentActivityItem[]> {
  const token = process.env.GITHUB_TOKEN

  const res = await fetch(`${GITHUB_REST_URL}/users/${username}/events/public?per_page=30`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      Accept: 'application/vnd.github+json',
      'User-Agent': 'portfolio-github-section',
    },
    next: { revalidate: 900, tags: ['github-activity'] }, // refresh every 15 min
  })

  if (!res.ok) return []

  const events = (await res.json()) as Array<{
    type: string
    created_at: string
    repo: { name: string }
    payload: Record<string, unknown>
  }>

  const items: RecentActivityItem[] = []

  for (const event of events) {
    const repoName = event.repo?.name ?? 'a repository'
    const repoUrl = `https://github.com/${repoName}`

    switch (event.type) {
      case 'PushEvent': {
        const commits = (event.payload.commits as unknown[] | undefined)?.length ?? 1
        items.push({
          type: 'commit',
          text: `Pushed ${commits} commit${commits === 1 ? '' : 's'} to ${repoName}`,
          url: repoUrl,
          time: event.created_at,
        })
        break
      }
      case 'PullRequestEvent': {
        const action = event.payload.action as string
        const number = (event.payload.pull_request as { number?: number } | undefined)?.number
        if (action === 'opened' || action === 'closed') {
          items.push({
            type: 'pr',
            text: `${action === 'opened' ? 'Opened' : 'Closed'} PR #${number ?? ''} in ${repoName}`,
            url: repoUrl,
            time: event.created_at,
          })
        }
        break
      }
      case 'IssuesEvent': {
        const action = event.payload.action as string
        const number = (event.payload.issue as { number?: number } | undefined)?.number
        if (action === 'opened' || action === 'closed') {
          items.push({
            type: 'issue',
            text: `${action === 'opened' ? 'Opened' : 'Closed'} issue #${number ?? ''} in ${repoName}`,
            url: repoUrl,
            time: event.created_at,
          })
        }
        break
      }
      case 'WatchEvent':
        items.push({ type: 'star', text: `Starred ${repoName}`, url: repoUrl, time: event.created_at })
        break
      case 'CreateEvent': {
        const refType = event.payload.ref_type as string
        if (refType === 'repository') {
          items.push({ type: 'repo', text: `Created ${repoName}`, url: repoUrl, time: event.created_at })
        }
        break
      }
      case 'ReleaseEvent': {
        const tag = (event.payload.release as { tag_name?: string } | undefined)?.tag_name
        items.push({
          type: 'release',
          text: `Released ${tag ?? ''} on ${repoName}`,
          url: repoUrl,
          time: event.created_at,
        })
        break
      }
      case 'ForkEvent':
        items.push({ type: 'fork', text: `Forked ${repoName}`, url: repoUrl, time: event.created_at })
        break
      case 'PullRequestReviewEvent':
        items.push({ type: 'review', text: `Reviewed a PR in ${repoName}`, url: repoUrl, time: event.created_at })
        break
      default:
        break
    }

    if (items.length >= 8) break
  }

  return items
}

/**
 * Fetches everything the GitHub section needs in one call.
 * Cached via Next.js `fetch` revalidation — safe to call from a Server
 * Component or Route Handler on every request; the underlying network
 * calls are deduped/cached automatically.
 *
 * @param username GitHub login to look up.
 * @param year Optional calendar year (e.g. 2025) to scope the contribution
 *   graph to. Defaults to the trailing 365 days (GitHub's own default view)
 *   when omitted.
 */
export async function fetchGitHubProfile(username: string, year?: number): Promise<GitHubProfile> {
  let from: Date
  let to: Date

  if (year) {
    from = new Date(Date.UTC(year, 0, 1, 0, 0, 0))
    to = new Date(Date.UTC(year, 11, 31, 23, 59, 59))
  } else {
    to = new Date()
    from = new Date()
    from.setFullYear(from.getFullYear() - 1)
    from.setDate(from.getDate() + 1) // exactly 52 weeks + today, matching GitHub's own graph
  }

  const [graphqlRes, recentActivity] = await Promise.all([
    graphqlRequest(CONTRIBUTIONS_QUERY, {
      login: username,
      from: from.toISOString(),
      to: to.toISOString(),
    }),
    fetchRecentActivity(username).catch(() => [] as RecentActivityItem[]),
  ])

  const user = graphqlRes.data?.user
  if (!user) {
    throw new Error(`GitHub user "${username}" not found or token lacks access.`)
  }

  const contributionYears = [...user.contributionsCollection.contributionYears].sort((a, b) => b - a)
  const selectedYear = year ?? contributionYears[0] ?? new Date().getFullYear()

  const contributionData: ContributionDay[] =
    user.selectedYearContributions.contributionCalendar.weeks.flatMap((week) =>
      week.contributionDays.map((day) => ({
        date: day.date,
        count: day.contributionCount,
        level: levelFromLabel(day.contributionLevel),
      })),
    )

  const { current, longest } = computeStreaks(contributionData)

  const allTimeContributions = await fetchAllTimeContributions(username, contributionYears).catch(
    () => user.selectedYearContributions.contributionCalendar.totalContributions,
  )

  // Aggregate top languages across the user's own (non-fork) repositories,
  // weighted by repo count (a lightweight proxy — true byte-weighted stats
  // require per-repo `languages` queries, which is far more expensive).
  const languageCounts = new Map<string, { count: number; color: string }>()
  for (const repo of user.repositories.nodes) {
    if (!repo.primaryLanguage) continue
    const key = repo.primaryLanguage.name
    const existing = languageCounts.get(key)
    languageCounts.set(key, {
      count: (existing?.count ?? 0) + 1,
      color: repo.primaryLanguage.color ?? LANGUAGE_FALLBACK_COLOR,
    })
  }
  const totalLangRepos = Array.from(languageCounts.values()).reduce((sum, l) => sum + l.count, 0) || 1
  const topLanguages: TopLanguage[] = Array.from(languageCounts.entries())
    .map(([name, { count, color }]) => ({
      name,
      pct: Math.round((count / totalLangRepos) * 100),
      color,
    }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 5)

  const totalStars = user.repositories.nodes.reduce((sum, r) => sum + r.stargazerCount, 0)

  const pinnedRepos: PinnedRepo[] = user.pinnedItems.nodes.map((repo) => ({
    name: repo.name,
    desc: repo.description ?? 'No description provided.',
    stars: repo.stargazerCount,
    forks: repo.forkCount,
    url: repo.url,
    language: repo.primaryLanguage?.name ?? 'Unknown',
    languageColor: repo.primaryLanguage?.color ?? LANGUAGE_FALLBACK_COLOR,
  }))

  return {
    username: user.login,
    url: user.url,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    followers: user.followers.totalCount,
    following: user.following.totalCount,
    publicRepos: user.repositories.totalCount,
    totalStars,
    allTimeContributions,
    totalContributions: user.selectedYearContributions.contributionCalendar.totalContributions,
    currentStreak: current,
    longestStreak: longest,
    contributionData,
    contributionYears,
    selectedYear,
    topLanguages,
    pinnedRepos,
    recentActivity,
    fetchedAt: new Date().toISOString(),
  }
}

/**
 * Sums `totalContributions` across every year the user has contributed,
 * using a single aliased GraphQL query (one field per year) so it costs
 * one request regardless of account age.
 */
async function fetchAllTimeContributions(username: string, knownYears: number[]): Promise<number> {
  const years = knownYears.length > 0 ? knownYears : [new Date().getFullYear()]
  const query = buildAllTimeQuery(years)
  const res = (await graphqlRequest(query, { login: username })) as unknown as AllTimeGraphQLResponse

  const user = res.data?.user
  if (!user) return 0

  let sum = 0
  for (const year of years) {
    const field = user[`y${year}`]
    sum += field?.contributionCalendar.totalContributions ?? 0
  }
  return sum
}

/**
 * Fetches the individual commits made on a specific calendar day, with
 * direct links to each commit on GitHub. Uses the REST "Search commits"
 * endpoint (`committer-date` qualifier), since neither the GraphQL
 * contribution calendar nor REST Events API expose a per-day commit list
 * with permalink granularity.
 */
export async function fetchCommitsForDay(username: string, date: string): Promise<DayCommit[]> {
  const token = process.env.GITHUB_TOKEN
  const query = `author:${username} committer-date:${date}`

  const res = await fetch(`${GITHUB_REST_URL}/search/commits?q=${encodeURIComponent(query)}&sort=committer-date&order=asc&per_page=30`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      Accept: 'application/vnd.github.cloak-preview+json',
      'User-Agent': 'portfolio-github-section',
    },
    next: { revalidate: 3600, tags: ['github-day-commits', `github-day-${date}`] },
  })

  if (!res.ok) {
    if (res.status === 403 || res.status === 422) return [] // rate-limited or no results
    throw new Error(`GitHub commit search failed: ${res.status} ${res.statusText}`)
  }

  const json = (await res.json()) as {
    items: Array<{
      sha: string
      html_url: string
      commit: { message: string; committer: { date: string } | null }
      repository: { full_name: string }
    }>
  }

  return (json.items ?? []).map((item) => ({
    sha: item.sha,
    shortSha: item.sha.slice(0, 7),
    message: item.commit.message.split('\n')[0], // first line only
    url: item.html_url,
    repo: item.repository.full_name,
    committedDate: item.commit.committer?.date ?? date,
  }))
}