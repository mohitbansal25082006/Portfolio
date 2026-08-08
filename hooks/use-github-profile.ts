// ============================================================================
//  hooks/use-github-profile.ts
//  Client-side hook that loads live GitHub data from /api/github.
//  Handles loading / error states, year switching, and a manual refetch.
//
//  IMPORTANT: `refetch()` always forces a real network round trip
//  (`cache: 'no-store'` + a cache-busting query param). Without this, the
//  browser's HTTP cache can serve back the exact same response for an
//  identical GET URL, making the "refresh" button look like it does
//  nothing even though React state is updating correctly.
// ============================================================================

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { GitHubProfile } from '@/lib/github'

type State = {
  data: GitHubProfile | null
  loading: boolean
  error: string | null
}

export function useGitHubProfile(username: string, year?: number) {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null })
  const abortRef = useRef<AbortController | null>(null)

  const fetchProfile = useCallback(
    async (opts: { force?: boolean } = {}) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setState((prev) => ({ ...prev, loading: true, error: null }))

      try {
        const params = new URLSearchParams({ username })
        if (year) params.set('year', String(year))
        // Cache-bust on manual refresh so the browser can't short-circuit
        // the request with a stale cached response for the same URL.
        if (opts.force) params.set('_t', String(Date.now()))

        const res = await fetch(`/api/github?${params.toString()}`, {
          signal: controller.signal,
          cache: opts.force ? 'no-store' : 'default',
        })
        const json = await res.json()

        if (!res.ok) {
          throw new Error(json?.error ?? `Request failed with status ${res.status}`)
        }

        setState({ data: json as GitHubProfile, loading: false, error: null })
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        const message = err instanceof Error ? err.message : 'Failed to load GitHub data.'
        setState((prev) => ({ ...prev, loading: false, error: message }))
      }
    },
    [username, year],
  )

  // Initial load (and reload whenever username/year changes) uses the
  // normal cache — fast, and still fresh thanks to server-side revalidation.
  useEffect(() => {
    fetchProfile({ force: false })
    return () => abortRef.current?.abort()
  }, [fetchProfile])

  // Manual refresh always forces a fresh network fetch.
  const refetch = useCallback(() => fetchProfile({ force: true }), [fetchProfile])

  return { ...state, refetch }
}