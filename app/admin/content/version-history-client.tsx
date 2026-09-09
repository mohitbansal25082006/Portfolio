'use client'

/**
 * app/admin/content/version-history-client.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Part 2.10 — Version History Client Component
 * Part 3 — Enhanced with image statistics display
 * ---------------------------------------------------------------------------
 * Displays version history with rollback, rename, and delete capabilities.
 * Now includes image statistics for each version.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useCallback } from 'react'
import {
  History, RotateCcw, Trash2, Edit3, Check, X, Loader2,
  Image as ImageIcon, AlertTriangle, Clock,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────

interface ContentVersion {
  id: string
  timestamp: string
  content: any
  name: string
  note?: string
  changeCount?: number
  imageStats?: {
    totalImages: number
    blobImages: number
    localImages: number
    totalSize: number
  }
}

interface VersionHistoryProps {
  versions: ContentVersion[]
  onRollback: (versionId: string) => Promise<boolean>
  onRename: (versionId: string, newName: string) => Promise<boolean>
  onDelete: (versionId: string) => Promise<boolean>
  onRefresh: () => Promise<void>
}

// ─── Helper functions ─────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function formatSize(bytes: number): string {
  if (!bytes) return '0 KB'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let val = bytes
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024
    i++
  }
  return `${val.toFixed(val < 10 && i > 0 ? 1 : 0)} ${units[i]}`
}

// ─── Main Component ───────────────────────────────────────────────────────

export default function VersionHistory({
  versions,
  onRollback,
  onRename,
  onDelete,
  onRefresh,
}: VersionHistoryProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [rollingBackId, setRollingBackId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleRename = useCallback(async (versionId: string) => {
    if (!renameValue.trim()) {
      setError('Version name cannot be empty')
      return
    }

    const success = await onRename(versionId, renameValue.trim())
    if (success) {
      setRenamingId(null)
      setRenameValue('')
      setSuccess('Version renamed successfully')
      setTimeout(() => setSuccess(null), 3000)
    } else {
      setError('Failed to rename version')
    }
  }, [renameValue, onRename])

  const handleDelete = useCallback(async (versionId: string) => {
    setDeletingId(versionId)
    const success = await onDelete(versionId)
    if (success) {
      setConfirmDelete(null)
      setSuccess('Version deleted successfully')
      setTimeout(() => setSuccess(null), 3000)
    } else {
      setError('Failed to delete version')
    }
    setDeletingId(null)
  }, [onDelete])

  const handleRollback = useCallback(async (versionId: string) => {
    setRollingBackId(versionId)
    const success = await onRollback(versionId)
    if (success) {
      setSuccess('Successfully rolled back to version')
      setTimeout(() => setSuccess(null), 3000)
      await onRefresh()
    } else {
      setError('Failed to rollback to version')
    }
    setRollingBackId(null)
  }, [onRollback, onRefresh])

  if (versions.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-2xl border p-12 text-center"
        style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
      >
        <History className="h-12 w-12 mb-4" style={{ color: 'var(--muted-foreground)' }} />
        <p className="text-sm font-medium">No versions yet</p>
        <p className="mt-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
          Versions are created automatically when you save content changes.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error && (
        <div
          className="flex items-center gap-2 rounded-xl border p-3 text-sm"
          style={{
            background: 'color-mix(in oklch, var(--destructive) 10%, transparent)',
            borderColor: 'color-mix(in oklch, var(--destructive) 30%, transparent)',
            color: 'var(--destructive)',
          }}
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto rounded-lg p-1 hover:bg-[var(--muted)]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {success && (
        <div
          className="flex items-center gap-2 rounded-xl border p-3 text-sm"
          style={{
            background: 'color-mix(in oklch, oklch(0.75 0.18 150) 10%, transparent)',
            borderColor: 'color-mix(in oklch, oklch(0.75 0.18 150) 30%, transparent)',
            color: 'oklch(0.55 0.15 150)',
          }}
        >
          <Check className="h-4 w-4 shrink-0" />
          <span>{success}</span>
          <button
            onClick={() => setSuccess(null)}
            className="ml-auto rounded-lg p-1 hover:bg-[var(--muted)]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {versions.map((version, index) => (
        <div
          key={version.id}
          className="rounded-xl border p-4 transition-all"
          style={{
            background: 'var(--card)',
            borderColor: index === 0 ? 'var(--primary)' : 'var(--border)',
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{
                background: index === 0
                  ? 'color-mix(in oklch, var(--primary) 15%, transparent)'
                  : 'var(--muted)',
              }}
            >
              <Clock className="h-4 w-4" style={{ color: index === 0 ? 'var(--primary)' : 'var(--muted-foreground)' }} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {renamingId === version.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        className="rounded-lg border px-2 py-1 text-sm outline-none focus:border-[var(--primary)]"
                        style={{
                          background: 'var(--background)',
                          borderColor: 'var(--border)',
                          color: 'var(--foreground)',
                        }}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRename(version.id)
                          if (e.key === 'Escape') setRenamingId(null)
                        }}
                      />
                      <button
                        onClick={() => handleRename(version.id)}
                        className="rounded-lg p-1 hover:bg-[var(--muted)]"
                        style={{ color: 'oklch(0.55 0.15 150)' }}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setRenamingId(null)}
                        className="rounded-lg p-1 hover:bg-[var(--muted)]"
                        style={{ color: 'var(--muted-foreground)' }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold truncate">{version.name}</p>
                      {index === 0 && (
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                          style={{
                            background: 'var(--primary)',
                            color: 'var(--primary-foreground)',
                          }}
                        >
                          Current
                        </span>
                      )}
                    </div>
                  )}
                  <p className="mt-0.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    {formatDate(version.timestamp)}
                    {version.note && ` · ${version.note}`}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => {
                      setRenamingId(version.id)
                      setRenameValue(version.name)
                    }}
                    className="rounded-lg p-1.5 transition-colors hover:bg-[var(--muted)]"
                    style={{ color: 'var(--muted-foreground)' }}
                    title="Rename version"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>

                  {confirmDelete === version.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(version.id)}
                        disabled={deletingId === version.id}
                        className="rounded-lg px-2 py-1 text-xs font-medium"
                        style={{ background: 'var(--destructive)', color: 'var(--destructive-foreground)' }}
                      >
                        {deletingId === version.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          'Confirm'
                        )}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="rounded-lg px-2 py-1 text-xs"
                        style={{ color: 'var(--muted-foreground)' }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(version.id)}
                      className="rounded-lg p-1.5 transition-colors hover:text-[var(--destructive)]"
                      style={{ color: 'var(--muted-foreground)' }}
                      title="Delete version"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {index !== 0 && (
                    <button
                      onClick={() => handleRollback(version.id)}
                      disabled={rollingBackId === version.id}
                      className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-all disabled:opacity-50"
                      style={{
                        background: 'color-mix(in oklch, var(--primary) 15%, transparent)',
                        color: 'var(--primary)',
                      }}
                      title="Rollback to this version"
                    >
                      {rollingBackId === version.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3.5 w-3.5" />
                      )}
                      Rollback
                    </button>
                  )}
                </div>
              </div>

              {/* Image statistics */}
              {version.imageStats && (
                <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border p-2.5" style={{ borderColor: 'var(--border)' }}>
                  <ImageIcon className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--muted-foreground)' }} />
                  <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    {version.imageStats.totalImages} images
                  </span>
                  {version.imageStats.blobImages > 0 && (
                    <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      {version.imageStats.blobImages} blob
                    </span>
                  )}
                  {version.imageStats.localImages > 0 && (
                    <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      {version.imageStats.localImages} local
                    </span>
                  )}
                  {version.imageStats.totalSize > 0 && (
                    <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      {formatSize(version.imageStats.totalSize)}
                    </span>
                  )}
                </div>
              )}

              {/* Project count */}
              <div className="mt-2 flex flex-wrap gap-2">
                <span
                  className="rounded-full px-2.5 py-0.5 text-[10px] font-medium"
                  style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
                >
                  {version.content.projects?.length || 0} projects
                </span>
                <span
                  className="rounded-full px-2.5 py-0.5 text-[10px] font-medium"
                  style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
                >
                  {version.content.timeline?.length || 0} timeline entries
                </span>
                <span
                  className="rounded-full px-2.5 py-0.5 text-[10px] font-medium"
                  style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
                >
                  {version.content.skillGroups?.length || 0} skill groups
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}