'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type WheelEvent as ReactWheelEvent,
} from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Loader2,
  Maximize2,
  Minus,
  Plus,
  RotateCw,
  X,
  ZoomIn,
} from 'lucide-react'

/**
 * Advanced PDF viewer
 * ---------------------------------------------------------------------------
 * Renders PDF pages to <canvas> using pdfjs-dist instead of relying on the
 * browser's native PDF plugin.
 *
 * ARCHITECTURE (v3 — transform-based, not scroll-based)
 * ---------------------------------------------------------------------------
 * Earlier versions tried to layer manual "pan" on top of a native scrolling
 * container (mutating el.scrollLeft/scrollTop under touch handlers). That
 * fights the browser's own scroll/gesture recognizer — on real phones this
 * is exactly why pinch felt jumpy, double-tap zoomed to the wrong spot, and
 * horizontal drag did nothing (native scroll containers only "own" the axis
 * that overflows, so a page narrower than the viewport never picks up
 * horizontal drags at all).
 *
 * This version follows the pattern used by production canvas/map/PDF tools
 * (Google Maps, Photopea, pdf.js's own experiments, Figma's mobile viewer):
 *   - Track pan (x, y) and scale purely as React state / refs.
 *   - Render everything inside one wrapper with a single
 *     `transform: translate(x, y) scale(s)`.
 *   - Every gesture (wheel, pinch, drag, double-tap) is just math that
 *     updates x, y, s — never touches scrollLeft/scrollTop.
 *   - The outer viewport is a plain overflow:hidden box, so there is no
 *     competing scroll container at all; touch-action is 'none' the whole
 *     time and *all* single/multi-finger movement is handled by us.
 * This makes zoom-toward-a-point trivial (it's the same math for wheel,
 * pinch, and double-tap) and makes pan work identically in every direction
 * because it's just x/y translation, not axis-constrained scrolling.
 * ---------------------------------------------------------------------------
 */

const MIN_SCALE = 0.5
const MAX_SCALE = 4
const BASE_RENDER_SCALE = 1.5 // render pages at higher res for crisp zoom
const MAX_OUTPUT_SCALE = 2 // cap devicePixelRatio scaling so canvas pixel
// dimensions never exceed mobile GPU texture limits at high zoom.
const DOUBLE_TAP_MS = 300
const DOUBLE_TAP_SLOP = 24 // px — how far apart two taps can be and still count as one gesture

type PDFDocumentProxy = any
type PDFPageProxy = any

let pdfjsLibPromise: Promise<any> | null = null
function loadPdfJs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import('pdfjs-dist').then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${mod.version}/pdf.worker.min.mjs`
      return mod
    })
  }
  return pdfjsLibPromise
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

/* ============================== Canvas Page ============================== */
function PdfPage({
  page,
  renderScale,
  rotation,
  pageNumber,
  onVisible,
}: {
  page: PDFPageProxy
  renderScale: number
  rotation: number
  pageNumber: number
  onVisible: (n: number) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const renderTaskRef = useRef<any>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && e.intersectionRatio > 0.5) onVisible(pageNumber)
        })
      },
      { threshold: [0.5] },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [pageNumber, onVisible])

  useEffect(() => {
    let cancelled = false
    const canvas = canvasRef.current
    if (!canvas || !page) return

    const viewport = page.getViewport({ scale: renderScale, rotation })
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rawOutputScale = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    const outputScale = Math.min(rawOutputScale, MAX_OUTPUT_SCALE)
    canvas.width = Math.floor(viewport.width * outputScale)
    canvas.height = Math.floor(viewport.height * outputScale)
    canvas.style.width = `${Math.floor(viewport.width)}px`
    canvas.style.height = `${Math.floor(viewport.height)}px`

    const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined

    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel()
      } catch {
        /* noop */
      }
    }

    const task = page.render({ canvasContext: ctx, viewport, transform })
    renderTaskRef.current = task
    task.promise.catch((err: any) => {
      if (!cancelled && err?.name !== 'RenderingCancelledException') {
        console.error('PDF page render error', err)
      }
    })

    return () => {
      cancelled = true
      try {
        task.cancel()
      } catch {
        /* noop */
      }
    }
  }, [page, renderScale, rotation])

  return (
    <div ref={wrapRef} data-page={pageNumber} className="flex justify-center py-2">
      <canvas ref={canvasRef} className="rounded-lg bg-white shadow-lg" />
    </div>
  )
}

/* ============================== Fullscreen Modal ============================== */
function PdfModal({ url, fileName, onClose }: { url: string; fileName: string; onClose: () => void }) {
  const [pages, setPages] = useState<PDFPageProxy[]>([])
  const [numPages, setNumPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [jumpValue, setJumpValue] = useState('1')

  // ---- Pan/zoom state, applied as a single CSS transform ----
  // `fitScale` is the scale at which the first page fits the viewport on
  // both width and height (computed once layout is known) — this becomes
  // the baseline "100%" for the mobile-open experience, and MIN_SCALE is
  // expressed relative to it so a user can still zoom out a little further
  // than fit if they want to see two-up or just breathe.
  const [fitScale, setFitScale] = useState<number | null>(null)
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const transformRef = useRef(transform)
  transformRef.current = transform

  const viewportRef = useRef<HTMLDivElement>(null) // outer, fixed-size, overflow:hidden
  const contentRef = useRef<HTMLDivElement>(null) // inner, gets the transform

  /* -------- Gesture refs (no re-renders while dragging/pinching) -------- */
  const drag = useRef<{ active: boolean; startX: number; startY: number; startTX: number; startTY: number; moved: boolean } | null>(null)
  const pinch = useRef<{
    startDist: number
    startScale: number
    startTX: number
    startTY: number
    // Anchor point in viewport-local coordinates (fixed reference frame,
    // doesn't move as the transform changes).
    anchorVX: number
    anchorVY: number
  } | null>(null)
  const lastTap = useRef({ time: 0, x: 0, y: 0 })
  const rafPending = useRef(false)

  const applyTransform = useCallback((next: { x: number; y: number; scale: number }) => {
    transformRef.current = next
    if (rafPending.current) return
    rafPending.current = true
    requestAnimationFrame(() => {
      rafPending.current = false
      setTransform({ ...transformRef.current })
    })
  }, [])

  /* -------- Load document -------- */
  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    loadPdfJs()
      .then((pdfjsLib) => pdfjsLib.getDocument(url).promise)
      .then(async (doc: PDFDocumentProxy) => {
        if (cancelled) return
        setNumPages(doc.numPages)
        const loaded: PDFPageProxy[] = []
        for (let i = 1; i <= doc.numPages; i++) {
          loaded.push(await doc.getPage(i))
        }
        if (cancelled) return
        setPages(loaded)
        setStatus('ready')
      })
      .catch((err) => {
        console.error('Failed to load PDF', err)
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [url])

  /* -------- Lock body scroll while modal open -------- */
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    const prevTouchAction = document.body.style.touchAction
    document.body.style.overflow = 'hidden'
    document.body.style.touchAction = 'none'
    return () => {
      document.body.style.overflow = prevOverflow
      document.body.style.touchAction = prevTouchAction
    }
  }, [])

  /**
   * Compute the "fit to screen" scale once the first page has rendered and
   * the viewport is measured, then center it — this is what makes the
   * viewer open already showing the whole page on small screens instead of
   * a zoomed-in slice of it.
   *
   * MOBILE ONLY: on desktop/tablet widths we keep the original behavior
   * (open at 100% / scale 1, no auto-fit) since desktop screens are usually
   * plenty tall/wide already and users there expect the classic "100%"
   * starting point, not an auto-shrunk page.
   *
   * Runs whenever pages/rotation change (rotation swaps page width/height,
   * so a portrait page rotated 90° needs re-fitting), but only actually
   * moves the view if the user hasn't already interacted with zoom — we
   * detect "hasn't interacted" via a ref rather than transform.scale itself,
   * since scale === fitScale right after fitting and we don't want a resize
   * to also count as "already interacted".
   */
  useEffect(() => {
    if (status !== 'ready' || pages.length === 0) return

    const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 768

    if (!isMobileViewport) {
      // Desktop/tablet: keep the original default — open at scale 1,
      // centered, no fit-to-screen shrinking.
      setFitScale(1)
      const viewport = viewportRef.current
      const content = contentRef.current
      const firstPageCanvas = content?.querySelector<HTMLCanvasElement>('[data-page="1"] canvas')
      if (viewport && firstPageCanvas) {
        const centeredX = (viewport.clientWidth - firstPageCanvas.clientWidth) / 2
        applyTransform({ x: centeredX, y: 12, scale: 1 })
      } else {
        applyTransform({ x: 0, y: 0, scale: 1 })
      }
      return
    }

    let attempts = 0
    let cancelled = false

    const tryFit = () => {
      if (cancelled) return
      const viewport = viewportRef.current
      const content = contentRef.current
      const firstPageCanvas = content?.querySelector<HTMLCanvasElement>('[data-page="1"] canvas')

      if (!viewport || !content || !firstPageCanvas || firstPageCanvas.clientWidth === 0) {
        // Canvas hasn't painted its CSS size yet (render is async) — retry
        // for a few frames rather than falling back to an unfit default.
        if (attempts++ < 30) requestAnimationFrame(tryFit)
        return
      }

      const vw = viewport.clientWidth
      const vh = viewport.clientHeight
      // Horizontal padding on the content wrapper (px-3 on mobile) eats
      // into available fit width — account for it so the page doesn't get
      // clipped at the sides at "fit" scale.
      const horizontalPadding = 24
      const pageWidth = firstPageCanvas.clientWidth
      const pageHeight = firstPageCanvas.clientHeight

      const scaleToFitWidth = (vw - horizontalPadding) / pageWidth
      const scaleToFitHeight = (vh - 24) / pageHeight
      const computedFit = clamp(Math.min(scaleToFitWidth, scaleToFitHeight), 0.1, 1)

      setFitScale(computedFit)

      // Center the fitted page horizontally; align near the top vertically
      // (with small breathing room) rather than dead-center, since that
      // reads more naturally for a document and matches where "page 1"
      // navigation resets to.
      const fittedWidth = pageWidth * computedFit
      const centeredX = (vw - fittedWidth) / 2
      applyTransform({ x: centeredX, y: 12, scale: computedFit })
    }

    requestAnimationFrame(tryFit)
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, pages.length, rotation])

  /**
   * Zooms so that `nextScale` applies while the content point currently
   * under viewport coordinate (vx, vy) stays visually fixed there.
   * This is the single piece of math reused by wheel-zoom, pinch-zoom, and
   * double-tap-zoom — the thing that makes all three "just work" once
   * correct, instead of needing separate hacks per gesture.
   */
  const zoomToward = useCallback((nextScale: number, vx: number, vy: number) => {
    const t = transformRef.current
    // Bounds are expressed relative to the fitted scale (once known) so
    // "zoom out as far as possible" means "see the whole page" rather than
    // some arbitrary absolute number that might be way smaller or larger
    // than the page actually needs on this screen.
    const lowerBound = fitScale ? fitScale * 0.5 : MIN_SCALE
    const upperBound = fitScale ? Math.max(MAX_SCALE, fitScale * MAX_SCALE) : MAX_SCALE
    const clamped = clamp(Math.round(nextScale * 1000) / 1000, lowerBound, upperBound)
    if (clamped === t.scale) return
    const ratio = clamped / t.scale
    // Content-space point currently under (vx, vy): (vx - t.x) / t.scale.
    // We want: newX + contentPoint * clamped === vx  =>  newX = vx - contentPoint * clamped
    const contentX = (vx - t.x) / t.scale
    const contentY = (vy - t.y) / t.scale
    const newX = vx - contentX * clamped
    const newY = vy - contentY * clamped
    applyTransform({ x: newX, y: newY, scale: clamped })
  }, [applyTransform, fitScale])

  const zoomBy = useCallback((delta: number) => {
    const viewport = viewportRef.current
    const rect = viewport?.getBoundingClientRect()
    const vx = rect ? rect.width / 2 : 0
    const vy = rect ? rect.height / 2 : 0
    const nextScale = transformRef.current.scale + delta
    zoomToward(nextScale, vx, vy)
  }, [zoomToward])

  const resetView = useCallback(() => {
    setRotation(0)
    const viewport = viewportRef.current
    const content = contentRef.current
    const firstPageCanvas = content?.querySelector<HTMLCanvasElement>('[data-page="1"] canvas')
    if (viewport && firstPageCanvas && fitScale) {
      const vw = viewport.clientWidth
      const fittedWidth = firstPageCanvas.clientWidth * fitScale
      applyTransform({ x: (vw - fittedWidth) / 2, y: 12, scale: fitScale })
    } else {
      applyTransform({ x: 0, y: 0, scale: fitScale ?? 1 })
    }
  }, [applyTransform, fitScale])

  /** Clamp pan so content can't be dragged arbitrarily far off-screen. */
  const clampPan = useCallback((x: number, y: number, scale: number) => {
    const viewport = viewportRef.current
    const content = contentRef.current
    if (!viewport || !content) return { x, y }
    const vw = viewport.clientWidth
    const vh = viewport.clientHeight
    const cw = content.scrollWidth * scale
    const ch = content.scrollHeight * scale
    // Allow a little overscroll slack for a natural feel, then let the
    // rubber-band-free clamp pull it back on release.
    const slackX = Math.max(0, (vw - cw) / 2)
    const slackY = Math.max(0, (vh - ch) / 2)
    const minX = cw <= vw ? slackX : vw - cw
    const maxX = cw <= vw ? slackX : 0
    const minY = ch <= vh ? Math.max(slackY, 40) : vh - ch - 40
    const maxY = ch <= vh ? Math.max(slackY, 40) : 40
    return { x: clamp(x, minX, maxX), y: clamp(y, minY, maxY) }
  }, [])

  const goToPage = useCallback(
    (n: number) => {
      const target = clamp(n, 1, numPages || 1)
      setCurrentPage(target)
      setJumpValue(String(target))
      const content = contentRef.current
      const viewport = viewportRef.current
      const pageEl = content?.querySelector<HTMLElement>(`[data-page="${target}"]`)
      if (pageEl && content && viewport) {
        // Reset to fit-scale and translate so the target page's top aligns
        // with the viewport top — since we no longer use native scroll,
        // "jump to page" is done by adjusting our own transform instead of
        // scrollIntoView.
        const scale = fitScale ?? 1
        const offsetTop = pageEl.offsetTop * scale
        const pageCanvas = pageEl.querySelector<HTMLCanvasElement>('canvas')
        const fittedWidth = (pageCanvas?.clientWidth ?? 0) * scale
        const centeredX = fittedWidth ? (viewport.clientWidth - fittedWidth) / 2 : 0
        applyTransform({ x: centeredX, y: -offsetTop + 12, scale })
      }
    },
    [numPages, applyTransform, fitScale],
  )

  /* -------- Keyboard controls -------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight' || e.key === 'PageDown') goToPage(currentPage + 1)
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') goToPage(currentPage - 1)
      else if (e.key === '+' || e.key === '=') zoomBy(0.2)
      else if (e.key === '-') zoomBy(-0.2)
      else if (e.key === '0') resetView()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, numPages])

  /* -------- Wheel: ctrl/cmd = zoom-toward-cursor; plain = pan -------- */
  const handleWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    e.preventDefault()
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!rect) return
    const vx = e.clientX - rect.left
    const vy = e.clientY - rect.top

    if (e.ctrlKey || e.metaKey) {
      const MAX_DELTA = 10
      const clampedDelta = clamp(e.deltaY, -MAX_DELTA, MAX_DELTA)
      const factor = Math.pow(2, -clampedDelta * 0.02)
      zoomToward(transformRef.current.scale * factor, vx, vy)
    } else {
      const t = transformRef.current
      const next = clampPan(t.x - e.deltaX, t.y - e.deltaY, t.scale)
      applyTransform({ ...next, scale: t.scale })
    }
  }

  /* -------- Double-click (desktop mouse) zoom, anchored to click point -------- */
  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!rect) return
    const vx = e.clientX - rect.left
    const vy = e.clientY - rect.top
    const t = transformRef.current
    const base = fitScale ?? 1
    zoomToward(t.scale > base * 1.05 ? base : base * 2, vx, vy)
  }

  /* -------- Mouse drag-to-pan (any direction) -------- */
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    const t = transformRef.current
    drag.current = { active: true, startX: e.clientX, startY: e.clientY, startTX: t.x, startTY: t.y, moved: false }
  }
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = drag.current
      if (!d?.active) return
      const dx = e.clientX - d.startX
      const dy = e.clientY - d.startY
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) d.moved = true
      const t = transformRef.current
      const next = clampPan(d.startTX + dx, d.startTY + dy, t.scale)
      applyTransform({ ...next, scale: t.scale })
    }
    const onUp = () => {
      if (drag.current) drag.current.active = false
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [applyTransform, clampPan])

  /* -------- Touch: pinch-to-zoom (anchored) + double-tap + free-direction pan -------- */
  const touchMidpoint = (touches: React.TouchList, rect: DOMRect) => {
    const [a, b] = [touches[0], touches[1]]
    return { x: (a.clientX + b.clientX) / 2 - rect.left, y: (a.clientY + b.clientY) / 2 - rect.top }
  }
  const touchDist = (touches: React.TouchList) => {
    const [a, b] = [touches[0], touches[1]]
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
  }

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!rect) return

    if (e.touches.length === 2) {
      // A second finger landed — always start/refresh a pinch, discarding
      // any single-finger drag in progress so the two gestures never fight.
      drag.current = null
      const t = transformRef.current
      const mid = touchMidpoint(e.touches, rect)
      pinch.current = {
        startDist: touchDist(e.touches),
        startScale: t.scale,
        startTX: t.x,
        startTY: t.y,
        anchorVX: mid.x,
        anchorVY: mid.y,
      }
      return
    }

    if (e.touches.length === 1) {
      const touch = e.touches[0]
      const now = Date.now()
      const dt = now - lastTap.current.time
      const dx = Math.abs(touch.clientX - lastTap.current.x)
      const dy = Math.abs(touch.clientY - lastTap.current.y)

      if (dt > 0 && dt < DOUBLE_TAP_MS && dx < DOUBLE_TAP_SLOP && dy < DOUBLE_TAP_SLOP) {
        // Double-tap confirmed: zoom anchored to the tap point.
        const vx = touch.clientX - rect.left
        const vy = touch.clientY - rect.top
        const t = transformRef.current
        const base = fitScale ?? 1
        zoomToward(t.scale > base * 1.05 ? base : base * 2, vx, vy)
        lastTap.current = { time: 0, x: 0, y: 0 } // consume — avoid triple-tap re-trigger
        drag.current = null
        return
      }

      lastTap.current = { time: now, x: touch.clientX, y: touch.clientY }
      const t = transformRef.current
      drag.current = {
        active: true,
        startX: touch.clientX,
        startY: touch.clientY,
        startTX: t.x,
        startTY: t.y,
        moved: false,
      }
    }
  }

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!rect) return

    if (e.touches.length === 2 && pinch.current) {
      e.preventDefault()
      const p = pinch.current
      const newDist = touchDist(e.touches)
      const rawScale = p.startScale * (newDist / p.startDist)
      const lowerBound = fitScale ? fitScale * 0.5 : MIN_SCALE
      const upperBound = fitScale ? Math.max(MAX_SCALE, fitScale * MAX_SCALE) : MAX_SCALE
      const clampedScale = clamp(Math.round(rawScale * 1000) / 1000, lowerBound, upperBound)
      const ratio = clampedScale / p.startScale
      // Anchor stays fixed under the pinch midpoint (recomputed from the
      // *start* transform each move, so it doesn't drift/accumulate error
      // over a long pinch gesture).
      const contentX = (p.anchorVX - p.startTX) / p.startScale
      const contentY = (p.anchorVY - p.startTY) / p.startScale
      const newX = p.anchorVX - contentX * clampedScale
      const newY = p.anchorVY - contentY * clampedScale
      applyTransform({ x: newX, y: newY, scale: clampedScale })
      return
    }

    if (e.touches.length === 1 && drag.current?.active) {
      e.preventDefault()
      const touch = e.touches[0]
      const d = drag.current
      const dx = touch.clientX - d.startX
      const dy = touch.clientY - d.startY
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) d.moved = true
      const t = transformRef.current
      const next = clampPan(d.startTX + dx, d.startTY + dy, t.scale)
      applyTransform({ ...next, scale: t.scale })
    }
  }

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length < 2) pinch.current = null
    if (e.touches.length === 0) {
      if (drag.current) drag.current.active = false
      // Snap back within bounds with a smooth transition if the user
      // dragged past the clamped edge (rubber-band release feel).
      const t = transformRef.current
      const clamped = clampPan(t.x, t.y, t.scale)
      if (clamped.x !== t.x || clamped.y !== t.y) {
        applyTransform({ ...clamped, scale: t.scale })
      }
    }
  }

  /* -------- Track current page from transform position -------- */
  const handleVisiblePage = useCallback((n: number) => {
    setCurrentPage(n)
    setJumpValue(String(n))
  }, [])

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const n = parseInt(jumpValue, 10)
    if (!Number.isNaN(n)) goToPage(n)
  }

  const isZoomed = fitScale != null && transform.scale > fitScale * 1.02
  const displayPercent = fitScale ? Math.round((transform.scale / fitScale) * 100) : Math.round(transform.scale * 100)

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/95 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Resume PDF viewer">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-black/60 px-3 py-2.5 backdrop-blur-xl md:px-5">
        <div className="flex items-center gap-2 text-white/80">
          <span className="font-mono text-[10px] tracking-[0.14em] uppercase">{fileName}</span>
          {status === 'ready' && (
            <span className="hidden font-mono text-[10px] tracking-[0.1em] text-white/40 sm:inline">
              {numPages} page{numPages === 1 ? '' : 's'}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* Page nav */}
          <div className="flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-1 py-1">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="grid size-7 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/10 disabled:opacity-30"
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" />
            </button>
            <form onSubmit={handleJumpSubmit} className="flex items-center gap-1 px-1">
              <input
                value={jumpValue}
                onChange={(e) => setJumpValue(e.target.value)}
                onBlur={handleJumpSubmit}
                inputMode="numeric"
                className="w-8 rounded bg-transparent text-center font-mono text-xs text-white outline-none"
                aria-label="Go to page"
              />
              <span className="font-mono text-xs text-white/40">/ {numPages || '–'}</span>
            </form>
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= numPages}
              className="grid size-7 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/10 disabled:opacity-30"
              aria-label="Next page"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-1 py-1">
            <button onClick={() => zoomBy(-0.2)} className="grid size-7 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/10" aria-label="Zoom out">
              <Minus className="size-3.5" />
            </button>
            <button onClick={resetView} className="min-w-11 rounded-full px-1 text-center font-mono text-[11px] text-white/80 transition-colors hover:bg-white/10" aria-label="Reset zoom">
              {displayPercent}%
            </button>
            <button onClick={() => zoomBy(0.2)} className="grid size-7 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/10" aria-label="Zoom in">
              <Plus className="size-3.5" />
            </button>
          </div>

          {/* Rotate */}
          <button
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="grid size-9 place-items-center rounded-full border border-white/15 bg-white/5 text-white/80 transition-colors hover:bg-white/10"
            aria-label="Rotate"
          >
            <RotateCw className="size-4" />
          </button>

          {/* Download */}
          <a
            href={url}
            download
            className="grid size-9 place-items-center rounded-full border border-white/15 bg-white/5 text-white/80 transition-colors hover:bg-white/10"
            aria-label="Download PDF"
          >
            <Download className="size-4" />
          </a>

          {/* Open in new tab */}
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="hidden size-9 place-items-center rounded-full border border-white/15 bg-white/5 text-white/80 transition-colors hover:bg-white/10 sm:grid"
            aria-label="Open in new tab"
          >
            <ExternalLink className="size-4" />
          </a>

          {/* Close */}
          <button
            onClick={onClose}
            className="grid size-9 place-items-center rounded-full border border-white/15 bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="Close viewer"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Viewer body — plain overflow:hidden viewport; all movement is our own transform */}
      <div
        ref={viewportRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        className={`relative flex-1 select-none overflow-hidden ${isZoomed ? '[cursor:grab] active:[cursor:grabbing]' : ''}`}
        style={{ touchAction: 'none' }}
      >
        {status === 'loading' && (
          <div className="flex h-full min-h-[50vh] flex-col items-center justify-center gap-3 text-white/60">
            <Loader2 className="size-6 animate-spin" />
            <p className="font-mono text-[10px] tracking-[0.14em] uppercase">Loading resume…</p>
          </div>
        )}

        {status === 'error' && (
          <div className="flex h-full min-h-[50vh] flex-col items-center justify-center gap-3 text-center text-white/70">
            <p className="font-mono text-xs tracking-[0.1em] uppercase">Couldn&apos;t load the preview</p>
            <p className="max-w-xs text-sm text-white/50">You can still download or open the resume directly.</p>
            <div className="mt-2 flex gap-2">
              <a href={url} download className="rounded-full bg-white px-4 py-2 font-mono text-[10px] tracking-[0.12em] text-black uppercase">
                Download
              </a>
              <a href={url} target="_blank" rel="noreferrer" className="rounded-full border border-white/30 px-4 py-2 font-mono text-[10px] tracking-[0.12em] uppercase">
                Open
              </a>
            </div>
          </div>
        )}

        {status === 'ready' && (
          <div
            ref={contentRef}
            className="w-fit px-3 py-4 md:px-6"
            style={{
              transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`,
              transformOrigin: '0 0',
              willChange: 'transform',
              // Stay invisible for the one/two frames it takes to measure
              // the first rendered page and compute fitScale — otherwise
              // there's a visible flash of the page at scale=1 (often
              // larger than the screen) before it snaps down to fit.
              opacity: fitScale == null ? 0 : 1,
              transition: fitScale == null ? 'none' : 'opacity 120ms ease',
            }}
          >
            {pages.map((p, i) => (
              <PdfPage key={i} page={p} pageNumber={i + 1} renderScale={BASE_RENDER_SCALE} rotation={rotation} onVisible={handleVisiblePage} />
            ))}
          </div>
        )}

        {status === 'ready' && fitScale == null && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/60">
            <Loader2 className="size-6 animate-spin" />
            <p className="font-mono text-[10px] tracking-[0.14em] uppercase">Fitting to screen…</p>
          </div>
        )}
      </div>

      {/* Mobile hint */}
      <div className="border-t border-white/10 bg-black/60 px-4 py-2 text-center backdrop-blur-xl md:hidden">
        <p className="font-mono text-[9px] tracking-[0.12em] text-white/40 uppercase">
          Pinch to zoom · Double-tap to zoom · Drag to pan
        </p>
      </div>
    </div>
  )
}

/* ============================== Inline Preview + Trigger ============================== */
export function PdfViewer({ url, fileName = 'resume.pdf' }: { url: string; fileName?: string }) {
  const [open, setOpen] = useState(false)
  const [thumbPage, setThumbPage] = useState<PDFPageProxy | null>(null)
  const [thumbStatus, setThumbStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const thumbCanvasRef = useRef<HTMLCanvasElement>(null)

  /* Render a lightweight first-page thumbnail for the inline preview card */
  useEffect(() => {
    let cancelled = false
    loadPdfJs()
      .then((pdfjsLib) => pdfjsLib.getDocument(url).promise)
      .then((doc: PDFDocumentProxy) => doc.getPage(1))
      .then((page: PDFPageProxy | undefined) => {
        if (cancelled || !page) return
        setThumbPage(page)
        setThumbStatus('ready')
      })
      .catch((err) => {
        console.error('Failed to load PDF thumbnail', err)
        if (!cancelled) setThumbStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [url])

  useEffect(() => {
    if (!thumbPage || !thumbCanvasRef.current) return
    const canvas = thumbCanvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const containerWidth = canvas.parentElement?.clientWidth || 400
    const unscaledViewport = thumbPage.getViewport({ scale: 1 })
    const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, MAX_OUTPUT_SCALE)
    const targetScale = (containerWidth / unscaledViewport.width) * dpr
    const viewport = thumbPage.getViewport({ scale: targetScale })
    canvas.width = viewport.width
    canvas.height = viewport.height
    canvas.style.width = '100%'
    canvas.style.height = 'auto'
    thumbPage.render({ canvasContext: ctx, viewport }).promise.catch(() => {})
  }, [thumbPage])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="resume-preview group relative block w-full overflow-hidden text-left"
        aria-label="Open resume in full-screen viewer"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <span className="flex gap-1.5">
            <span className="size-2 rounded-full bg-destructive/60" />
            <span className="size-2 rounded-full bg-primary/60" />
            <span className="size-2 rounded-full bg-accent/60" />
          </span>
          <span className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">{fileName}</span>
        </div>

        <div className="relative flex h-[400px] w-full items-center justify-center overflow-hidden bg-secondary p-3">
          {thumbStatus === 'loading' && <Loader2 className="size-5 animate-spin text-muted-foreground" />}
          {thumbStatus === 'error' && (
            <p className="px-6 text-center font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase">
              Preview unavailable — tap to open
            </p>
          )}
          <canvas ref={thumbCanvasRef} className={`max-h-full rounded-md shadow-md ${thumbStatus === 'ready' ? '' : 'hidden'}`} />

          {/* Hover/tap overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-200 group-hover:bg-black/40 group-hover:opacity-100 group-active:bg-black/40 group-active:opacity-100">
            <span className="flex items-center gap-2 rounded-full bg-white px-4 py-2 font-mono text-[10px] tracking-[0.12em] text-black uppercase shadow-lg">
              <ZoomIn className="size-3.5" /> Tap to view
            </span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 border-t border-border py-2.5">
          <Maximize2 className="size-3.5 text-muted-foreground" />
          <span className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">Open full-screen viewer</span>
        </div>
      </button>

      {open && <PdfModal url={url} fileName={fileName} onClose={() => setOpen(false)} />}
    </>
  )
}