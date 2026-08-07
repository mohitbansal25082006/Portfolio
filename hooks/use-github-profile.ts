// ============================================================================
//  hooks/use-github-profile.ts
//  Client-side hook that loads live GitHub data from /api/github.
//  Handles loading / error states, year switching, and a manual refetch.
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

  const load = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setState((prev) => ({ ...prev, loading: true, error: null }))

    try {
      const params = new URLSearchParams({ username })
      if (year) params.set('year', String(year))

      const res = await fetch(`/api/github?${params.toString()}`, {
        signal: controller.signal,
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
  }, [username, year])

  useEffect(() => {
    load()
    return () => abortRef.current?.abort()
  }, [load])

  return { ...state, refetch: load }
}