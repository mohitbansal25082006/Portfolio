'use client'

/**
 * app/admin/content/backup-client.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Part 2.10 — Backup Client Component
 * Part 3 — Enhanced with image metadata in backups
 * Part 3.1 — Updated with correct info endpoint (?info=true), expanded summary
 * Part 3.2 — Removed unnecessary info line (Backup format / Hero / Stats / Tech Stack / Filters)
 * ---------------------------------------------------------------------------
 * Provides JSON export/import functionality for all site data.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Download, Upload, Loader2, Check, AlertTriangle, Database,
  FileText, Image as ImageIcon, HardDrive, Cloud, FolderKanban,
  BarChart3, Clock, Filter, Navigation, User, Mail,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────

interface BackupInfo {
  contentVersion: string
  projectsCount: number
  timelineCount: number
  skillGroupsCount: number
  statsCount: number
  techStackCount: number
  filtersCount: number
  navItemsCount: number
  pillarsCount: number
  interestsCount: number
  paragraphsCount: number
  categoriesCount: number
  imagesCount: number
  totalImageSize: number
  versionsCount: number
  messagesCount: number
  hasSettings: boolean
}

interface BackupClientProps {
  onBackupComplete?: () => void
  onImportComplete?: () => Promise<void>
}

// ─── Helper functions ─────────────────────────────────────────────────────

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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

// ─── Main Component ───────────────────────────────────────────────────────

export default function BackupClient({ onBackupComplete, onImportComplete }: BackupClientProps) {
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [loadingInfo, setLoadingInfo] = useState(true)
  const [exportError, setExportError] = useState<string | null>(null)
  const [exportSuccess, setExportSuccess] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState<string | null>(null)
  const [lastExportedAt, setLastExportedAt] = useState<string | null>(null)
  const [lastImportedAt, setLastImportedAt] = useState<string | null>(null)
  const [backupInfo, setBackupInfo] = useState<BackupInfo | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadBackupInfo = useCallback(async () => {
    setLoadingInfo(true)
    try {
      const res = await fetch('/api/admin/backup?info=true', {
        method: 'GET',
        cache: 'no-store',
      })

      if (!res.ok) {
        console.error('Failed to load backup info:', res.status)
        return
      }

      const data = await res.json()
      if (data.info) {
        setBackupInfo(data.info)
      }
    } catch (err) {
      console.error('Failed to load backup info:', err)
    } finally {
      setLoadingInfo(false)
    }
  }, [])

  useEffect(() => {
    loadBackupInfo()
  }, [loadBackupInfo])

  const handleExport = async () => {
    setExporting(true)
    setExportError(null)
    setExportSuccess(null)

    try {
      const res = await fetch('/api/admin/backup', {
        method: 'POST',
        cache: 'no-store',
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to export backup')
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `portfolio-backup-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setLastExportedAt(new Date().toISOString())
      setExportSuccess('Backup downloaded successfully.')
      setTimeout(() => setExportSuccess(null), 4000)

      onBackupComplete?.()
      await loadBackupInfo()
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Failed to export backup')
      setTimeout(() => setExportError(null), 5000)
    } finally {
      setExporting(false)
    }
  }

  const handleImport = async (file: File) => {
    if (!file.name.endsWith('.json')) {
      setImportError('Please select a JSON backup file.')
      setTimeout(() => setImportError(null), 5000)
      return
    }

    if (file.size > 50 * 1024 * 1024) {
      setImportError('Backup file is too large. Maximum size is 50MB.')
      setTimeout(() => setImportError(null), 5000)
      return
    }

    setImporting(true)
    setImportError(null)
    setImportSuccess(null)

    try {
      const reader = new FileReader()

      reader.onload = async (e) => {
        try {
          const json = JSON.parse(e.target?.result as string)

          const res = await fetch('/api/admin/backup', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(json),
          })

          const data = await res.json().catch(() => ({}))

          if (!res.ok) {
            throw new Error(data.error || 'Failed to import backup')
          }

          setLastImportedAt(new Date().toISOString())
          setImportSuccess('Backup imported successfully.')
          setTimeout(() => setImportSuccess(null), 4000)

          await onImportComplete?.()
          await loadBackupInfo()
        } catch (err) {
          setImportError(err instanceof Error ? err.message : 'Failed to parse backup file')
          setTimeout(() => setImportError(null), 5000)
        } finally {
          setImporting(false)
        }
      }

      reader.onerror = () => {
        setImportError('Failed to read file. Please try again.')
        setTimeout(() => setImportError(null), 5000)
        setImporting(false)
      }

      reader.readAsText(file)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to import backup')
      setTimeout(() => setImportError(null), 5000)
      setImporting(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleImport(file)
    }
    e.target.value = ''
  }

  const triggerFileSelect = () => {
    if (!importing) {
      fileInputRef.current?.click()
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (importing) return

    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleImport(file)
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Data Summary Card ── */}
      <div className="rounded-xl border p-3 sm:p-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2 mb-3">
          <Database className="h-4 w-4 shrink-0" style={{ color: 'var(--primary)' }} />
          <p className="text-xs sm:text-sm font-semibold">Current Data Summary</p>
          {loadingInfo && (
            <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" style={{ color: 'var(--muted-foreground)' }} />
          )}
        </div>

        {backupInfo ? (
          <>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium" style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}>
                <FolderKanban className="h-3 w-3" /> {backupInfo.projectsCount} projects
              </span>
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium" style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}>
                <BarChart3 className="h-3 w-3" /> {backupInfo.statsCount} stats
              </span>
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium" style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}>
                <Clock className="h-3 w-3" /> {backupInfo.timelineCount} timeline
              </span>
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium" style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}>
                <FileText className="h-3 w-3" /> {backupInfo.skillGroupsCount} skill groups
              </span>
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium" style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}>
                <Filter className="h-3 w-3" /> {backupInfo.filtersCount} filters
              </span>
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium" style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}>
                <Navigation className="h-3 w-3" /> {backupInfo.navItemsCount} nav items
              </span>
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium" style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}>
                <User className="h-3 w-3" /> {backupInfo.pillarsCount} pillars
              </span>
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium" style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}>
                <ImageIcon className="h-3 w-3" /> {backupInfo.imagesCount} images
              </span>
              {backupInfo.totalImageSize > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium" style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}>
                  <HardDrive className="h-3 w-3" /> {formatSize(backupInfo.totalImageSize)}
                </span>
              )}
              {backupInfo.messagesCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium" style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}>
                  <Mail className="h-3 w-3" /> {backupInfo.messagesCount} messages
                </span>
              )}
              {backupInfo.categoriesCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium" style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}>
                  <Filter className="h-3 w-3" /> {backupInfo.categoriesCount} categories
                </span>
              )}
            </div>

            {/* Last operation timestamps */}
            {(lastExportedAt || lastImportedAt) && (
              <div className="mt-2 flex flex-wrap gap-3 text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                {lastExportedAt && (
                  <span>Last exported: {formatDate(lastExportedAt)}</span>
                )}
                {lastImportedAt && (
                  <span>Last imported: {formatDate(lastImportedAt)}</span>
                )}
              </div>
            )}
          </>
        ) : (
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {loadingInfo ? 'Loading data summary...' : 'Failed to load data summary.'}
          </p>
        )}
      </div>

      {/* ── Export Section ── */}
      <div className="rounded-xl border p-3 sm:p-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs sm:text-sm font-semibold">Export JSON Backup</p>
            <p className="mt-0.5 text-[10px] sm:text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Download a complete backup of all content, settings, messages, and image metadata.
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center justify-center gap-2 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium transition-all disabled:opacity-60 active:scale-95 shrink-0"
            style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            <span className="hidden sm:inline">{exporting ? 'Exporting...' : 'Export Backup'}</span>
            <span className="sm:hidden">{exporting ? 'Exporting' : 'Export'}</span>
          </button>
        </div>

        {exportError && (
          <div className="mt-2 flex items-start gap-2 rounded-lg p-2.5 text-xs" style={{ background: 'color-mix(in oklch, var(--destructive) 10%, transparent)', color: 'var(--destructive)' }}>
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span className="flex-1">{exportError}</span>
            <button
              onClick={() => setExportError(null)}
              className="shrink-0 rounded p-0.5 hover:bg-[var(--muted)]"
              aria-label="Dismiss error"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
        {exportSuccess && (
          <div className="mt-2 flex items-center gap-2 rounded-lg p-2.5 text-xs" style={{ background: 'color-mix(in oklch, oklch(0.75 0.18 150) 10%, transparent)', color: 'oklch(0.55 0.15 150)' }}>
            <Check className="h-3.5 w-3.5 shrink-0" /> {exportSuccess}
          </div>
        )}
      </div>

      {/* ── Import Section ── */}
      <div
        className="rounded-xl border p-3 sm:p-4 transition-colors"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs sm:text-sm font-semibold">Import JSON Backup</p>
            <p className="mt-0.5 text-[10px] sm:text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Restore all data from a previously exported backup file. Drag & drop or click to select.
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleFileSelect}
            disabled={importing}
          />
          <button
            onClick={triggerFileSelect}
            disabled={importing}
            className="flex items-center justify-center gap-2 rounded-xl border px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium transition-all disabled:opacity-60 active:scale-95 shrink-0"
            style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
          >
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            <span className="hidden sm:inline">{importing ? 'Importing...' : 'Import Backup'}</span>
            <span className="sm:hidden">{importing ? 'Importing' : 'Import'}</span>
          </button>
        </div>

        {/* Drop zone indicator */}
        <div
          className="mt-3 flex items-center justify-center rounded-lg border border-dashed p-3 sm:p-4 text-center"
          style={{ borderColor: 'var(--border)', background: 'var(--background)' }}
          onClick={triggerFileSelect}
          role="button"
          tabIndex={0}
          aria-label="Drop backup file here or click to select"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              triggerFileSelect()
            }
          }}
        >
          <p className="text-[10px] sm:text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {importing ? 'Importing backup...' : 'Drop backup file here or click to browse'}
          </p>
        </div>

        {importError && (
          <div className="mt-2 flex items-start gap-2 rounded-lg p-2.5 text-xs" style={{ background: 'color-mix(in oklch, var(--destructive) 10%, transparent)', color: 'var(--destructive)' }}>
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span className="flex-1">{importError}</span>
            <button
              onClick={() => setImportError(null)}
              className="shrink-0 rounded p-0.5 hover:bg-[var(--muted)]"
              aria-label="Dismiss error"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
        {importSuccess && (
          <div className="mt-2 flex items-center gap-2 rounded-lg p-2.5 text-xs" style={{ background: 'color-mix(in oklch, oklch(0.75 0.18 150) 10%, transparent)', color: 'oklch(0.55 0.15 150)' }}>
            <Check className="h-3.5 w-3.5 shrink-0" /> {importSuccess}
          </div>
        )}
      </div>

      {/* ── Storage Info ── */}
      <div
        className="flex items-start gap-2 sm:gap-3 rounded-xl border p-3 sm:p-4"
        style={{
          background: 'color-mix(in oklch, var(--primary) 5%, transparent)',
          borderColor: 'color-mix(in oklch, var(--primary) 15%, transparent)',
        }}
      >
        <Cloud className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 mt-0.5" style={{ color: 'var(--primary)' }} />
        <div className="text-[10px] sm:text-xs">
          <p className="font-medium">Backup Storage</p>
          <p className="mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            Backups include all content, settings, messages, and image metadata. Image files themselves
            remain in Vercel Blob or local storage and are referenced by URL in the backup.
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── X icon (inline to avoid extra import) ────────────────────────────────

function X({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}