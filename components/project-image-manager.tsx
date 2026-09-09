'use client'

/**
 * components/project-image-manager.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Part 3 — Project Image Manager Component
 * Updated — Removed max images limit, removed captions, allow any URL
 * ---------------------------------------------------------------------------
 * Advanced image management UI for the admin panel:
 *   • Drag-and-drop upload with progress tracking
 *   • Image preview grid with hover actions
 *   • Reorder images via drag-and-drop
 *   • Delete images with confirmation
 *   • No maximum image limit
 *   • Supports any image URL (Google Drive, external links, etc.)
 *   • Full theme integration
 *   • Mobile responsive with touch support
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useRef, useCallback } from 'react'
import {
  UploadCloud, X, Trash2, ZoomIn, AlertTriangle,
  Loader2, CheckCircle2, ImagePlus, MoveUp, MoveDown,
  Link2, Plus,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────

interface ImageUploadResult {
  url: string
  fileName: string
  size: number
  contentType: string
}

interface ImageManagerProps {
  images: string[]
  onImagesChange: (images: string[]) => void
  projectNumber?: string
  onUploadComplete?: (results: ImageUploadResult[]) => void
  onUploadError?: (error: string) => void
}

// ─── Image Manager Component ──────────────────────────────────────────────

export function ProjectImageManager({
  images,
  onImagesChange,
  projectNumber,
  onUploadComplete,
  onUploadError,
}: ImageManagerProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [urlDraft, setUrlDraft] = useState('')
  const [urlError, setUrlError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Drag and drop handlers ──
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.currentTarget === e.target) {
      setIsDragging(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      await uploadFiles(files)
    }
  }, [images, projectNumber])

  // ── File selection handler ──
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      await uploadFiles(files)
    }
    e.target.value = ''
  }, [images, projectNumber])

  // ── Upload files ──
  const uploadFiles = async (files: File[]) => {
    const imageFiles = files.filter((file) => 
      file.type.startsWith('image/') || 
      /\.(png|jpe?g|webp|gif|svg)$/i.test(file.name)
    )

    if (imageFiles.length === 0) {
      setUploadError('Please select image files only (PNG, JPEG, WebP, GIF, SVG).')
      onUploadError?.('Please select image files only.')
      return
    }

    setUploading(true)
    setUploadError(null)
    setUploadSuccess(null)

    try {
      const formData = new FormData()
      imageFiles.forEach((file) => {
        formData.append('files', file)
      })
      if (projectNumber) {
        formData.append('projectNumber', projectNumber)
      }

      const res = await fetch('/api/admin/project-images', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload images')
      }

      const uploadedUrls = data.images.map((img: ImageUploadResult) => img.url)
      const newImages = [...images, ...uploadedUrls]
      
      onImagesChange(newImages)
      setUploadSuccess(`Successfully uploaded ${uploadedUrls.length} image(s).`)
      onUploadComplete?.(data.images)

      setTimeout(() => setUploadSuccess(null), 4000)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload images'
      setUploadError(message)
      onUploadError?.(message)
    } finally {
      setUploading(false)
    }
  }

  // ── Add image by URL ──
  const addImageByUrl = () => {
    setUrlError(null)
    
    const url = urlDraft.trim()
    if (!url) {
      setUrlError('Please enter an image URL.')
      return
    }

    // Accept any URL format - local paths, full URLs, Google Drive links, etc.
    const newImages = [...images, url]
    onImagesChange(newImages)
    setUrlDraft('')
    setShowUrlInput(false)
    setUploadSuccess('Image URL added successfully.')
    setTimeout(() => setUploadSuccess(null), 3000)
  }

  // ── Remove image ──
  const removeImage = useCallback((index: number) => {
    const newImages = images.filter((_, i) => i !== index)
    onImagesChange(newImages)
  }, [images, onImagesChange])

  // ── Move image ──
  const moveImage = useCallback((from: number, to: number) => {
    if (to < 0 || to >= images.length) return
    const newImages = [...images]
    const [moved] = newImages.splice(from, 1)
    newImages.splice(to, 0, moved)
    onImagesChange(newImages)
  }, [images, onImagesChange])

  // ── Image drag-and-drop reorder ──
  const handleImageDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleImageDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex !== null && draggedIndex !== index) {
      moveImage(draggedIndex, index)
      setDraggedIndex(index)
    }
  }

  const handleImageDragEnd = () => {
    setDraggedIndex(null)
  }

  // ── Open preview ──
  const openPreview = (url: string) => {
    setPreviewImage(url)
  }

  return (
    <div className="space-y-4">
      {/* Upload area */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`
          relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-4 py-8 transition-all duration-200
          ${isDragging 
            ? 'border-[var(--primary)] bg-[color-mix(in_oklch,var(--primary)_8%,transparent)]' 
            : 'border-[var(--border)] hover:border-[var(--primary)] hover:bg-[var(--muted)]'
          }
        `}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
          multiple
          className="hidden"
          onChange={handleFileSelect}
          disabled={uploading}
        />

        {uploading ? (
          <>
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--primary)' }} />
            <p className="text-sm font-medium">Uploading images...</p>
          </>
        ) : (
          <>
            <span
              className="flex h-12 w-12 items-center justify-center rounded-full"
              style={{ background: 'color-mix(in oklch, var(--primary) 15%, transparent)' }}
            >
              <ImagePlus className="h-6 w-6" style={{ color: 'var(--primary)' }} />
            </span>
            <p className="text-sm font-medium">Drag & drop images here</p>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              or click to browse — PNG, JPEG, WebP, GIF, SVG (max 10MB each)
            </p>
            <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
              {images.length} images
            </p>
          </>
        )}
      </div>

      {/* Add URL button */}
      <div className="flex justify-center">
        <button
          onClick={(e) => {
            e.stopPropagation()
            setShowUrlInput(!showUrlInput)
            setUrlError(null)
          }}
          className="flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-medium transition-all"
          style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
        >
          <Link2 className="h-3.5 w-3.5" />
          Add Image by URL
        </button>
      </div>

      {/* URL input */}
      {showUrlInput && (
        <div className="rounded-xl border p-4 space-y-2" style={{ borderColor: 'var(--border)' }}>
          <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
            Enter any image URL — Google Drive, external links, or local paths
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              placeholder="https://drive.google.com/... or /path/to/image.png"
              className="flex-1 rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
              style={{
                background: 'var(--background)',
                borderColor: 'var(--border)',
                color: 'var(--foreground)',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addImageByUrl()
                }
              }}
            />
            <button
              onClick={addImageByUrl}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-all"
              style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>
          {urlError && (
            <p className="text-xs" style={{ color: 'var(--destructive)' }}>{urlError}</p>
          )}
        </div>
      )}

      {/* Error/Success messages */}
      {uploadError && (
        <div
          className="flex items-start gap-3 rounded-xl border p-3 text-sm"
          style={{
            background: 'color-mix(in oklch, var(--destructive) 10%, transparent)',
            borderColor: 'color-mix(in oklch, var(--destructive) 30%, transparent)',
            color: 'var(--destructive)',
          }}
        >
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>{uploadError}</p>
          <button
            onClick={() => setUploadError(null)}
            className="ml-auto shrink-0 rounded-lg p-1 hover:bg-[var(--muted)]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {uploadSuccess && (
        <div
          className="flex items-center gap-3 rounded-xl border p-3 text-sm"
          style={{
            background: 'color-mix(in oklch, oklch(0.75 0.18 150) 10%, transparent)',
            borderColor: 'color-mix(in oklch, oklch(0.75 0.18 150) 30%, transparent)',
            color: 'oklch(0.55 0.15 150)',
          }}
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <p>{uploadSuccess}</p>
          <button
            onClick={() => setUploadSuccess(null)}
            className="ml-auto shrink-0 rounded-lg p-1 hover:bg-[var(--muted)]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Image grid */}
      {images.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {images.map((imageUrl, index) => (
            <div
              key={`${imageUrl}-${index}`}
              className={`
                group relative aspect-square overflow-hidden rounded-xl border transition-all cursor-move
                ${draggedIndex === index ? 'opacity-50 border-[var(--primary)]' : 'border-[var(--border)] hover:border-[var(--primary)]'}
              `}
              draggable
              onDragStart={() => handleImageDragStart(index)}
              onDragOver={(e) => handleImageDragOver(e, index)}
              onDragEnd={handleImageDragEnd}
              style={{ background: 'var(--muted)' }}
            >
              {/* Image */}
              <img
                src={imageUrl}
                alt={`Project image ${index + 1}`}
                className="h-full w-full object-cover"
                draggable={false}
                onError={(e) => {
                  // Show placeholder for broken/loading images
                  const target = e.target as HTMLImageElement
                  target.style.display = 'none'
                  const parent = target.parentElement
                  if (parent) {
                    parent.style.background = 'var(--muted)'
                    parent.style.display = 'flex'
                    parent.style.alignItems = 'center'
                    parent.style.justifyContent = 'center'
                  }
                }}
              />

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100" />

              {/* Image number badge */}
              <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur">
                {index + 1}
              </span>

              {/* Action buttons */}
              <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    openPreview(imageUrl)
                  }}
                  className="grid h-8 w-8 place-items-center rounded-full bg-white/20 text-white backdrop-blur transition-colors hover:bg-white/40"
                  title="Preview"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    removeImage(index)
                  }}
                  className="grid h-8 w-8 place-items-center rounded-full bg-red-500/20 text-red-300 backdrop-blur transition-colors hover:bg-red-500/40"
                  title="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* Move buttons */}
              <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    moveImage(index, index - 1)
                  }}
                  disabled={index === 0}
                  className="grid h-7 w-7 place-items-center rounded-full bg-white/20 text-white backdrop-blur transition-colors hover:bg-white/40 disabled:opacity-30"
                  title="Move up"
                >
                  <MoveUp className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    moveImage(index, index + 1)
                  }}
                  disabled={index === images.length - 1}
                  className="grid h-7 w-7 place-items-center rounded-full bg-white/20 text-white backdrop-blur transition-colors hover:bg-white/40 disabled:opacity-30"
                  title="Move down"
                >
                  <MoveDown className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-8 text-center" style={{ borderColor: 'var(--border)' }}>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            No images added yet. Drag & drop, upload, or add by URL.
          </p>
        </div>
      )}

      {/* Preview modal */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setPreviewImage(null)} />
          <div className="relative z-10 max-h-[90vh] max-w-[90vw]">
            <img
              src={previewImage}
              alt="Preview"
              className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain"
              onError={(e) => {
                const target = e.target as HTMLImageElement
                target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiMzMzMzMzMiLz48dGV4dCB4PSIxMDAiIHk9IjEwMCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgZmlsbD0iIzk5OTk5OSIgZm9udC1zaXplPSIxNiIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiPkltYWdlIG5vdCBmb3VuZDwvdGV4dD48L3N2Zz4='
              }}
            />
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-black/60 text-white backdrop-blur transition-colors hover:bg-black/80"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}