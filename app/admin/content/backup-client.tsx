'use client'

/**
 * app/admin/content/backup-client.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Part 2.10 — Backup/Export UI Component
 * ---------------------------------------------------------------------------
 * One-click JSON backup/export of:
 *   • All content (projects, about, skills, timeline)
 *   • Site settings
 *   • Messages (contact form submissions)
 *   • Version history metadata
 *
 * Also includes import capability for restoring from backup.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useRef } from 'react'
import {
  Download,
  Upload,
  Loader2,
  AlertTriangle,
  Check,
  Database,
  FileJson,
  ShieldCheck,
} from 'lucide-react'

interface BackupClientProps {
  onBackupComplete?: () => void
  onImportComplete?: () => void
}

export default function BackupClient({
  onBackupComplete,
  onImportComplete,
}: BackupClientProps) {
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = async () => {
    setExporting(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/admin/backup', {
        method: 'GET',
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to export backup')
      }

      // Get the filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition')
      const filenameMatch = contentDisposition?.match(/filename="?([^"]+)"?/)
      const filename = filenameMatch?.[1] || `portfolio-backup-${new Date().toISOString().split('T')[0]}.json`

      // Download the file
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setSuccess('Backup exported successfully!')
      setTimeout(() => setSuccess(null), 3000)
      onBackupComplete?.()
    } catch (err: any) {
      setError(err.message || 'Failed to export backup')
      console.error('Export error:', err)
    } finally {
      setExporting(false)
    }
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    setError(null)
    setSuccess(null)

    try {
      // Validate file type
      if (!file.name.endsWith('.json')) {
        throw new Error('Please select a JSON backup file')
      }

      const fileContent = await file.text()
      let backupData: any

      try {
        backupData = JSON.parse(fileContent)
      } catch {
        throw new Error('Invalid JSON file')
      }

      // Basic validation
      if (!backupData.content || !backupData.version) {
        throw new Error('Invalid backup file structure')
      }

      const response = await fetch('/api/admin/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backupData),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'Failed to import backup')
      }

      setSuccess('Backup imported successfully!')
      setTimeout(() => setSuccess(null), 3000)
      onImportComplete?.()
    } catch (err: any) {
      setError(err.message || 'Failed to import backup')
      console.error('Import error:', err)
    } finally {
      setImporting(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div className="rounded-2xl border p-6" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
      <div className="mb-4 flex items-center gap-2">
        <Database className="h-5 w-5" style={{ color: 'var(--primary)' }} />
        <h2 className="text-sm font-semibold">Backup & Export</h2>
      </div>

      <p className="mb-4 text-xs" style={{ color: 'var(--muted-foreground)' }}>
        Export all site data as a JSON file for safekeeping, or import a previously
        exported backup to restore your content.
      </p>

      {success && (
        <div
          className="mb-4 flex items-center gap-2 rounded-xl p-3 text-sm"
          style={{
            background: 'color-mix(in oklch, oklch(0.75 0.18 150) 12%, transparent)',
            color: 'oklch(0.75 0.18 150)',
          }}
        >
          <Check className="h-4 w-4" />
          {success}
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

      <div className="space-y-3">
        {/* Export Button */}
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-all disabled:opacity-50"
          style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
        >
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {exporting ? 'Exporting...' : 'Export Full Backup (JSON)'}
        </button>

        {/* Import Button */}
        <button
          onClick={handleImportClick}
          disabled={importing}
          className="flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-all disabled:opacity-50 hover:border-[var(--primary)] hover:text-[var(--primary)]"
          style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
        >
          {importing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {importing ? 'Importing...' : 'Import Backup'}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* What's included */}
      <div className="mt-4 rounded-xl p-3" style={{ background: 'var(--muted)' }}>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium">
          <FileJson className="h-3.5 w-3.5" />
          What's included in backup:
        </p>
        <ul className="space-y-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
          <li>• All content (projects, about, skills, timeline)</li>
          <li>• Site settings</li>
          <li>• Contact messages</li>
          <li>• Version history metadata</li>
        </ul>
      </div>
    </div>
  )
}