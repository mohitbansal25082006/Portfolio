'use client'

/**
 * app/admin/content/backup-client.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Part 2.10 — Backup Client Component
 * Part 3 — Enhanced with image metadata display
 * ---------------------------------------------------------------------------
 * Provides UI for exporting and importing complete site backups.
 * Now includes image metadata in the backup bundle.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useRef, useCallback } from 'react'
import {
  Download, Upload, Loader2, CheckCircle2, AlertTriangle,
  Database, Image as ImageIcon, HardDrive,
} from 'lucide-react'

interface BackupClientProps {
  onBackupComplete?: () => void
  onImportComplete?: () => void
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

export default function BackupClient({
  onBackupComplete,
  onImportComplete,
}: BackupClientProps) {
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [lastBackupInfo, setLastBackupInfo] = useState<{
    exportedAt: string
    totalImages: number
    totalImageSize: number
    contentVersionsCount: number
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = useCallback(async () => {
    setExporting(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/admin/backup', {
        method: 'GET',
      })

      if (!res.ok) {
        throw new Error('Failed to export backup')
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

      // Parse the blob to get metadata
      const text = await blob.text()
      const data = JSON.parse(text)
      setLastBackupInfo({
        exportedAt: data.exportedAt,
        totalImages: data.metadata?.totalImages || 0,
        totalImageSize: data.metadata?.totalImageSize || 0,
        contentVersionsCount: data.metadata?.contentVersionsCount || 0,
      })

      setSuccess('Backup exported successfully')
      setTimeout(() => setSuccess(null), 4000)
      onBackupComplete?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export backup')
    } finally {
      setExporting(false)
    }
  }, [onBackupComplete])

  const handleImport = useCallback(async (file: File) => {
    setImporting(true)
    setError(null)
    setSuccess(null)

    try {
      const text = await file.text()
      const data = JSON.parse(text)

      const res = await fetch('/api/admin/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || 'Failed to import backup')
      }

      setSuccess('Backup imported successfully')
      setTimeout(() => setSuccess(null), 4000)
      onImportComplete?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import backup')
    } finally {
      setImporting(false)
    }
  }, [onImportComplete])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleImport(file)
    }
    e.target.value = ''
  }, [handleImport])

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {/* Export card */}
      <div className="rounded-2xl border p-5" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3 mb-4">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: 'color-mix(in oklch, var(--primary) 15%, transparent)' }}
          >
            <Download className="h-5 w-5" style={{ color: 'var(--primary)' }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Export Backup</h3>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Download complete site data as JSON
            </p>
          </div>
        </div>

        <p className="text-xs leading-5 mb-4" style={{ color: 'var(--muted-foreground)' }}>
          Includes all content, settings, messages, and image metadata in a single JSON file.
          Does not include actual image files (they remain in Blob storage).
        </p>

        {lastBackupInfo && (
          <div className="mb-4 rounded-xl border p-3 space-y-2" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs font-medium">Last backup</p>
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
              <Database className="h-3.5 w-3.5" />
              {lastBackupInfo.contentVersionsCount} versions
            </div>
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
              <ImageIcon className="h-3.5 w-3.5" />
              {lastBackupInfo.totalImages} images
            </div>
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
              <HardDrive className="h-3.5 w-3.5" />
              {formatSize(lastBackupInfo.totalImageSize)} total image size
            </div>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {new Date(lastBackupInfo.exportedAt).toLocaleString()}
            </p>
          </div>
        )}

        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all disabled:opacity-60"
          style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
        >
          {exporting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Download Backup
            </>
          )}
        </button>
      </div>

      {/* Import card */}
      <div className="rounded-2xl border p-5" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3 mb-4">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: 'color-mix(in oklch, oklch(0.75 0.18 220) 15%, transparent)' }}
          >
            <Upload className="h-5 w-5" style={{ color: 'oklch(0.75 0.18 220)' }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Import Backup</h3>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Restore site data from a JSON file
            </p>
          </div>
        </div>

        <p className="text-xs leading-5 mb-4" style={{ color: 'var(--muted-foreground)' }}>
          Restore previously exported content, settings, and image references.
          This will overwrite current content with the backup data.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={handleFileSelect}
          disabled={importing}
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all disabled:opacity-60"
          style={{
            background: 'color-mix(in oklch, oklch(0.75 0.18 220) 15%, transparent)',
            color: 'oklch(0.75 0.18 220)',
          }}
        >
          {importing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Importing...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Select Backup File
            </>
          )}
        </button>
      </div>

      {/* Error/Success messages */}
      {error && (
        <div
          className="col-span-full flex items-start gap-3 rounded-xl border p-4 text-sm"
          style={{
            background: 'color-mix(in oklch, var(--destructive) 10%, transparent)',
            borderColor: 'color-mix(in oklch, var(--destructive) 30%, transparent)',
            color: 'var(--destructive)',
          }}
        >
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div
          className="col-span-full flex items-center gap-3 rounded-xl border p-4 text-sm"
          style={{
            background: 'color-mix(in oklch, oklch(0.75 0.18 150) 10%, transparent)',
            borderColor: 'color-mix(in oklch, oklch(0.75 0.18 150) 30%, transparent)',
            color: 'oklch(0.55 0.15 150)',
          }}
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <p>{success}</p>
        </div>
      )}
    </div>
  )
}