'use client'

/**
 * app/admin/content/version-history-client.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Part 2.10 — Version History & Rollback UI Component
 * Updated — Added rename, delete, and fixed rollback functionality
 * ---------------------------------------------------------------------------
 * Displays version history with full management capabilities:
 *   • List of all versions with timestamps and custom names
 *   • Preview changes (project count, timeline count, etc.)
 *   • One-click rollback with confirmation
 *   • Rename versions with custom names
 *   • Delete unwanted versions
 *   • Visual indicators for current version
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useCallback } from 'react'
import {
  History,
  RotateCcw,
  Loader2,
  AlertTriangle,
  Check,
  Clock,
  FileText,
  FolderKanban,
  User,
  Wrench,
  Pencil,
  Trash2,
  X,
  Save,
} from 'lucide-react'

interface ContentVersion {
  id: string
  timestamp: string
  content: {
    projects: any[]
    about: any
    skillGroups: any[]
    timeline: any[]
    updatedAt: string
  }
  name: string
  note?: string
  changeCount?: number
}

interface VersionHistoryProps {
  versions: ContentVersion[]
  onRollback: (versionId: string) => Promise<boolean>
  onRename: (versionId: string, newName: string) => Promise<boolean>
  onDelete: (versionId: string) => Promise<boolean>
  onRefresh: () => Promise<void>
  onClose?: () => void
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

function getVersionSummary(version: ContentVersion): string {
  const parts: string[] = []
  parts.push(`${version.content.projects?.length ?? 0} projects`)
  parts.push(`${version.content.timeline?.length ?? 0} timeline entries`)
  parts.push(`${version.content.skillGroups?.length ?? 0} skill groups`)
  return parts.join(' · ')
}

export default function VersionHistory({
  versions,
  onRollback,
  onRename,
  onDelete,
  onRefresh,
  onClose,
}: VersionHistoryProps) {
  const [selectedVersion, setSelectedVersion] = useState<ContentVersion | null>(null)
  const [showRollbackConfirm, setShowRollbackConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [rollingBack, setRollingBack] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [rollbackSuccess, setRollbackSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Rename state
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renaming, setRenaming] = useState(false)

  const handleRollbackClick = (version: ContentVersion) => {
    setSelectedVersion(version)
    setShowRollbackConfirm(true)
    setError(null)
  }

  const handleConfirmRollback = async () => {
    if (!selectedVersion) return

    setRollingBack(true)
    setError(null)

    try {
      const success = await onRollback(selectedVersion.id)
      if (success) {
        setRollbackSuccess(true)
        setShowRollbackConfirm(false)
        setSelectedVersion(null)
        setTimeout(() => setRollbackSuccess(false), 3000)
        await onRefresh()
      } else {
        setError('Failed to rollback. Please try again.')
      }
    } catch (err) {
      setError('Failed to rollback. Please try again.')
      console.error('Rollback error:', err)
    } finally {
      setRollingBack(false)
    }
  }

  const handleDeleteClick = (version: ContentVersion) => {
    setSelectedVersion(version)
    setShowDeleteConfirm(true)
    setError(null)
  }

  const handleConfirmDelete = async () => {
    if (!selectedVersion) return

    setDeleting(true)
    setError(null)

    try {
      const success = await onDelete(selectedVersion.id)
      if (success) {
        setShowDeleteConfirm(false)
        setSelectedVersion(null)
        await onRefresh()
      } else {
        setError('Failed to delete version. Please try again.')
      }
    } catch (err) {
      setError('Failed to delete version. Please try again.')
      console.error('Delete error:', err)
    } finally {
      setDeleting(false)
    }
  }

  const handleRenameClick = (version: ContentVersion) => {
    setRenamingId(version.id)
    setRenameValue(version.name)
    setError(null)
  }

  const handleRenameCancel = () => {
    setRenamingId(null)
    setRenameValue('')
  }

  const handleRenameSave = async (versionId: string) => {
    if (!renameValue.trim()) {
      setError('Version name cannot be empty')
      return
    }

    setRenaming(true)
    setError(null)

    try {
      const success = await onRename(versionId, renameValue.trim())
      if (success) {
        setRenamingId(null)
        setRenameValue('')
        await onRefresh()
      } else {
        setError('Failed to rename version. Please try again.')
      }
    } catch (err) {
      setError('Failed to rename version. Please try again.')
      console.error('Rename error:', err)
    } finally {
      setRenaming(false)
    }
  }

  return (
    <div className="rounded-2xl border p-6" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5" style={{ color: 'var(--primary)' }} />
          <h2 className="text-sm font-semibold">Version History</h2>
          <span
            className="rounded-full px-2 py-0.5 text-xs font-medium"
            style={{
              background: 'color-mix(in oklch, var(--primary) 15%, transparent)',
              color: 'var(--primary)',
            }}
          >
            {versions.length} versions
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-xs font-medium"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Close
          </button>
        )}
      </div>

      {rollbackSuccess && (
        <div
          className="mb-4 flex items-center gap-2 rounded-xl p-3 text-sm"
          style={{
            background: 'color-mix(in oklch, oklch(0.75 0.18 150) 12%, transparent)',
            color: 'oklch(0.75 0.18 150)',
          }}
        >
          <Check className="h-4 w-4" />
          Content rolled back successfully!
        </div>
      )}

      {error && (
        <div
          className="mb-4 flex items-center gap-2 rounded-xl p-3 text-sm"
          style={{
            background: 'color-mix(in oklch, oklch(0.65 0.22 25) 12%, transparent)',
            color: 'var(--destructive)',
          }}
        >
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}

      {versions.length === 0 ? (
        <div
          className="rounded-xl p-8 text-center text-sm"
          style={{ color: 'var(--muted-foreground)' }}
        >
          No versions yet. Save content changes to create version history.
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {versions.map((version, index) => (
            <div
              key={version.id}
              className="group flex items-start gap-3 rounded-xl border p-3 transition-all hover:bg-[var(--muted)]"
              style={{
                borderColor: index === 0 ? 'var(--primary)' : 'var(--border)',
                background: index === 0
                  ? 'color-mix(in oklch, var(--primary) 5%, transparent)'
                  : 'transparent',
              }}
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{
                  background: 'color-mix(in oklch, var(--primary) 15%, transparent)',
                  color: 'var(--primary)',
                }}
              >
                <Clock className="h-4 w-4" />
              </div>

              <div className="min-w-0 flex-1">
                {renamingId === version.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      className="flex-1 rounded-lg border px-3 py-1.5 text-sm font-medium outline-none focus:border-[var(--primary)]"
                      style={{
                        background: 'var(--background)',
                        borderColor: 'var(--border)',
                        color: 'var(--foreground)',
                      }}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameSave(version.id)
                        if (e.key === 'Escape') handleRenameCancel()
                      }}
                    />
                    <button
                      onClick={() => handleRenameSave(version.id)}
                      disabled={renaming}
                      className="rounded-lg p-1.5 transition-colors hover:bg-[var(--muted)]"
                      style={{ color: 'var(--primary)' }}
                      title="Save name"
                    >
                      {renaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={handleRenameCancel}
                      className="rounded-lg p-1.5 transition-colors hover:bg-[var(--muted)]"
                      style={{ color: 'var(--muted-foreground)' }}
                      title="Cancel"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">
                        {version.name}
                      </p>
                      {index === 0 && (
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                          style={{
                            background: 'var(--primary)',
                            color: 'var(--primary-foreground)',
                          }}
                        >
                          Current
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      {timeAgo(version.timestamp)} · {version.note || 'Content update'}
                    </p>
                    <p className="mt-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      {getVersionSummary(version)}
                    </p>
                  </>
                )}
              </div>

              {renamingId !== version.id && (
                <div className="flex shrink-0 gap-1 opacity-100 sm:opacity-0 transition-opacity sm:group-hover:opacity-100">
                  {index > 0 && (
                    <button
                      onClick={() => handleRollbackClick(version)}
                      disabled={rollingBack}
                      className="flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-all hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:opacity-50"
                      style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
                      title="Rollback to this version"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Rollback</span>
                    </button>
                  )}
                  <button
                    onClick={() => handleRenameClick(version)}
                    className="rounded-lg p-1.5 transition-colors hover:bg-[var(--muted)]"
                    style={{ color: 'var(--muted-foreground)' }}
                    title="Rename version"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  {index > 0 && (
                    <button
                      onClick={() => handleDeleteClick(version)}
                      disabled={deleting}
                      className="rounded-lg p-1.5 transition-colors hover:text-[var(--destructive)]"
                      style={{ color: 'var(--muted-foreground)' }}
                      title="Delete version"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Rollback Confirmation Modal */}
      {showRollbackConfirm && selectedVersion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowRollbackConfirm(false)}
          />
          <div
            className="relative z-10 w-full max-w-md rounded-2xl border p-6 shadow-2xl"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <div className="mb-4 flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{
                  background: 'color-mix(in oklch, oklch(0.65 0.22 60) 15%, transparent)',
                  color: 'oklch(0.65 0.22 60)',
                }}
              >
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Confirm Rollback</h3>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  This will restore content to "{selectedVersion.name}"
                </p>
              </div>
            </div>

            <div
              className="mb-4 rounded-xl p-3 text-xs"
              style={{
                background: 'var(--muted)',
                color: 'var(--muted-foreground)',
              }}
            >
              <p className="mb-1 font-medium">Version details:</p>
              <p>{getVersionSummary(selectedVersion)}</p>
              <p className="mt-1">Created {timeAgo(selectedVersion.timestamp)}</p>
            </div>

            <p className="mb-4 text-xs" style={{ color: 'var(--muted-foreground)' }}>
              A snapshot of the current state will be created before rolling back,
              so you can undo this action if needed.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setShowRollbackConfirm(false)}
                disabled={rollingBack}
                className="flex-1 rounded-xl border px-4 py-2 text-sm font-medium transition-all"
                style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRollback}
                disabled={rollingBack}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white transition-all"
                style={{ background: 'var(--destructive)' }}
              >
                {rollingBack ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
                {rollingBack ? 'Rolling back...' : 'Rollback'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedVersion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowDeleteConfirm(false)}
          />
          <div
            className="relative z-10 w-full max-w-md rounded-2xl border p-6 shadow-2xl"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <div className="mb-4 flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{
                  background: 'color-mix(in oklch, oklch(0.65 0.22 25) 15%, transparent)',
                  color: 'var(--destructive)',
                }}
              >
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Delete Version</h3>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  Are you sure you want to delete "{selectedVersion.name}"?
                </p>
              </div>
            </div>

            <div
              className="mb-4 rounded-xl p-3 text-xs"
              style={{
                background: 'var(--muted)',
                color: 'var(--muted-foreground)',
              }}
            >
              <p className="mb-1 font-medium">Version details:</p>
              <p>{getVersionSummary(selectedVersion)}</p>
              <p className="mt-1">Created {timeAgo(selectedVersion.timestamp)}</p>
            </div>

            <p className="mb-4 text-xs" style={{ color: 'var(--destructive)' }}>
              This action cannot be undone. The version will be permanently removed.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 rounded-xl border px-4 py-2 text-sm font-medium transition-all"
                style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white transition-all"
                style={{ background: 'var(--destructive)' }}
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}