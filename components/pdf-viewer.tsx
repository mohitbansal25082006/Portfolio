'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
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
 * browser's native PDF plugin (which is inconsistent / often absent on
 * Android WebViews and in-app browsers, and shows blank on many mobile
 * Chrome/Safari configs when embedded via <iframe>).
 *
 * Features:
 *  - Inline compact preview (click/tap to open fullscreen)
 *  - Fullscreen modal viewer with:
 *      - Pinch-to-zoom (touch) + ctrl/cmd+scroll zoom (desktop) + buttons
 *      - Drag-to-pan when zoomed in (mouse + touch)
 *      - Double-tap / double-click to zoom
 *      - Page navigation (prev/next, jump-to-page, keyboard arrows)
 *      - Continuous vertical scroll through all pages
 *      - Rotate
 *      - Download + open-in-new-tab
 *      - Loading & error states
 * ---------------------------------------------------------------------------
 */

const MIN_SCALE = 0.5
const MAX_SCALE = 4
const BASE_RENDER_SCALE = 1.5 // render at higher res for crisp zoom

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
  scale,
  rotation,
  pageNumber,
  onVisible,
}: {
  page: PDFPageProxy
  scale: number
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

    const viewport = page.getViewport({ scale: scale * BASE_RENDER_SCALE, rotation })
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const outputScale = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
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
  }, [page, scale, rotation])

  return (
    <div ref={wrapRef} data-page={pageNumber} className="flex justify-center py-2">
      <canvas ref={canvasRef} className="rounded-lg bg-white shadow-lg" />
    </div>
  )
}

/* ============================== Fullscreen Modal ============================== */
function PdfModal({ url, fileName, onClose }: { url: string; fileName: string; onClose: () => void }) {
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null)
  const [pages, setPages] = useState<PDFPageProxy[]>([])
  const [numPages, setNumPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [jumpValue, setJumpValue] = useState('1')

  const scrollRef = useRef<HTMLDivElement>(null)
  const pan = useRef({
    active: false,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,
    moved: false,
  })
  const pinch = useRef<{ dist: number; scale: number } | null>(null)
  const lastTap = useRef(0)

  /* -------- Load document -------- */
  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    loadPdfJs()
      .then((pdfjsLib) => pdfjsLib.getDocument(url).promise)
      .then(async (doc: PDFDocumentProxy) => {
        if (cancelled) return
        setPdfDoc(doc)
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
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

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

  const zoomBy = useCallback((delta: number) => {
    setScale((s) => clamp(Math.round((s + delta) * 100) / 100, MIN_SCALE, MAX_SCALE))
  }, [])

  const resetView = useCallback(() => {
    setScale(1)
    setRotation(0)
  }, [])

  const goToPage = useCallback(
    (n: number) => {
      const target = clamp(n, 1, numPages || 1)
      setCurrentPage(target)
      setJumpValue(String(target))
      const el = scrollRef.current?.querySelector(`[data-page="${target}"]`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    },
    [numPages],
  )

  /* -------- Ctrl/Cmd + wheel = zoom; otherwise natural scroll -------- */
  const handleWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      zoomBy(e.deltaY < 0 ? 0.15 : -0.15)
    }
  }

  /* -------- Drag to pan (mouse) -------- */
  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return
    const el = scrollRef.current
    if (!el) return
    pan.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop,
      moved: false,
    }
  }
  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pan.current.active) return
    const el = scrollRef.current
    if (!el) return
    const dx = e.clientX - pan.current.startX
    const dy = e.clientY - pan.current.startY
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) pan.current.moved = true
    el.scrollLeft = pan.current.scrollLeft - dx
    el.scrollTop = pan.current.scrollTop - dy
  }
  const handlePointerUp = () => {
    pan.current.active = false
  }

  /* -------- Touch: pinch-to-zoom + double-tap -------- */
  const touchDist = (touches: React.TouchList) => {
    const [a, b] = [touches[0], touches[1]]
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
  }

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      pinch.current = { dist: touchDist(e.touches), scale }
    } else if (e.touches.length === 1) {
      const now = Date.now()
      if (now - lastTap.current < 280) {
        setScale((s) => (s > 1 ? 1 : 2))
      }
      lastTap.current = now
    }
  }
  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && pinch.current) {
      e.preventDefault()
      const newDist = touchDist(e.touches)
      const ratio = newDist / pinch.current.dist
      setScale(clamp(Math.round(pinch.current.scale * ratio * 100) / 100, MIN_SCALE, MAX_SCALE))
    }
  }
  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length < 2) pinch.current = null
  }

  /* -------- Track current page while scrolling -------- */
  const handleVisiblePage = useCallback((n: number) => {
    setCurrentPage(n)
    setJumpValue(String(n))
  }, [])

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const n = parseInt(jumpValue, 10)
    if (!Number.isNaN(n)) goToPage(n)
  }

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
              {Math.round(scale * 100)}%
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

      {/* Viewer body */}
      <div
        ref={scrollRef}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="relative flex-1 touch-pan-y overflow-auto overscroll-contain px-3 py-4 [cursor:grab] active:[cursor:grabbing] md:px-6"
        style={{ WebkitOverflowScrolling: 'touch' }}
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
            className="mx-auto w-fit select-none"
            style={{ touchAction: scale > 1 ? 'none' : 'pan-y' }}
          >
            {pages.map((p, i) => (
              <PdfPage key={i} page={p} pageNumber={i + 1} scale={scale} rotation={rotation} onVisible={handleVisiblePage} />
            ))}
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
  const [thumbDoc, setThumbDoc] = useState<PDFDocumentProxy | null>(null)
  const [thumbPage, setThumbPage] = useState<PDFPageProxy | null>(null)
  const [thumbStatus, setThumbStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const thumbCanvasRef = useRef<HTMLCanvasElement>(null)

  /* Render a lightweight first-page thumbnail for the inline preview card */
  useEffect(() => {
    let cancelled = false
    loadPdfJs()
      .then((pdfjsLib) => pdfjsLib.getDocument(url).promise)
      .then((doc: PDFDocumentProxy) => {
        if (cancelled) return
        setThumbDoc(doc)
        return doc.getPage(1)
      })
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
    const targetScale = (containerWidth / unscaledViewport.width) * (window.devicePixelRatio || 1)
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