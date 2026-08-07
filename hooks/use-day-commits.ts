// ============================================================================
//  hooks/use-day-commits.ts
//  Fetches the commits made on a specific date from /api/github/day.
//  Used by the contribution heatmap's click-to-inspect popover.
// ============================================================================

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { DayCommit } from '@/lib/github'

type State = {
  commits: DayCommit[] | null
  loading: boolean
  error: string | null
}

export function useDayCommits(username: string, date: string | null) {
  const [state, setState] = useState<State>({ commits: null, loading: false, error: null })
  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(
    async (targetDate: string) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setState({ commits: null, loading: true, error: null })

      try {
        const params = new URLSearchParams({ username, date: targetDate })
        const res = await fetch(`/api/github/day?${params.toString()}`, { signal: controller.signal })
        const json = await res.json()

        if (!res.ok) {
          throw new Error(json?.error ?? `Request failed with status ${res.status}`)
        }

        setState({ commits: json.commits as DayCommit[], loading: false, error: null })
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        const message = err instanceof Error ? err.message : 'Failed to load commits for this day.'
        setState({ commits: null, loading: false, error: message })
      }
    },
    [username],
  )

  useEffect(() => {
    if (!date) {
      setState({ commits: null, loading: false, error: null })
      return
    }
    load(date)
    return () => abortRef.current?.abort()
  }, [date, load])

  return state
}