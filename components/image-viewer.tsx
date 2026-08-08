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
const DOUBLE_TAP_MAX_DELAY = 300 // ms
const DOUBLE_TAP_MAX_DISTANCE = 30 // px — how far apart two taps can be and still count as a double-tap

export interface ImageViewerProps {
  images: string[]
  index: number
  onIndexChange: (index: number) => void
  open: boolean
  onClose: () => void
  alt?: string
  captions?: string[]
}

function distanceBetweenTouches(t: React.TouchList | TouchList) {
  const [a, b] = [t[0], t[1]]
  if (!a || !b) return 0
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
}

function midpointOfTouches(t: React.TouchList | TouchList) {
  const [a, b] = [t[0], t[1]]
  if (!a || !b) return { x: 0, y: 0 }
  return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 }
}

export function ImageViewer({ images, index, onIndexChange, open, onClose, alt = 'Image', captions }: ImageViewerProps) {
  const total = images.length
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isGesturing, setIsGesturing] = useState(false)

  const dragStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)
  // pinchStart now also remembers the pinch midpoint (relative to the container center) and the
  // pan at gesture-start, so we can keep the point under the fingers fixed while scale changes.
  const pinchStart = useRef<{
    dist: number
    zoom: number
    panX: number
    panY: number
    originX: number
    originY: number
  } | null>(null)
  const swipeStart = useRef<{ x: number; y: number } | null>(null)
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null)
  const dragHappened = useRef(false)
  // True for the lifetime of a native double-tap so the synthetic onDoubleClick
  // (which some mobile browsers still fire after two quick taps) doesn't also trigger and
  // cause the zoom to toggle in and immediately back out.
  const suppressNextDoubleClick = useRef(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)

  // Refs to track current values inside non-reactive native event listeners
  const zoomRef = useRef(zoom)
  const panRef = useRef(pan)

  useEffect(() => { zoomRef.current = zoom }, [zoom])
  useEffect(() => { panRef.current = pan }, [pan])

  // Helper to apply transforms directly to the DOM for 60fps smoothness (bypasses React render cycle)
  const applyTransform = useCallback(() => {
    if (imageRef.current) {
      imageRef.current.style.transform = `translate(${panRef.current.x}px, ${panRef.current.y}px) scale(${zoomRef.current})`
    }
  }, [])

  const clampPan = useCallback((p: { x: number; y: number }, z: number) => {
    if (z <= 1) return { x: 0, y: 0 }
    return p
  }, [])

  const goTo = useCallback((i: number) => {
    if (total === 0) return
    const next = ((i % total) + total) % total
    onIndexChange(next)
    zoomRef.current = 1
    panRef.current = { x: 0, y: 0 }
    applyTransform()
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [total, onIndexChange, applyTransform])

  const next = useCallback(() => goTo(index + 1), [goTo, index])
  const prev = useCallback(() => goTo(index - 1), [goTo, index])

  const resetZoom = useCallback(() => {
    zoomRef.current = 1
    panRef.current = { x: 0, y: 0 }
    applyTransform()
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [applyTransform])

  const zoomIn = useCallback(() => {
    zoomRef.current = Math.min(MAX_ZOOM, +(zoomRef.current + 0.5).toFixed(2))
    if (zoomRef.current === 1) panRef.current = { x: 0, y: 0 }
    applyTransform()
    setZoom(zoomRef.current)
    setPan(panRef.current)
  }, [applyTransform])

  const zoomOut = useCallback(() => {
    zoomRef.current = Math.max(MIN_ZOOM, +(zoomRef.current - 0.5).toFixed(2))
    if (zoomRef.current === 1) panRef.current = { x: 0, y: 0 }
    applyTransform()
    setZoom(zoomRef.current)
    setPan(panRef.current)
  }, [applyTransform])

  // Zoom toward a specific screen point (used by double-tap / double-click) so the tapped
  // spot stays under the finger/cursor instead of the image re-centering.
  const zoomToward = useCallback((clientX: number, clientY: number, targetZoom: number) => {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const cx = clientX - (rect.left + rect.width / 2)
    const cy = clientY - (rect.top + rect.height / 2)

    if (targetZoom <= 1) {
      zoomRef.current = 1
      panRef.current = { x: 0, y: 0 }
    } else {
      // Solve for the new pan so the point under (cx, cy) stays fixed:
      // screenPoint = pan + contentPoint * zoom  =>  pan_new = screenPoint - contentPoint * zoom_new
      const contentX = (cx - panRef.current.x) / zoomRef.current
      const contentY = (cy - panRef.current.y) / zoomRef.current
      zoomRef.current = targetZoom
      panRef.current = { x: cx - contentX * targetZoom, y: cy - contentY * targetZoom }
    }
    applyTransform()
    setZoom(zoomRef.current)
    setPan(panRef.current)
  }, [applyTransform])

  const handleDoubleClick = useCallback((clientX?: number, clientY?: number) => {
    const goingIn = zoomRef.current <= 1
    const target = goingIn ? DOUBLE_TAP_ZOOM : 1
    if (typeof clientX === 'number' && typeof clientY === 'number') {
      zoomToward(clientX, clientY, target)
    } else {
      zoomRef.current = target
      panRef.current = { x: 0, y: 0 }
      applyTransform()
      setZoom(zoomRef.current)
      setPan(panRef.current)
    }
  }, [applyTransform, zoomToward])

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

    resetZoom()

    return () => {
      body.style.position = prev.position
      body.style.top = prev.top
      body.style.left = prev.left
      body.style.right = prev.right
      body.style.width = prev.width
      body.style.overflow = prev.overflow

      html.style.scrollBehavior = 'auto'
      window.scrollTo(0, scrollY)

      requestAnimationFrame(() => {
        html.style.scrollBehavior = prev.scrollBehavior
      })
    }
  }, [open, resetZoom])

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

  // Global mouse listeners for robust dragging
  useEffect(() => {
    if (!isGesturing) return

    const onMouseMove = (e: MouseEvent) => {
      if (!dragStart.current) return
      const dx = e.clientX - dragStart.current.x
      const dy = e.clientY - dragStart.current.y
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragHappened.current = true
      panRef.current = { x: dragStart.current.panX + dx, y: dragStart.current.panY + dy }
      applyTransform()
    }

    const onMouseUp = () => {
      setIsGesturing(false)
      dragStart.current = null
      setPan(panRef.current) // Sync state on release
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [isGesturing, applyTransform])

  // Native non-passive touch & wheel listeners
  useEffect(() => {
    if (!open) return
    const container = containerRef.current
    if (!container) return

    const onTouchMove = (e: TouchEvent) => {
      // Pinch to zoom — anchor the zoom at the pinch midpoint so the content under the
      // fingers stays put instead of visually "jumping" back to center.
      if (e.touches.length === 2 && pinchStart.current) {
        e.preventDefault()
        const newDist = distanceBetweenTouches(e.touches)
        const scale = newDist / (pinchStart.current.dist || 1)
        const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinchStart.current.zoom * scale))

        const rect = container.getBoundingClientRect()
        const mid = midpointOfTouches(e.touches)
        // Origin is fixed at gesture start (fingers' initial midpoint, relative to container center).
        const { originX, originY, panX, panY, zoom: startZoom } = pinchStart.current
        // Content point under the original midpoint, in un-scaled content space.
        const contentX = (originX - panX) / startZoom
        const contentY = (originY - panY) / startZoom
        // Current finger midpoint (updates as fingers move, so panning-while-pinching works too).
        const currentMidX = mid.x - (rect.left + rect.width / 2)
        const currentMidY = mid.y - (rect.top + rect.height / 2)

        let nextPan = {
          x: currentMidX - contentX * nextZoom,
          y: currentMidY - contentY * nextZoom,
        }
        nextPan = clampPan(nextPan, nextZoom)

        zoomRef.current = nextZoom
        panRef.current = nextPan
        applyTransform()
        return
      }

      // Drag to pan
      if (e.touches.length === 1 && dragStart.current && zoomRef.current > 1) {
        e.preventDefault()
        const t = e.touches[0]
        const dx = t.clientX - dragStart.current.x
        const dy = t.clientY - dragStart.current.y
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragHappened.current = true
        panRef.current = { x: dragStart.current.panX + dx, y: dragStart.current.panY + dy }
        applyTransform()
      }
    }

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        if (e.deltaY < 0) zoomIn()
        else zoomOut()
      } else if (zoomRef.current > 1) {
        e.preventDefault()
        panRef.current = { x: panRef.current.x - e.deltaX, y: panRef.current.y - e.deltaY }
        applyTransform()
      }
    }

    container.addEventListener('touchmove', onTouchMove, { passive: false })
    container.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      container.removeEventListener('touchmove', onTouchMove)
      container.removeEventListener('wheel', onWheel)
    }
  }, [open, applyTransform, zoomIn, zoomOut, clampPan])

  if (!open) return null

  const currentAlt = `${alt} — screenshot ${index + 1} of ${total}`
  const caption = captions?.[index]

  /* ---------------- Mouse handlers (desktop pan) ---------------- */
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return
    e.preventDefault()
    dragHappened.current = false
    setIsGesturing(true)
    dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }
  }

  // Desktop double-click (mouse). Guarded against firing right after a touch double-tap,
  // since some browsers synthesize a click/dblclick after touch events.
  const onImageDoubleClick = (e: React.MouseEvent) => {
    if (suppressNextDoubleClick.current) {
      suppressNextDoubleClick.current = false
      return
    }
    handleDoubleClick(e.clientX, e.clientY)
  }

  /* ---------------- Touch handlers (mobile swipe / pinch / pan) ---------------- */
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsGesturing(true)
    dragHappened.current = false

    if (e.touches.length === 2) {
      const container = containerRef.current
      const rect = container?.getBoundingClientRect()
      const mid = midpointOfTouches(e.touches)
      pinchStart.current = {
        dist: distanceBetweenTouches(e.touches),
        zoom: zoomRef.current,
        panX: panRef.current.x,
        panY: panRef.current.y,
        originX: rect ? mid.x - (rect.left + rect.width / 2) : 0,
        originY: rect ? mid.y - (rect.top + rect.height / 2) : 0,
      }
      dragStart.current = null
      swipeStart.current = null
      return
    }
    if (e.touches.length === 1) {
      const t = e.touches[0]
      if (zoomRef.current > 1) {
        dragStart.current = { x: t.clientX, y: t.clientY, panX: panRef.current.x, panY: panRef.current.y }
        swipeStart.current = null
      } else {
        swipeStart.current = { x: t.clientX, y: t.clientY }
        dragStart.current = null
      }
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    // Transition from pinch to drag (user lifted one finger but left one down)
    if (pinchStart.current && e.touches.length === 1) {
      pinchStart.current = null
      const t = e.touches[0]
      if (zoomRef.current > 1) {
        dragStart.current = { x: t.clientX, y: t.clientY, panX: panRef.current.x, panY: panRef.current.y }
        dragHappened.current = true // this was a pinch — never treat the remaining finger as a fresh tap
      }
      return
    }

    // Pinch ended (both fingers lifted in the same event — some Android browsers report it this way
    // instead of going through the 2→1→0 handoff above)
    if (pinchStart.current && e.touches.length === 0) {
      pinchStart.current = null
      dragStart.current = null
      setIsGesturing(false)
      setZoom(zoomRef.current)
      setPan(panRef.current)
      return
    }

    // Drag ended (this also covers "last finger lifted after a pinch", since the pinch→drag
    // transition above hands off into dragStart — so we must sync zoom here too, not just pan,
    // or React's zoom state stays stale and the next render snaps the image back to it)
    if (dragStart.current && e.touches.length === 0) {
      dragStart.current = null
      setIsGesturing(false)
      setZoom(zoomRef.current)
      setPan(panRef.current)
      return
    }

    // Swipe / Tap ended (only counts if we were at 100% zoom and nothing else happened)
    if (swipeStart.current && zoomRef.current <= 1 && e.touches.length === 0) {
      const endX = e.changedTouches[0]?.clientX ?? swipeStart.current.x
      const endY = e.changedTouches[0]?.clientY ?? swipeStart.current.y
      const dx = endX - swipeStart.current.x
      const dy = endY - swipeStart.current.y

      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        // It was a swipe
        dragHappened.current = true
        lastTapRef.current = null
        dx > 0 ? prev() : next()
      } else if (!dragHappened.current) {
        // It was a tap (not a drag/jitter). Check for double tap.
        const now = Date.now()
        const last = lastTapRef.current
        const closeEnough =
          last && Math.hypot(endX - last.x, endY - last.y) <= DOUBLE_TAP_MAX_DISTANCE
        if (last && now - last.time < DOUBLE_TAP_MAX_DELAY && closeEnough) {
          suppressNextDoubleClick.current = true
          handleDoubleClick(endX, endY)
          lastTapRef.current = null // reset so a third tap doesn't chain another toggle
        } else {
          lastTapRef.current = { time: now, x: endX, y: endY }
        }
      }
      swipeStart.current = null
      setIsGesturing(false)
    }
  }

  const handleTouchCancel = () => {
    pinchStart.current = null
    dragStart.current = null
    swipeStart.current = null
    setIsGesturing(false)
    setZoom(zoomRef.current)
    setPan(panRef.current)
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (dragHappened.current) {
      dragHappened.current = false
      return
    }
    if (e.target === e.currentTarget) onClose()
  }

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
        onDoubleClick={onImageDoubleClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        style={{
          touchAction: 'none',
          cursor: zoom > 1 ? (isGesturing ? 'grabbing' : 'grab') : 'default'
        }}
      >
        <img
          ref={imageRef}
          src={images[index]}
          alt={currentAlt}
          draggable={false}
          // Disable transition entirely while gesturing to prevent elastic jitter
          className={`h-full w-full object-contain ${isGesturing ? '' : 'transition-transform duration-200'}`}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
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