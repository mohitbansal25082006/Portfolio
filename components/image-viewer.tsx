'use client'

/* ============================================================================ */
//   components/image-viewer.tsx
//   Full-screen image viewer / lightbox.
/* ============================================================================ */

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Minus, Plus, RotateCcw, X } from 'lucide-react'

const MIN_ZOOM = 1
const MAX_ZOOM = 4
const DOUBLE_TAP_ZOOM = 2

export interface ImageViewerProps {
  /** Full list of image URLs in this set. */
  images: string[]
  /** Index of the currently active image (controlled). */
  index: number
  /** Called with the new index whenever the viewer navigates. */
  onIndexChange: (index: number) => void
  /** Whether the viewer is open. */
  open: boolean
  /** Called when the viewer should close (Esc, backdrop click, × button). */
  onClose: () => void
  /** Base alt text — the viewer appends "screenshot N of M". */
  alt?: string
  /** Optional per-image captions, same length/order as `images`. */
  captions?: string[]
}

function distanceBetweenTouches(t: React.TouchList | TouchList) {
  const [a, b] = [t[0], t[1]]
  if (!a || !b) return 0
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
}

export function ImageViewer({ images, index, onIndexChange, open, onClose, alt = 'Image', captions }: ImageViewerProps) {
  const total = images.length
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)

  const dragStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)
  const pinchStart = useRef<{ dist: number; zoom: number } | null>(null)
  const swipeStart = useRef<{ x: number; y: number } | null>(null)
  const lastTapRef = useRef(0)
  const dragHappened = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const goTo = useCallback((i: number) => {
    if (total === 0) return
    const next = ((i % total) + total) % total
    onIndexChange(next)
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [total, onIndexChange])

  const next = useCallback(() => goTo(index + 1), [goTo, index])
  const prev = useCallback(() => goTo(index - 1), [goTo, index])

  const resetZoom = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }) }, [])
  const zoomIn = useCallback(() => setZoom((z) => Math.min(MAX_ZOOM, +(z + 0.5).toFixed(2))), [])
  const zoomOut = useCallback(() => setZoom((z) => {
    const nz = Math.max(MIN_ZOOM, +(z - 0.5).toFixed(2))
    if (nz === 1) setPan({ x: 0, y: 0 })
    return nz
  }), [])

  // Lock the body completely while open
  useEffect(() => {
    if (!open) return
    const scrollY = window.scrollY
    const body = document.body
    const html = document.documentElement
    
    const prev = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
      scrollBehavior: html.style.scrollBehavior,
    }
    
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.width = '100%'
    body.style.overflow = 'hidden'

    setZoom(1)
    setPan({ x: 0, y: 0 })

    return () => {
      // Restore body styles
      body.style.position = prev.position
      body.style.top = prev.top
      body.style.left = prev.left
      body.style.right = prev.right
      body.style.width = prev.width
      body.style.overflow = prev.overflow
      
      // Temporarily disable smooth scrolling to prevent the browser
      // from animating the jump back to the original scroll position.
      html.style.scrollBehavior = 'auto'
      window.scrollTo(0, scrollY)
      
      // Restore smooth scrolling on the next frame
      requestAnimationFrame(() => {
        html.style.scrollBehavior = prev.scrollBehavior
      })
    }
  }, [open])

  // Keyboard controls
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'ArrowRight') next()
      else if (e.key === '0') resetZoom()
      else if (e.key === '+' || e.key === '=') zoomIn()
      else if (e.key === '-') zoomOut()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, prev, next, resetZoom, zoomIn, zoomOut, onClose])

  // Global mouse listeners for robust dragging (prevents drag from breaking 
  // if the cursor leaves the container)
  useEffect(() => {
    if (!isDragging) return

    const onMouseMove = (e: MouseEvent) => {
      if (!dragStart.current) return
      const dx = e.clientX - dragStart.current.x
      const dy = e.clientY - dragStart.current.y
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragHappened.current = true
      setPan({ x: dragStart.current.panX + dx, y: dragStart.current.panY + dy })
    }

    const onMouseUp = () => {
      setIsDragging(false)
      dragStart.current = null
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [isDragging])

  // Native non-passive touch & wheel listeners to prevent body scroll when panning
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1 && zoom > 1) {
        e.preventDefault() // Forcefully stop the browser from scrolling the page
        if (!dragStart.current) return
        const t = e.touches[0]
        const dx = t.clientX - dragStart.current.x
        const dy = t.clientY - dragStart.current.y
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragHappened.current = true
        setPan({ x: dragStart.current.panX + dx, y: dragStart.current.panY + dy })
      }
    }

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        if (e.deltaY < 0) zoomIn()
        else zoomOut()
      } else if (zoom > 1) {
        e.preventDefault()
        setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }))
      }
    }

    container.addEventListener('touchmove', onTouchMove, { passive: false })
    container.addEventListener('wheel', onWheel, { passive: false })
    
    return () => {
      container.removeEventListener('touchmove', onTouchMove)
      container.removeEventListener('wheel', onWheel)
    }
  }, [zoom, zoomIn, zoomOut])

  if (!open) return null

  const currentAlt = `${alt} — screenshot ${index + 1} of ${total}`
  const caption = captions?.[index]

  /* ---------------- Mouse handlers (desktop pan) ---------------- */
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return
    e.preventDefault() // prevent image ghosting/text selection
    dragHappened.current = false
    setIsDragging(true)
    dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }
  }

  const handleDoubleClick = () => {
    if (zoom > 1) resetZoom()
    else setZoom(DOUBLE_TAP_ZOOM)
  }

  /* ---------------- Touch handlers (mobile swipe / pinch / pan) ---------------- */
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinchStart.current = { dist: distanceBetweenTouches(e.touches), zoom }
      swipeStart.current = null
      return
    }
    if (e.touches.length === 1) {
      const t = e.touches[0]
      if (zoom > 1) {
        dragHappened.current = false
        dragStart.current = { x: t.clientX, y: t.clientY, panX: pan.x, panY: pan.y }
        swipeStart.current = null
      } else {
        swipeStart.current = { x: t.clientX, y: t.clientY }
      }

      const now = Date.now()
      if (now - lastTapRef.current < 300) {
        handleDoubleClick()
        swipeStart.current = null
      }
      lastTapRef.current = now
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    pinchStart.current = null
    dragStart.current = null
    if (swipeStart.current && zoom <= 1) {
      const endX = e.changedTouches[0]?.clientX ?? swipeStart.current.x
      const endY = e.changedTouches[0]?.clientY ?? swipeStart.current.y
      const dx = endX - swipeStart.current.x
      const dy = endY - swipeStart.current.y
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        dragHappened.current = true // Prevent click interference
        dx > 0 ? prev() : next()
      }
    }
    swipeStart.current = null
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    // Prevent closing if the user just finished dragging the image around
    if (dragHappened.current) {
      dragHappened.current = false
      return
    }
    if (e.target === e.currentTarget) onClose()
  }

  // Render via Portal to escape parent CSS transforms (stops layout flicker)
  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex flex-col overflow-hidden bg-background/95 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={currentAlt}
      onClick={handleBackdropClick}
    >
      {/* Top bar */}
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <span className="rounded-full border border-border bg-card/80 px-3 py-1.5 font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase backdrop-blur">
          {index + 1} / {total}
        </span>

        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="hidden items-center gap-1 rounded-full border border-border bg-card/80 p-1 backdrop-blur sm:flex">
            <button
              type="button"
              onClick={zoomOut}
              disabled={zoom <= MIN_ZOOM}
              className="grid size-8 place-items-center rounded-full text-foreground transition-colors hover:bg-muted disabled:opacity-30"
              aria-label="Zoom out"
            >
              <Minus className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={resetZoom}
              className="min-w-12 rounded-full px-2 py-1 text-center font-mono text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Reset zoom"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={zoomIn}
              disabled={zoom >= MAX_ZOOM}
              className="grid size-8 place-items-center rounded-full text-foreground transition-colors hover:bg-muted disabled:opacity-30"
              aria-label="Zoom in"
            >
              <Plus className="size-3.5" />
            </button>
          </div>
          {zoom > 1 && (
            <button
              type="button"
              onClick={resetZoom}
              className="grid size-9 place-items-center rounded-full border border-border bg-card/80 text-foreground backdrop-blur transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground sm:hidden"
              aria-label="Reset zoom"
            >
              <RotateCcw className="size-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-full border border-border bg-card/80 text-foreground backdrop-blur transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
            aria-label="Close full-screen view"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Image stage */}
      <div
        ref={containerRef}
        className="relative flex min-h-0 flex-1 select-none items-center justify-center overflow-hidden"
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{ touchAction: zoom > 1 ? 'none' : 'pan-y', cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
      >
        <img
          src={images[index]}
          alt={currentAlt}
          draggable={false}
          className={`h-full w-full object-contain ${isDragging ? '' : 'transition-transform duration-200'}`}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        />

        {/* Arrow navigation */}
        {total > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); prev() }}
              className="absolute left-2 top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-border bg-card/80 text-foreground shadow-lg backdrop-blur transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground sm:left-4 sm:size-12"
              aria-label="Previous screenshot"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); next() }}
              className="absolute right-2 top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-border bg-card/80 text-foreground shadow-lg backdrop-blur transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground sm:right-4 sm:size-12"
              aria-label="Next screenshot"
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        )}
      </div>

      {/* Bottom bar: caption, thumbnail slider, hint text. */}
      <div className="max-h-[34vh] shrink-0 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 sm:px-6 sm:pb-6">
        {caption && (
          <p className="mb-3 text-center text-xs text-muted-foreground sm:text-sm">{caption}</p>
        )}

        {total > 1 && (
          <div className="mx-auto flex max-w-full justify-start gap-2 overflow-x-auto pb-1 sm:justify-center [scrollbar-width:thin]">
            {images.map((img, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                className={`relative h-10 w-16 shrink-0 overflow-hidden rounded-md border transition-all sm:h-12 sm:w-20 ${
                  i === index ? 'border-primary ring-1 ring-primary' : 'border-border opacity-50 hover:opacity-100'
                }`}
                aria-label={`Go to screenshot ${i + 1}`}
                aria-current={i === index}
              >
                <img src={img} alt="" className="h-full w-full object-cover" draggable={false} />
              </button>
            ))}
          </div>
        )}

        <p className="mt-3 text-center font-mono text-[9px] tracking-[0.12em] text-muted-foreground/70 uppercase sm:hidden">
          Swipe to browse · Pinch or double-tap to zoom
        </p>
        <p className="mt-3 hidden text-center font-mono text-[9px] tracking-[0.12em] text-muted-foreground/70 uppercase sm:block">
          ← → to browse · Ctrl/Cmd + scroll or double-click to zoom · Esc to close
        </p>
      </div>
    </div>,
    document.body
  )
}