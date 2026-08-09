'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type WheelEvent as ReactWheelEvent,
} from 'react'
import { createPortal } from 'react-dom'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Minus,
  Plus,
  RotateCw,
  X,
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
 *
 * MOBILE FIT-TO-SCREEN (v4 improvement)
 * ---------------------------------------------------------------------------
 * On mobile screens (< 768px), the viewer automatically fits the entire
 * first page within the viewport — both width AND height — so the user
 * sees the whole page immediately instead of a zoomed-in slice. This uses
 * the PDF page's intrinsic dimensions (via `page.getViewport`) rather than
 * querying the canvas DOM element, which eliminates timing/race conditions
 * where the canvas hasn't been laid out yet when the fit calculation runs.
 *
 * On desktop (≥ 768px), the original behavior is preserved: open at scale 1
 * (100%), centered horizontally.
 * ---------------------------------------------------------------------------
 *
 * PORTAL FIX (v5)
 * ---------------------------------------------------------------------------
 * The modal is now rendered via React's `createPortal` directly into
 * `document.body`. This is critical because ancestor elements may have
 * CSS `transform` or `filter` properties (e.g. the Reveal animation
 * wrappers in portfolio-site.tsx use `transform: scale(1)` and
 * `filter: blur(0)`). Per the CSS spec, ANY computed value other than
 * `none` for `transform`, `filter`, `perspective`, or `will-change`
 * (with those properties) creates a **containing block** for
 * `position: fixed` descendants — which would cause the modal's
 * `position: fixed; inset: 0` to be relative to the transformed ancestor
 * instead of the viewport, making the modal appear tiny and mispositioned.
 * Rendering into document.body via a portal sidesteps this entirely.
 * ---------------------------------------------------------------------------
 *
 * TRIGGER CARD (v6 — animated terminal trigger, no thumbnail render)
 * ---------------------------------------------------------------------------
 * The inline preview used to eagerly load pdf.js and rasterize page 1 into
 * a thumbnail canvas just so the user had something to look at before
 * opening the real viewer. That's a second PDF parse/render pass paid on
 * every page load for a preview that's immediately thrown away once the
 * full modal opens (which renders every page itself). It also generally
 * looked like a broken embed on odd aspect ratios / slow connections.
 *
 * The trigger is now a self-contained animated "terminal" card — a typed
 * boot sequence, a document glyph, and a scanning sweep — built entirely
 * from CSS/SVG already loaded on the page. It costs nothing over the wire,
 * never shows a loading/error state for something the user hasn't asked to
 * open yet, and matches the mono/terminal language used by IntroLoader and
 * the rest of the site (see globals.css `.intro-*` classes for the sibling
 * animation vocabulary this reuses).
 * ---------------------------------------------------------------------------
 *
 * CLICKABLE LINK ANNOTATIONS (v7)
 * ---------------------------------------------------------------------------
 * PDFs can embed two kinds of "links" relevant here: external URI links
 * (mailto:, https://, etc.) and internal go-to-page links. `PdfPage` now
 * fetches the page's annotations via `page.getAnnotations()` and renders an
 * absolutely-positioned, transparent `<a>`/`<button>` overlay for each link
 * annotation on top of the canvas, using `pdfjs-dist`'s own
 * `Util.normalizeRect` + `viewport.convertToViewportRectangle` so the
 * overlay boxes line up correctly regardless of page rotation or render
 * scale. External links open in a new tab; internal "go to page" links call
 * back up to the modal's `goToPage` so navigation stays inside the viewer.
 * ---------------------------------------------------------------------------
 */

const MIN_SCALE = 0.5
const MAX_SCALE = 4
const BASE_RENDER_SCALE = 1.5 // render pages at higher res for crisp zoom
const MAX_OUTPUT_SCALE = 2 // cap devicePixelRatio scaling so canvas pixel
// dimensions never exceed mobile GPU texture limits at high zoom.

// Mobile breakpoint — below this width the viewer auto-fits the page to
// the viewport on open; at or above it keeps the classic scale-1 default.
const MOBILE_BREAKPOINT = 768

type PDFDocumentProxy = any
type PDFPageProxy = any

/** Normalized shape for a single clickable link overlay on a page. */
type PageLink = {
  key: string
  // Position/size as a percentage of the page's rendered box, so the
  // overlay scales naturally with the canvas's CSS width/height without
  // needing to know the current zoom transform.
  leftPct: number
  topPct: number
  widthPct: number
  heightPct: number
  kind: 'external' | 'internal'
  url?: string
  pageNumber?: number
}

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

/** Returns true when the current viewport is considered "mobile" for
 *  the purpose of auto-fit-to-screen behavior. */
function isMobileViewport() {
  return typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT
}

/**
 * Extracts clickable link overlays from a page's raw annotations.
 * Handles both external URI links (`annotation.url`) and internal
 * destination links (`annotation.dest`, resolved to a page number via
 * `pdfDoc.getPageIndex`). Coordinates are converted to viewport space with
 * `viewport.convertToViewportRectangle` so rotation is already accounted
 * for, then normalized to percentages of the page box.
 */
async function extractPageLinks(
  pdfDoc: PDFDocumentProxy,
  page: PDFPageProxy,
  pdfjsLib: any,
  rotation: number,
): Promise<PageLink[]> {
  const [annotations, viewport] = await Promise.all([
    page.getAnnotations({ intent: 'display' }),
    Promise.resolve(page.getViewport({ scale: 1, rotation })),
  ])

  const links: PageLink[] = []
  let i = 0

  for (const annotation of annotations) {
    if (annotation.subtype !== 'Link' || !annotation.rect) continue

    const rect = pdfjsLib.Util.normalizeRect(
      viewport.convertToViewportRectangle(annotation.rect),
    )
    // convertToViewportRectangle can return the rect with y-axis flipped
    // relative to top-left screen origin depending on rotation; normalize
    // to a top-left-origin box in [0,1] page-space using the viewport's
    // own width/height.
    const left = Math.min(rect[0], rect[2])
    const right = Math.max(rect[0], rect[2])
    const top = Math.min(rect[1], rect[3])
    const bottom = Math.max(rect[1], rect[3])

    const leftPct = (left / viewport.width) * 100
    const widthPct = ((right - left) / viewport.width) * 100
    const topPct = (top / viewport.height) * 100
    const heightPct = ((bottom - top) / viewport.height) * 100

    if (annotation.url) {
      links.push({
        key: `link-${i++}`,
        leftPct,
        topPct,
        widthPct,
        heightPct,
        kind: 'external',
        url: annotation.url,
      })
      continue
    }

    if (annotation.dest) {
      try {
        const dest =
          typeof annotation.dest === 'string'
            ? await pdfDoc.getDestination(annotation.dest)
            : annotation.dest
        const destRef = dest?.[0]
        if (destRef != null) {
          const pageIndex = await pdfDoc.getPageIndex(destRef)
          links.push({
            key: `link-${i++}`,
            leftPct,
            topPct,
            widthPct,
            heightPct,
            kind: 'internal',
            pageNumber: pageIndex + 1,
          })
        }
      } catch {
        // Unresolvable internal destination — skip rather than break render.
      }
    }
  }

  return links
}

/* ============================== Canvas Page ============================== */
function PdfPage({
  pdfDoc,
  page,
  renderScale,
  rotation,
  pageNumber,
  onVisible,
  onNavigate,
}: {
  pdfDoc: PDFDocumentProxy
  page: PDFPageProxy
  renderScale: number
  rotation: number
  pageNumber: number
  onVisible: (n: number) => void
  onNavigate: (n: number) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const renderTaskRef = useRef<any>(null)
  const [links, setLinks] = useState<PageLink[]>([])

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

  // Load link annotations for this page whenever the page or rotation
  // changes (rotation changes the viewport→screen coordinate mapping).
  useEffect(() => {
    let cancelled = false
    if (!page || !pdfDoc) return

    loadPdfJs()
      .then((pdfjsLib) => extractPageLinks(pdfDoc, page, pdfjsLib, rotation))
      .then((extracted) => {
        if (!cancelled) setLinks(extracted)
      })
      .catch((err) => {
        console.error('Failed to extract PDF link annotations', err)
        if (!cancelled) setLinks([])
      })

    return () => {
      cancelled = true
    }
  }, [page, pdfDoc, rotation])

  return (
    <div ref={wrapRef} data-page={pageNumber} className="relative flex justify-center py-2">
      <div className="relative inline-block">
        <canvas ref={canvasRef} className="rounded-lg bg-white shadow-lg" />
        {links.length > 0 && (
          <div className="pointer-events-none absolute inset-0">
            {links.map((link) =>
              link.kind === 'external' && link.url ? (
                <a
                  key={link.key}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  title={link.url}
                  className="pointer-events-auto absolute cursor-pointer rounded-sm outline-none transition-colors hover:bg-primary/15 focus-visible:ring-2 focus-visible:ring-primary"
                  style={{
                    left: `${link.leftPct}%`,
                    top: `${link.topPct}%`,
                    width: `${link.widthPct}%`,
                    height: `${link.heightPct}%`,
                  }}
                  // Prevent the underlying drag/pan handlers from treating
                  // this as the start of a pan gesture.
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                />
              ) : link.kind === 'internal' && link.pageNumber ? (
                <button
                  key={link.key}
                  type="button"
                  title={`Go to page ${link.pageNumber}`}
                  onClick={() => onNavigate(link.pageNumber!)}
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  className="pointer-events-auto absolute cursor-pointer rounded-sm outline-none transition-colors hover:bg-primary/15 focus-visible:ring-2 focus-visible:ring-primary"
                  style={{
                    left: `${link.leftPct}%`,
                    top: `${link.topPct}%`,
                    width: `${link.widthPct}%`,
                    height: `${link.heightPct}%`,
                  }}
                />
              ) : null,
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ============================== Fullscreen Modal ============================== */
function PdfModal({ url, fileName, onClose }: { url: string; fileName: string; onClose: () => void }) {
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null)
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

  // Tracks whether the user has manually zoomed/panned since the last
  // auto-fit. When true, resize/orientation-change listeners will NOT
  // override the user's view with a re-fit. Reset to false whenever the
  // fit useEffect applies a new fit (initial open, rotation change, etc.)
  const userInteracted = useRef(false)

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
  const singleTouchStart = useRef<{ x: number; y: number } | null>(null)
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
   * Compute the "fit to screen" scale and apply it.
   *
   * MOBILE ONLY: on screens < 768px wide, the first page is scaled so that
   * it fits entirely within the viewport (both width AND height). This uses
   * the PDF page's intrinsic dimensions via `page.getViewport()` — NOT the
   * canvas DOM element's `clientWidth` — so the calculation is instant and
   * reliable with no timing dependencies on canvas rendering or layout.
   *
   * DESKTOP: keeps the original behavior — open at scale 1 (100%), centered.
   *
   * Runs whenever pages/rotation change (rotation swaps page width/height,
   * so a portrait page rotated 90° needs re-fitting).
   *
   * Also sets up a ResizeObserver and window resize/orientation listener
   * so the view re-fits when the viewport size changes (e.g., mobile
   * browser URL bar show/hide, orientation rotation) — but ONLY if the
   * user hasn't manually zoomed/panned (`userInteracted` ref).
   */
  useEffect(() => {
    if (status !== 'ready' || pages.length === 0) return

    // Reset interaction flag — this is a fresh fit (initial open or rotation)
    userInteracted.current = false

    const firstPage = pages[0]

    /**
     * Core fit calculation. Returns the scale that makes the first page
     * fit within the viewport on both axes, and the centered X position.
     */
    const computeFit = (): { scale: number; x: number; y: number } | null => {
      const viewport = viewportRef.current
      if (!viewport || !firstPage) return null

      // Get the page's rendered dimensions at BASE_RENDER_SCALE.
      // This matches what the canvas CSS dimensions will be once rendered,
      // but is available instantly — no need to wait for canvas layout.
      const pageVP = firstPage.getViewport({ scale: BASE_RENDER_SCALE, rotation })

      const vw = viewport.clientWidth
      const vh = viewport.clientHeight
      if (vw === 0 || vh === 0) return null

      // Content wrapper has px-3 (12px each side) on mobile = 24px total
      // horizontal padding, and py-4 (16px each side) = 32px total vertical
      // padding. The transform scales the ENTIRE wrapper (canvas + padding),
      // so we must include padding in the fit calculation.
      const horizontalPadding = 24
      const verticalPadding = 32

      const totalContentWidth = pageVP.width + horizontalPadding
      // For height, account for the top padding of the wrapper + the first
      // page's py-2 wrapper (8px top). The bottom padding doesn't affect
      // the first page's fit, so we use a slightly smaller value.
      const totalContentHeight = pageVP.height + verticalPadding

      const scaleToFitWidth = vw / totalContentWidth
      const scaleToFitHeight = vh / totalContentHeight

      // Use the smaller of the two so the page fits within BOTH dimensions.
      // Allow upscaling to 2x so small pages can fill the viewport.
      const computedFit = clamp(Math.min(scaleToFitWidth, scaleToFitHeight), 0.1, 2)

      // Center horizontally
      const fittedWidth = totalContentWidth * computedFit
      const centeredX = (vw - fittedWidth) / 2

      // Position near the top with a small offset
      const y = 12

      return { scale: computedFit, x: centeredX, y }
    }

    const applyFit = () => {
      const result = computeFit()
      if (!result) return
      setFitScale(result.scale)
      applyTransform({ x: result.x, y: result.y, scale: result.scale })
    }

    if (!isMobileViewport()) {
      // Desktop/tablet: keep the original default — open at scale 1,
      // centered, no fit-to-screen shrinking.
      setFitScale(1)
      const viewport = viewportRef.current
      if (viewport && firstPage) {
        const pageVP = firstPage.getViewport({ scale: BASE_RENDER_SCALE, rotation })
        const centeredX = (viewport.clientWidth - pageVP.width) / 2
        applyTransform({ x: centeredX, y: 12, scale: 1 })
      } else {
        applyTransform({ x: 0, y: 0, scale: 1 })
      }
      return
    }

    // Mobile: fit page to viewport
    applyFit()

    // Re-fit when viewport size changes (mobile browser UI, orientation
    // change, etc.) — but only if the user hasn't manually zoomed/panned.
    const handleResize = () => {
      if (!userInteracted.current) {
        applyFit()
      }
    }

    // ResizeObserver catches viewport size changes that window resize
    // might miss (e.g., mobile browser URL bar show/hide changes the
    // viewport height without firing a window resize event).
    const ro = new ResizeObserver(() => {
      if (!userInteracted.current) {
        applyFit()
      }
    })
    if (viewportRef.current) {
      ro.observe(viewportRef.current)
    }

    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', handleResize)

    return () => {
      ro.disconnect()
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleResize)
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
    userInteracted.current = true
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
    userInteracted.current = true
    const viewport = viewportRef.current
    const rect = viewport?.getBoundingClientRect()
    const vx = rect ? rect.width / 2 : 0
    const vy = rect ? rect.height / 2 : 0
    const nextScale = transformRef.current.scale + delta
    zoomToward(nextScale, vx, vy)
  }, [zoomToward])

  const resetView = useCallback(() => {
    setRotation(0)
    userInteracted.current = false
    const viewport = viewportRef.current
    const firstPage = pages.length > 0 ? pages[0] : null
    if (viewport && firstPage && fitScale) {
      const pageVP = firstPage.getViewport({ scale: BASE_RENDER_SCALE, rotation: 0 })
      const horizontalPadding = 24
      const totalWidth = pageVP.width + horizontalPadding
      const fittedWidth = totalWidth * fitScale
      applyTransform({ x: (viewport.clientWidth - fittedWidth) / 2, y: 12, scale: fitScale })
    } else {
      applyTransform({ x: 0, y: 0, scale: fitScale ?? 1 })
    }
  }, [applyTransform, fitScale, pages])

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
    userInteracted.current = true
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
    userInteracted.current = true
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
    userInteracted.current = true
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
      // any single-finger drag in progress so the gestures never fight.
      userInteracted.current = true
      drag.current = null
      singleTouchStart.current = null
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
      singleTouchStart.current = { x: touch.clientX, y: touch.clientY }
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
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        d.moved = true
        userInteracted.current = true
      }
      if (d.moved) {
        const t = transformRef.current
        const next = clampPan(d.startTX + dx, d.startTY + dy, t.scale)
        applyTransform({ ...next, scale: t.scale })
      }
    }
  }

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length < 2) pinch.current = null

    if (e.touches.length === 0) {
      drag.current = null
      singleTouchStart.current = null

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

  /* -------- Render via portal into document.body --------
   * This is the critical fix: the modal MUST be rendered at document.body
   * level so that no ancestor element with `transform`, `filter`,
   * `perspective`, or `will-change` can create a containing block that
   * would break `position: fixed; inset: 0`.
   *
   * In the new UI, the PdfViewer is wrapped in a <Reveal variant="scale">
   * whose visible state applies `transform: scale(1)` — and even though
   * scale(1) is visually a no-op, the CSS spec says any transform value
   * other than `none` creates a containing block for fixed descendants.
   * Without the portal, the modal would be constrained to the small Reveal
   * wrapper instead of covering the full viewport.
   */
  return createPortal(
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
            {pdfDoc &&
              pages.map((p, i) => (
                <PdfPage
                  key={i}
                  pdfDoc={pdfDoc}
                  page={p}
                  pageNumber={i + 1}
                  renderScale={BASE_RENDER_SCALE}
                  rotation={rotation}
                  onVisible={handleVisiblePage}
                  onNavigate={goToPage}
                />
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
          Pinch to zoom · Drag to pan · Tap links to open
        </p>
      </div>
    </div>,
    document.body,
  )
}

/* ============================== Animated Trigger Card ============================== */
/**
 * Terminal-style boot line used inside the trigger card. Each line types
 * itself out in sequence (line N doesn't start until line N-1 finishes),
 * echoing the boot-sequence vocabulary used by IntroLoader on first page
 * load, so opening the resume feels like a small callback to that moment
 * rather than an unrelated UI pattern.
 */
const BOOT_LINES = [
  '> locating resume.pdf',
  '> verifying document integrity',
  '> ready to render',
]

function ResumeTerminalTrigger({ fileName }: { fileName: string }) {
  const [lineIndex, setLineIndex] = useState(0)
  const [charCount, setCharCount] = useState(0)
  const [sweepKey, setSweepKey] = useState(0)

  // Types the boot lines out once on mount, then periodically re-triggers
  // the scan-line sweep so the card stays quietly alive without looping
  // the (more attention-grabbing) typing animation forever.
  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) {
      setLineIndex(BOOT_LINES.length - 1)
      setCharCount(BOOT_LINES[BOOT_LINES.length - 1].length)
      return
    }

    let cancelled = false
    let typeTimer: ReturnType<typeof setTimeout>

    const typeLine = (li: number, ci: number) => {
      if (cancelled) return
      const line = BOOT_LINES[li]
      if (ci <= line.length) {
        setLineIndex(li)
        setCharCount(ci)
        typeTimer = setTimeout(() => typeLine(li, ci + 1), 22 + Math.random() * 18)
      } else if (li < BOOT_LINES.length - 1) {
        typeTimer = setTimeout(() => typeLine(li + 1, 0), 260)
      }
    }
    typeTimer = setTimeout(() => typeLine(0, 0), 200)

    return () => {
      cancelled = true
      clearTimeout(typeTimer)
    }
  }, [])

  // Ambient re-sweep every so often once booted, purely decorative.
  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) return
    const id = setInterval(() => setSweepKey((k) => k + 1), 4200)
    return () => clearInterval(id)
  }, [])

  const displayedLines = useMemo(() => {
    return BOOT_LINES.slice(0, lineIndex + 1).map((line, i) => (i === lineIndex ? line.slice(0, charCount) : line))
  }, [lineIndex, charCount])

  return (
    <div className="resume-trigger group relative isolate overflow-hidden rounded-2xl border border-border bg-card">
      {/* Title bar — mirrors the ProjectGallery browser-chrome header for a
          consistent "app window" language across the site. */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <span className="flex gap-1.5">
          <span className="size-2 rounded-full bg-destructive/60" />
          <span className="size-2 rounded-full bg-primary/60" />
          <span className="size-2 rounded-full bg-accent/60" />
        </span>
        <span className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">{fileName}</span>
      </div>

      {/* Body */}
      <div className="relative flex h-[400px] w-full flex-col items-center justify-center gap-7 overflow-hidden bg-secondary px-8 py-10">
        {/* Faint grid, matching .intro-grid's vocabulary */}
        <div className="resume-trigger-grid" aria-hidden="true" />

        {/* Document glyph */}
        <div className="relative">
          <div className="resume-doc-glow" aria-hidden="true" />
          <svg width="72" height="88" viewBox="0 0 72 88" className="relative" aria-hidden="true">
            <path
              d="M8 4h38l18 18v62a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4Z"
              className="resume-doc-outline"
              fill="none"
              strokeWidth="2"
            />
            <path d="M46 4v14a4 4 0 0 0 4 4h14" className="resume-doc-outline" fill="none" strokeWidth="2" />
            <line x1="16" y1="40" x2="52" y2="40" className="resume-doc-line" style={{ animationDelay: '0ms' }} />
            <line x1="16" y1="50" x2="56" y2="50" className="resume-doc-line" style={{ animationDelay: '120ms' }} />
            <line x1="16" y1="60" x2="44" y2="60" className="resume-doc-line" style={{ animationDelay: '240ms' }} />
          </svg>
          <span key={sweepKey} className="resume-doc-sweep" aria-hidden="true" />
        </div>

        {/* Typed boot sequence */}
        <div className="flex min-h-[4.5rem] w-full max-w-64 flex-col items-start gap-1.5 font-mono text-[11px] tracking-[0.08em]">
          {displayedLines.map((line, i) => {
            const isLast = i === lineIndex
            const isDone = i < lineIndex || (isLast && charCount >= BOOT_LINES[i].length)
            return (
              <span key={i} className={`flex items-center gap-2 ${isDone ? 'text-primary' : 'text-muted-foreground'}`}>
                <span className="whitespace-nowrap">{line}</span>
                {isLast && charCount < BOOT_LINES[i].length && <span className="resume-trigger-caret" />}
              </span>
            )
          })}
        </div>

        {/* CTA */}
        <span className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-mono text-[11px] tracking-[0.12em] text-primary-foreground uppercase transition-transform duration-300 group-hover:-translate-y-0.5 group-active:translate-y-0">
          <FileText className="size-3.5" /> View resume
        </span>
      </div>

      <div className="flex items-center justify-center gap-2 border-t border-border py-2.5">
        <span className="size-1.5 animate-pulse rounded-full bg-primary" />
        <span className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">Click to open full-screen viewer</span>
      </div>
    </div>
  )
}

/* ============================== Inline Trigger ============================== */
export function PdfViewer({ url, fileName = 'resume.pdf' }: { url: string; fileName?: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block w-full text-left"
        aria-label="Open resume in full-screen viewer"
      >
        <ResumeTerminalTrigger fileName={fileName} />
      </button>

      {open && <PdfModal url={url} fileName={fileName} onClose={() => setOpen(false)} />}
    </>
  )
}