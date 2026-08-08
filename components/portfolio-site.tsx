'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode, type CSSProperties } from 'react'
import {
  ArrowDownRight, ArrowUpRight, BookOpen, Calendar, Check, ChevronLeft, ChevronRight, Code2, Copy,
  Cpu, Database, Download, ExternalLink, Layers, Loader2, Mail,
  MapPin, Menu, MoveUpRight, Search, Send, Smartphone, Sparkles, Star,
  Users, Wrench, X, ZoomIn,
} from 'lucide-react'
import {
  about, contactInfo, githubConfig, navItems, projectFilters, projects,
  projects as allProjects, siteConfig, skillGroups, stats, techStack,
  themes, timeline,
} from '@/lib/content'
import { GitHubSection } from '@/components/github-section'
import { PdfViewer } from '@/components/pdf-viewer'
import { ImageViewer } from '@/components/image-viewer'

/* ---------------- Custom Brand Icons (SVG) ---------------- */
const GithubIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2c-3.2.7-3.88-1.54-3.88-1.54-.53-1.34-1.3-1.7-1.3-1.7-1.06-.72.08-.71.08-.71 1.17.08 1.79 1.2 1.79 1.2 1.04 1.79 2.73 1.27 3.4.97.11-.75.41-1.27.74-1.56-2.55-.29-5.23-1.28-5.23-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.43-2.69 5.41-5.25 5.69.42.36.79 1.08.79 2.18v3.23c0 .31.21.68.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
  </svg>
)

const LinkedinIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.8 0 0 .77 0 1.72v20.56C0 23.23.8 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
  </svg>
)

const TwitterIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
)

/* ---------------- Reveal wrapper (scroll-triggered) ---------------- */
function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { setVisible(true); io.disconnect() }
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div ref={ref} className={`reveal ${visible ? 'is-visible' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  )
}

/* ---------------- CountUp (animated stats) ---------------- */
function CountUp({ end, suffix = '', duration = 1600 }: { end: number; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [value, setValue] = useState(0)
  const started = useRef(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true
        const start = performance.now()
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration)
          const eased = 1 - Math.pow(1 - t, 3)
          setValue(Math.round(end * eased))
          if (t < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
        io.disconnect()
      }
    }, { threshold: 0.4 })
    io.observe(el)
    return () => io.disconnect()
  }, [end, duration])
  return <span ref={ref}>{value}{suffix}</span>
}

/* ---------------- 3D Tech Sphere (Interactive & Smooth) ---------------- */
function TechSphere({ items }: { items: string[] }) {
  const sphereRef = useRef<HTMLDivElement>(null)
  const target = useRef({ x: -10, y: 0 })
  const current = useRef({ x: -10, y: 0 })
  const isHovering = useRef(false)

  const N = items.length
  const positions = useMemo(() => items.map((_, i) => {
    const phi = Math.acos(1 - (2 * (i + 0.5)) / N)
    const theta = Math.PI * (1 + Math.sqrt(5)) * (i + 0.5)
    const x = Math.round((Math.sin(phi) * Math.cos(theta)) * 100) / 100
    const y = Math.round((Math.sin(phi) * Math.sin(theta)) * 100) / 100
    const z = Math.round(Math.cos(phi) * 100) / 100
    return { x, y, z }
  }), [items])

  useEffect(() => {
    const animate = () => {
      if (!isHovering.current) {
        target.current.y += 0.15
        target.current.y = target.current.y % 360
        target.current.x = -10 + Math.sin(target.current.y * Math.PI / 180) * 5
      }

      current.current.x += (target.current.x - current.current.x) * 0.05

      let diffY = target.current.y - current.current.y
      while (diffY < -180) diffY += 360
      while (diffY > 180) diffY -= 360
      current.current.y += diffY * 0.05
      current.current.y = current.current.y % 360

      if (sphereRef.current) {
        sphereRef.current.style.transform = `rotateX(${current.current.x}deg) rotateY(${current.current.y}deg)`
      }
      requestAnimationFrame(animate)
    }
    const animId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animId)
  }, [])

  // Shared math for both mouse and touch pointers: rotates the sphere
  // based on how far the pointer is from the container's center.
  const updateRotationFromPoint = (clientX: number, clientY: number, rect: DOMRect) => {
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const deltaX = clientX - centerX
    const deltaY = clientY - centerY
    target.current.y = (deltaX / (rect.width / 2)) * 40
    target.current.x = -(deltaY / (rect.height / 2)) * 40 - 10
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    updateRotationFromPoint(e.clientX, e.clientY, rect)
  }

  const handleMouseEnter = () => {
    isHovering.current = true
    target.current.y = current.current.y % 360
    target.current.x = current.current.x
  }
  const handleMouseLeave = () => {
    isHovering.current = false
    target.current.y = current.current.y % 360
    target.current.x = -10
  }

  // Touch equivalents so the sphere responds to finger drags on mobile,
  // where onMouseMove/onMouseEnter/onMouseLeave never fire.
  const handleTouchStart = (e: React.TouchEvent) => {
    isHovering.current = true
    target.current.y = current.current.y % 360
    target.current.x = current.current.x
    const touch = e.touches[0]
    if (touch) {
      const rect = e.currentTarget.getBoundingClientRect()
      updateRotationFromPoint(touch.clientX, touch.clientY, rect)
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    if (!touch) return
    const rect = e.currentTarget.getBoundingClientRect()
    updateRotationFromPoint(touch.clientX, touch.clientY, rect)
  }

  const handleTouchEnd = () => {
    isHovering.current = false
    target.current.y = current.current.y % 360
    target.current.x = -10
  }

  return (
    <div
      className="sphere-container"
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      style={{ touchAction: 'none' }}
    >
      <div className="sphere-glow" />
      <div className="sphere-rings">
        <div className="ring ring-1" />
        <div className="ring ring-2" />
        <div className="ring ring-3" />
      </div>
      <div ref={sphereRef} className="sphere">
        {items.map((item, i) => {
          const p = positions[i]
          return (
            <span
              key={item}
              className="sphere-item"
              style={{
                '--tx': `${p.x * 180}px`,
                '--ty': `${p.y * 180}px`,
                '--tz': `${p.z * 180}px`
              } as CSSProperties}
            >
              {item}
            </span>
          )
        })}
      </div>
    </div>
  )
}

/* ---------------- Social icon mapper ---------------- */
function SocialIcon({ platform }: { platform: string }) {
  switch (platform) {
    case 'github': return <GithubIcon className="size-4" />
    case 'linkedin': return <LinkedinIcon className="size-4" />
    case 'email': return <Mail className="size-4" />
    case 'twitter': return <TwitterIcon className="size-4" />
    case 'leetcode': return <Code2 className="size-4" />
    default: return null
  }
}

const skillIcons: Record<string, typeof Code2> = {
  Languages: Code2, Frontend: Layers, Backend: Layers, Database: Database,
  'AI / ML': Cpu, Mobile: Smartphone, Tools: Wrench,
}

/* ---------------- Project Gallery (Multi-Screenshot Carousel) ----------------
   - Left / right arrow navigation (click, keyboard, swipe)
   - Slide counter + progress dots (dots collapse to a scrollable strip
     when there are many screenshots, so it never overflows on mobile)
   - Lightbox for a full-screen zoomed look at the active screenshot
   - Fully responsive: arrows sit inside the frame on mobile so they
     never get clipped, thumbnails scroll horizontally
------------------------------------------------------------------------- */
function ProjectGallery({ project }: { project: typeof projects[0] }) {
  const [active, setActive] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const touchStartX = useRef<number | null>(null)
  const total = project.images.length

  const goTo = (i: number) => setActive(((i % total) + total) % total)
  const next = () => goTo(active + 1)
  const prev = () => goTo(active - 1)

  // Reset to the first slide whenever the project itself changes
  // (e.g. after a filter/search re-renders a different card in place).
  useEffect(() => { setActive(0) }, [project.number])

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current
    const delta = endX - touchStartX.current
    if (Math.abs(delta) > 40) {
      delta > 0 ? prev() : next()
    }
    touchStartX.current = null
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); prev() }
    if (e.key === 'ArrowRight') { e.preventDefault(); next() }
  }

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        {/* Browser chrome bar */}
        <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5 sm:px-4">
          <div className="flex shrink-0 gap-1.5">
            <span className="size-2.5 rounded-full bg-destructive/50" />
            <span className="size-2.5 rounded-full bg-primary/50" />
            <span className="size-2.5 rounded-full bg-accent/50" />
          </div>
          <div className="mx-3 min-w-0 flex-1 sm:mx-4">
            <div className="mx-auto w-fit max-w-full truncate rounded-md bg-secondary px-3 py-0.5 font-mono text-[9px] text-muted-foreground uppercase sm:text-[10px]">
              {project.name}.app
            </div>
          </div>
          <a
            href={project.live}
            target="_blank"
            rel="noreferrer"
            className="grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={`Open ${project.name} live site`}
          >
            <MoveUpRight className="size-3.5" />
          </a>
        </div>

        {/* Slide viewport */}
        <div
          className="group/gallery relative aspect-[16/10] w-full touch-pan-y select-none overflow-hidden bg-secondary outline-none sm:aspect-[16/10]"
          tabIndex={0}
          role="group"
          aria-roledescription="carousel"
          aria-label={`${project.name} screenshots`}
          onKeyDown={handleKeyDown}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <img
            src={project.images[active]}
            alt={`${project.name} screenshot ${active + 1} of ${total}`}
            className="absolute inset-0 h-full w-full cursor-zoom-in object-contain p-2 transition-opacity duration-300"
            key={active}
            onClick={() => setLightboxOpen(true)}
          />

          {/* Year badge */}
          <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-background/80 px-2.5 py-1 font-mono text-[9px] tracking-[0.14em] text-foreground/80 uppercase backdrop-blur sm:left-4 sm:top-4 sm:px-3 sm:text-[10px]">
            {project.year}
          </span>

          {/* Slide counter */}
          {total > 1 && (
            <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-background/80 px-2.5 py-1 font-mono text-[9px] tracking-[0.14em] text-foreground/80 backdrop-blur sm:right-4 sm:top-4 sm:px-3 sm:text-[10px]">
              {active + 1} / {total}
            </span>
          )}

          {/* Expand / lightbox trigger */}
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="absolute bottom-3 right-3 grid size-8 place-items-center rounded-full bg-background/80 text-foreground/80 opacity-0 backdrop-blur transition-opacity hover:bg-background hover:text-foreground focus-visible:opacity-100 group-hover/gallery:opacity-100 sm:bottom-4 sm:right-4"
            aria-label="View screenshot full size"
          >
            <ZoomIn className="size-3.5" />
          </button>

          {/* Left / right arrow navigation */}
          {total > 1 && (
            <>
              <button
                type="button"
                onClick={prev}
                className="absolute left-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full border border-border/60 bg-background/80 text-foreground shadow-lg backdrop-blur transition-all hover:border-primary hover:bg-primary hover:text-primary-foreground active:scale-90 sm:left-3 sm:size-10 sm:opacity-0 sm:group-hover/gallery:opacity-100 sm:focus-visible:opacity-100"
                aria-label="Previous screenshot"
              >
                <ChevronLeft className="size-4 sm:size-5" />
              </button>
              <button
                type="button"
                onClick={next}
                className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full border border-border/60 bg-background/80 text-foreground shadow-lg backdrop-blur transition-all hover:border-primary hover:bg-primary hover:text-primary-foreground active:scale-90 sm:right-3 sm:size-10 sm:opacity-0 sm:group-hover/gallery:opacity-100 sm:focus-visible:opacity-100"
                aria-label="Next screenshot"
              >
                <ChevronRight className="size-4 sm:size-5" />
              </button>
            </>
          )}

          {/* Progress dots (only when the set is small enough to read at a glance) */}
          {total > 1 && total <= 8 && (
            <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 sm:bottom-4">
              {project.images.map((_, i) => (
                <span
                  key={i}
                  className={`pointer-events-auto h-1.5 cursor-pointer rounded-full transition-all ${
                    i === active ? 'w-5 bg-primary' : 'w-1.5 bg-background/70 hover:bg-background'
                  }`}
                  onClick={() => goTo(i)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Thumbnail strip */}
        <div className="flex gap-2 overflow-x-auto border-t border-border p-2 [scrollbar-width:thin]">
          {project.images.map((img, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`relative h-11 w-[4.75rem] shrink-0 overflow-hidden rounded-md border transition-all sm:h-12 sm:w-20 ${
                i === active ? 'border-primary ring-1 ring-primary' : 'border-border opacity-50 hover:opacity-100'
              }`}
              aria-label={`Go to screenshot ${i + 1}`}
              aria-current={i === active}
            >
              <img src={img} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      </div>

      {/* Full-screen viewer — arrow nav on desktop, swipe/pinch on mobile */}
      <ImageViewer
        images={project.images}
        index={active}
        onIndexChange={setActive}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        alt={project.name}
      />
    </>
  )
}

/* ---------------- Project Card (full detail block below the gallery) ---------------- */
function ProjectCard({ project, index }: { project: typeof projects[0]; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const FEATURES_COLLAPSED_COUNT = 6
  const visibleFeatures = expanded ? project.features : project.features.slice(0, FEATURES_COLLAPSED_COUNT)
  const hasMoreFeatures = project.features.length > FEATURES_COLLAPSED_COUNT

  return (
    <article className={`project-card group flex flex-col gap-8 md:gap-10 lg:flex-row ${index % 2 === 1 ? 'lg:flex-row-reverse' : ''}`}>
      {/* Gallery column */}
      <div className="min-w-0 lg:flex-1">
        <div className="lg:sticky lg:top-24">
          <ProjectGallery project={project} />
        </div>
      </div>

      {/* Detail column */}
      <div className="flex min-w-0 flex-1 flex-col gap-5 lg:justify-center">
        <div className="flex items-center gap-3">
          <span className={`grid size-10 shrink-0 place-items-center rounded-full ${project.theme} font-mono text-xs font-bold`}>
            {project.number}
          </span>
          <span className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">{project.year}</span>
          <span className="rounded-full border border-border px-2.5 py-1 font-mono text-[9px] tracking-[0.12em] text-muted-foreground uppercase">
            {project.category}
          </span>
        </div>

        <h3 className="text-3xl font-medium tracking-[-0.04em] text-balance sm:text-4xl">{project.name}</h3>
        <p className="text-sm leading-6 text-muted-foreground">{project.short}</p>

        <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
          <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">The problem</p>
          <p className="mt-1.5 text-xs leading-5 text-foreground/80">{project.problem}</p>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <a
            href={project.live}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 font-mono text-[10px] tracking-[0.12em] text-primary-foreground uppercase transition-colors hover:bg-primary/90"
          >
            Live <ExternalLink className="size-3" />
          </a>
          <a
            href={project.github}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 font-mono text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
          >
            GitHub <GithubIcon className="size-3" />
          </a>
        </div>

        <div className="mt-2 grid gap-5 border-t border-border pt-4 sm:grid-cols-2">
          <div>
            <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
              Features {project.features.length > 0 && `(${project.features.length})`}
            </p>
            <ul className="mt-2.5 space-y-1.5">
              {visibleFeatures.map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs leading-5 text-foreground/80">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" /> {f}
                </li>
              ))}
            </ul>
            {hasMoreFeatures && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-2.5 font-mono text-[10px] tracking-[0.12em] text-primary uppercase hover:underline"
              >
                {expanded ? 'Show less' : `+${project.features.length - FEATURES_COLLAPSED_COUNT} more`}
              </button>
            )}
          </div>
          <div>
            <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">Stack</p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {project.stack.map((s) => (
                <span key={s} className="rounded-full border border-border px-2.5 py-1 font-mono text-[10px] text-muted-foreground">
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-border pt-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">Challenges</p>
            <p className="mt-1 text-xs leading-5 text-foreground/80">{project.challenges}</p>
          </div>
          {project.metrics && (
            <div className="shrink-0 sm:text-right">
              <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">Metrics</p>
              <p className="mt-1 text-sm font-medium text-primary">{project.metrics}</p>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

/* ============================ MAIN ============================ */
export function PortfolioSite() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [theme, setTheme] = useState('midnight')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [activeFilter, setActiveFilter] = useState('All')
  const [query, setQuery] = useState('')
  const [activeSection, setActiveSection] = useState('')

  const [formStatus, setFormStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme) }, [theme])

  useEffect(() => {
    const ids = navItems.map((n) => n.href.slice(1))
    const sections = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[]
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActiveSection(e.target.id)),
      { rootMargin: '-45% 0px -50% 0px' },
    )
    sections.forEach((s) => io.observe(s))
    return () => io.disconnect()
  }, [])

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(contactInfo.email)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2200)
    } catch { /* noop */ }
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormStatus('loading')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setFormStatus('success')
        setForm({ name: '', email: '', subject: '', message: '' })
      } else {
        setFormStatus('error')
      }
    } catch (err) {
      setFormStatus('error')
    }
  }

  const filteredProjects = useMemo(() => {
    return allProjects.filter((p) => {
      const f = activeFilter
      const matchesFilter =
        f === 'All' ||
        (f === 'AI' && p.category === 'ai') ||
        (f === 'Web' && p.category === 'web') ||
        (f === 'Mobile' && p.category === 'mobile') ||
        (f === 'Open Source' && p.category === 'open-source')
      const q = query.toLowerCase().trim()
      const matchesQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.short.toLowerCase().includes(q) ||
        p.stack.join(' ').toLowerCase().includes(q) ||
        p.features.join(' ').toLowerCase().includes(q)
      return matchesFilter && matchesQuery
    })
  }, [activeFilter, query])

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <div className="grain pointer-events-none fixed inset-0 z-50" aria-hidden="true" />

      {/* Aurora background */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <div className="aurora aurora-1" />
        <div className="aurora aurora-2" />
        <div className="aurora aurora-3" />
      </div>

      {/* Theme switcher */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
        {paletteOpen && (
          <div className="flex flex-col gap-1 rounded-2xl border border-border bg-card/90 p-2 shadow-2xl backdrop-blur-xl">
            {themes.map((t) => (
              <button
                key={t.id}
                onClick={() => { setTheme(t.id); setPaletteOpen(false) }}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2 font-mono text-[10px] tracking-[0.14em] uppercase transition-colors hover:bg-muted ${theme === t.id ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}
              >
                <span className="size-3 rounded-full border border-border" style={{ background: t.swatch }} />
                {t.name}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => setPaletteOpen(!paletteOpen)}
          className="grid size-11 place-items-center rounded-full border border-border bg-card/90 backdrop-blur-xl transition-transform hover:scale-105"
          aria-label="Switch theme"
        >
          <Sparkles className="size-4 text-primary" />
        </button>
      </div>

      {/* NAV */}
      <nav className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl" aria-label="Primary navigation">
        <div className="mx-auto flex max-w-350 items-center justify-between px-5 py-4 md:px-10 lg:px-14">
          <a href="#top" className="group flex items-center gap-3 font-mono text-xs tracking-[0.18em] uppercase">
            <span className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground transition-transform group-hover:rotate-12">{siteConfig.initials}</span>
            <span className="hidden sm:inline">{siteConfig.firstName} {siteConfig.lastName} / Dev</span>
          </a>
          <div className="hidden items-center gap-7 lg:flex">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={`nav-link font-mono text-[11px] tracking-[0.16em] text-muted-foreground uppercase hover:text-foreground ${activeSection === item.href.slice(1) ? 'is-active' : ''}`}
              >
                {item.label}
              </a>
            ))}
          </div>
          <a href="#contact" className="hidden items-center gap-2 rounded-full border border-border px-4 py-2 font-mono text-[11px] tracking-[0.12em] uppercase transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground md:flex">
            Let&apos;s talk <ArrowUpRight className="size-3.5" />
          </a>
          <button type="button" className="grid size-9 place-items-center rounded-full border border-border md:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-label={menuOpen ? 'Close menu' : 'Open menu'}>
            {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
        {menuOpen && (
          <div className="border-t border-border px-5 py-5 md:hidden">
            <div className="flex flex-col gap-4">
              {navItems.map((item) => (
                <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className="font-mono text-sm tracking-[0.12em] uppercase">{item.label}</a>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* HERO */}
      <section id="top" className="relative mx-auto flex min-h-[calc(100svh-73px)] max-w-350 flex-col justify-between px-5 pb-8 pt-10 md:px-10 md:pb-10 md:pt-12 lg:px-14">
        <div className="flex items-start justify-between gap-8">
          <p className="max-w-52 font-mono text-[10px] leading-5 tracking-[0.14em] text-muted-foreground uppercase md:max-w-64">
            {siteConfig.title}<br />Based in {siteConfig.location} / working everywhere
          </p>
          <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
            <span className="size-2 animate-pulse rounded-full bg-primary" /> {siteConfig.availability}
          </div>
        </div>
        <div className="relative py-8 md:py-12">
          <p className="mb-4 font-mono text-[11px] tracking-[0.16em] text-primary uppercase">Hello, I&apos;m {siteConfig.firstName} — I make useful things feel inevitable.</p>
          <h1 className="max-w-6xl text-[clamp(3.4rem,10.8vw,10rem)] font-semibold leading-[0.86] tracking-[-0.075em] text-balance">
            {siteConfig.firstName}<br />
            <span className="text-muted-foreground">{siteConfig.lastName}<span className="text-primary">.</span></span>
          </h1>
          <div className="mt-8 flex flex-col gap-6 md:absolute md:bottom-2 md:right-0 md:mt-0 md:max-w-80">
            <p className="text-pretty text-sm leading-6 text-muted-foreground">{siteConfig.oneLiner}</p>
            <div className="flex flex-wrap gap-3">
              <a href={siteConfig.resumeUrl} download className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-mono text-[11px] tracking-[0.12em] text-primary-foreground uppercase transition-transform hover:-translate-y-0.5">
                Download Resume <Download className="size-3.5" />
              </a>
              <a href="#work" className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 font-mono text-[11px] tracking-[0.12em] uppercase transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground">
                View Projects <ArrowDownRight className="size-3.5" />
              </a>
              <a href="#contact" className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 font-mono text-[11px] tracking-[0.12em] uppercase transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground">
                Contact Me
              </a>
            </div>
            <div className="flex items-center gap-2">
              {Object.entries(siteConfig.social).map(([key, href]) => (
                <a key={key} href={href} target={key === 'email' ? undefined : '_blank'} rel="noreferrer" className="grid size-9 place-items-center rounded-full border border-border transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground" aria-label={key}>
                  <SocialIcon platform={key} />
                </a>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-end justify-between border-t border-border pt-4 font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
          <span>Scroll to explore</span>
          <span>Est. {siteConfig.established} — ∞</span>
        </div>
      </section>

      {/* MARQUEE */}
      <div className="overflow-hidden border-y border-border bg-secondary py-3">
        <div className="marquee flex min-w-max gap-8 font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
          {Array.from({ length: 2 }).map((_, index) => (
            <span key={index} className="flex items-center gap-8">
              AI Engineering <b className="text-primary">✳</b>
              Full-Stack Development <b className="text-primary">✳</b>
              Mobile Development <b className="text-primary">✳</b>
              AI Agents <b className="text-primary">✳</b>
              LLM Applications <b className="text-primary">✳</b>
              React & Next.js <b className="text-primary">✳</b>
              React Native <b className="text-primary">✳</b>
              Product Development <b className="text-primary">✳</b>
            </span>
          ))}
        </div>
      </div>

      {/* ABOUT */}
      <section id="about" className="border-y border-border bg-secondary">
        <div className="mx-auto grid max-w-350 gap-16 px-5 py-24 md:grid-cols-[0.75fr_1.25fr] md:px-10 md:py-36 lg:px-14">
          <Reveal>
            <p className="eyebrow">A little context</p>
            <p className="mt-6 max-w-48 font-mono text-[10px] leading-5 tracking-[0.12em] text-muted-foreground uppercase">
              {about.college}<br />{about.currentYear}
            </p>
          </Reveal>
          <div>
            <Reveal>
              <p className="max-w-4xl text-3xl leading-[1.12] tracking-[-0.05em] text-pretty md:text-5xl">{about.paragraphs[0]}</p>
            </Reveal>
            <Reveal delay={80}>
              <p className="mt-6 max-w-3xl text-lg leading-7 text-muted-foreground">{about.paragraphs[1]} {about.paragraphs[2]}</p>
            </Reveal>
            <Reveal delay={160}>
              <div className="mt-10 flex flex-wrap gap-2">
                {about.interests.map((i) => (
                  <span key={i} className="rounded-full border border-border px-3 py-1.5 font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">{i}</span>
                ))}
              </div>
            </Reveal>
            <Reveal delay={220}>
              <div className="mt-14 grid gap-10 border-t border-border pt-8 sm:grid-cols-3">
                {about.pillars.map((p) => (
                  <div key={p.num}>
                    <span className="eyebrow">{p.num} / {p.label}</span>
                    <p className="mt-4 max-w-48 text-sm leading-6 text-muted-foreground">{p.text}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* STATS - Redesigned Theme Cards */}
      <section className="mx-auto max-w-350 px-5 py-24 md:px-10 md:py-28 lg:px-14">
        <Reveal>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-14">
            <div>
              <p className="eyebrow">By the numbers</p>
              <h2 className="mt-4 max-w-xl text-4xl font-medium tracking-[-0.05em] md:text-6xl">
                Traction, not<br /><span className="text-muted-foreground">just talk.</span>
              </h2>
            </div>
            <p className="mt-4 max-w-xs text-sm text-muted-foreground md:mt-0 md:text-right">
              A snapshot of the projects, code, and milestones that reflect my journey as a developer.
            </p>
          </div>
        </Reveal>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6">
          {stats.map((s, i) => (
            <Reveal key={s.label} delay={i * 60}>
              <div className="group relative h-full overflow-hidden rounded-2xl border border-border bg-muted/30 p-6 backdrop-blur-sm transition-all hover:-translate-y-1 hover:border-primary/50 md:p-8">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-50 transition-opacity group-hover:opacity-100" />
                <div className="relative z-10">
                  <div className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
                    <CountUp end={s.value} suffix={s.suffix} />
                  </div>
                  <p className="mt-2 font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">{s.label}</p>
                </div>
                <div className="absolute -right-8 -top-8 size-24 rounded-full bg-primary/10 blur-3xl transition-opacity group-hover:opacity-70" />
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* SKILLS */}
      <section id="skills" className="border-y border-border bg-secondary">
        <div className="mx-auto max-w-350 px-5 py-24 md:px-10 md:py-36 lg:px-14">
          <Reveal>
            <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-14">
              <div>
                <p className="eyebrow">Toolkit</p>
                <h2 className="mt-4 max-w-xl text-4xl font-medium tracking-[-0.05em] md:text-6xl">
                  The stack<br /><span className="text-muted-foreground">I trust.</span>
                </h2>
              </div>
              <p className="mt-4 max-w-xs text-sm text-muted-foreground md:mt-0 md:text-right">
                From front to back, and AI in between. Here&apos;s what I use to bring ideas to life.
              </p>
            </div>
          </Reveal>
          <div className="grid gap-4 md:grid-cols-3">
            {skillGroups.map((group, i) => {
              const Icon = skillIcons[group.category] || Layers
              return (
                <Reveal key={group.category} delay={i * 60}>
                  <div className="group h-full rounded-2xl border border-border bg-background/50 p-5 backdrop-blur-sm transition-colors hover:border-primary/50 md:p-6">
                    <div className="flex items-center gap-2.5 mb-4">
                      <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                        <Icon className="size-4" />
                      </span>
                      <h3 className="font-mono text-[11px] tracking-[0.16em] uppercase">{group.category}</h3>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {group.items.map((item) => (
                        <span key={item} className="cursor-default rounded-full bg-muted/50 px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground">{item}</span>
                      ))}
                    </div>
                  </div>
                </Reveal>
              )
            })}
          </div>
        </div>
      </section>

      {/* PROJECTS */}
      <section id="work" className="mx-auto max-w-350 px-5 py-24 md:px-10 md:py-36 lg:px-14">
        <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <Reveal>
            <div>
              <p className="eyebrow">Selected work</p>
              <h2 className="mt-4 max-w-xl text-4xl font-medium tracking-[-0.05em] md:text-6xl">
                Things I&apos;ve<br /><span className="text-muted-foreground">shipped lately.</span>
              </h2>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <div className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2">
              <Search className="size-3.5 shrink-0 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search projects, stack, features..."
                className="w-full min-w-0 bg-transparent font-mono text-[11px] tracking-[0.08em] uppercase placeholder:text-muted-foreground focus:outline-none md:w-72"
              />
              {query && (
                <button onClick={() => setQuery('')} className="shrink-0 text-muted-foreground hover:text-foreground" aria-label="Clear search">
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </Reveal>
        </div>

        <Reveal>
          <div className="mb-12 flex flex-wrap gap-2">
            {projectFilters.map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`rounded-full border px-4 py-2 font-mono text-[10px] tracking-[0.14em] uppercase transition-colors ${
                  activeFilter === f
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </Reveal>

        {filteredProjects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-20 text-center">
            <p className="font-mono text-xs tracking-[0.14em] text-muted-foreground uppercase">No projects match your search.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-20 md:gap-28 lg:gap-32">
            {filteredProjects.map((project, index) => (
              <Reveal key={`${project.number}-${project.name}`} delay={Math.min(index, 4) * 40}>
                <ProjectCard project={project} index={index} />
              </Reveal>
            ))}
          </div>
        )}
      </section>

      {/* TECH SPHERE */}
      <section className="border-y border-border bg-secondary">
        <div className="mx-auto max-w-350 px-5 py-24 md:px-10 md:py-36 lg:px-14">
          <div className="grid gap-12 md:grid-cols-[0.6fr_0.4fr] md:items-center">
            <Reveal>
              <div>
                <p className="eyebrow">In rotation</p>
                <h2 className="mt-4 max-w-xl text-4xl font-medium tracking-[-0.05em] md:text-6xl">
                  Tools that<br /><span className="text-muted-foreground">travel with me.</span>
                </h2>
                <p className="mt-6 max-w-md text-sm leading-6 text-muted-foreground">
                  A rotating constellation of the technologies, AI models, frameworks, and tools I use to build scalable web, mobile, and AI-powered applications. Hover to slow it down.
                </p>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <TechSphere items={techStack} />
            </Reveal>
          </div>
        </div>
      </section>

      {/* GITHUB — now fully live, powered by GitHub's GraphQL API */}
      <GitHubSection username={githubConfig.username} />

      {/* TIMELINE - Redesigned Theme Cards */}
      <section id="timeline" className="border-y border-border bg-secondary">
        <div className="mx-auto max-w-350 px-5 py-24 md:px-10 md:py-36 lg:px-14">
          <Reveal>
            <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-16">
              <div>
                <p className="eyebrow">The path so far</p>
                <h2 className="mt-4 max-w-xl text-4xl font-medium tracking-[-0.05em] md:text-6xl">
                  A few years,<br /><span className="text-muted-foreground">a few milestones.</span>
                </h2>
              </div>
              <p className="mt-4 max-w-xs text-sm text-muted-foreground md:mt-0 md:text-right">
                From mastering C++ and DSA to building full-stack and AI-powered applications—each milestone reflects my journey as a software engineer.
              </p>
            </div>
          </Reveal>
          <div className="relative">
            <div className="absolute left-4 top-2 bottom-2 w-px bg-border md:left-1/2 md:-translate-x-1/2" />
            <div className="space-y-8 md:space-y-12">
              {timeline.map((item, i) => (
                <Reveal key={i} delay={i * 40}>
                  <div className={`relative flex items-start gap-6 md:gap-0 ${i % 2 === 0 ? 'md:flex-row-reverse' : ''}`}>
                    <div className="absolute left-4 top-3 z-10 grid size-4 -translate-x-1/2 place-items-center md:left-1/2">
                      <span className={`size-3 rounded-full border-2 transition-colors ${item.year === 'Future' ? 'border-primary bg-primary' : 'border-border bg-background group-hover:border-primary'}`} />
                    </div>
                    <div className={`ml-12 md:ml-0 md:w-1/2 ${i % 2 === 0 ? 'md:pl-12' : 'md:pr-12 md:text-right'}`}>
                      <div className="group inline-block w-full rounded-xl border border-border bg-muted/30 p-4 backdrop-blur-sm transition-colors hover:border-primary/50 hover:bg-muted/50">
                        <span className="font-mono text-[10px] tracking-[0.14em] text-primary uppercase">{item.year}</span>
                        <h3 className="mt-1 text-base font-medium tracking-[-0.02em]">{item.title}</h3>
                        <p className="mt-0.5 text-sm text-muted-foreground">{item.subtitle}</p>
                      </div>
                    </div>
                    <div className="hidden md:block md:w-1/2" />
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* RESUME — advanced canvas-rendered PDF viewer (zoom, pan, page nav, full-screen) */}
      <section id="resume" className="mx-auto max-w-350 px-5 py-24 md:px-10 md:py-36 lg:px-14">
        <div className="grid gap-12 md:grid-cols-[0.6fr_0.4fr] md:items-center">
          <Reveal>
            <div>
              <p className="eyebrow">Resume</p>
              <h2 className="mt-4 max-w-xl text-4xl font-medium tracking-[-0.05em] md:text-6xl">
                The long<br /><span className="text-muted-foreground">version.</span>
              </h2>
              <p className="mt-6 max-w-md text-sm leading-6 text-muted-foreground">
                A concise overview of my skills, projects, experience, and education—all in one place. Updated regularly.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href={siteConfig.resumeUrl} download className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-mono text-[11px] tracking-[0.12em] text-primary-foreground uppercase transition-transform hover:-translate-y-0.5">
                  Download PDF <Download className="size-3.5" />
                </a>
                <a href={siteConfig.resumeUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 font-mono text-[11px] tracking-[0.12em] uppercase transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground">
                  View in browser <ExternalLink className="size-3.5" />
                </a>
              </div>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <PdfViewer url={siteConfig.resumeUrl} fileName="resume.pdf" />
          </Reveal>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="border-t border-border bg-primary text-primary-foreground">
        <div className="mx-auto max-w-350 px-5 py-24 md:px-10 md:py-36 lg:px-14">
          <div className="grid gap-16 md:grid-cols-[1fr_1fr]">
            <Reveal>
              <div>
                <p className="font-mono text-[10px] tracking-[0.16em] uppercase opacity-70">Have a good one?</p>
                <h2 className="mt-5 max-w-4xl text-[clamp(3rem,7vw,7rem)] font-semibold leading-[0.85] tracking-[-0.08em]">
                  Let&apos;s make<br />something <span className="text-background/50">real.</span>
                </h2>
                <p className="mt-8 max-w-md text-sm leading-6 opacity-80">
                  Open to internships, collaborations, and freelance opportunities. Whether you have a project, an idea, or just want to connect, I'd love to hear from you.
                </p>
                <div className="mt-8 space-y-3">
                  <button type="button" onClick={copyEmail} className="group flex items-center gap-3 border-b border-primary-foreground/40 pb-3 font-mono text-xs tracking-[0.12em] uppercase transition-colors hover:border-primary-foreground">
                    {copied ? 'Email copied' : contactInfo.email} {copied ? <Check className="size-4" /> : <Copy className="size-4 transition-transform group-hover:rotate-12" />}
                  </button>
                  <div className="flex flex-col gap-2 font-mono text-[10px] tracking-[0.14em] uppercase opacity-80">
                    <span className="flex items-center gap-2"><MapPin className="size-3.5" /> {contactInfo.location}</span>
                    <span className="flex items-center gap-2"><Calendar className="size-3.5" /> {contactInfo.availability}</span>
                  </div>
                </div>
                <div className="mt-8 flex flex-wrap gap-2">
                  {Object.entries(siteConfig.social).map(([key, href]) => (
                    <a key={key} href={href} target={key === 'email' ? undefined : '_blank'} rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-background/10 px-4 py-2 font-mono text-[10px] tracking-[0.14em] uppercase backdrop-blur transition-colors hover:bg-background hover:text-foreground">
                      <SocialIcon platform={key} /> {key}
                    </a>
                  ))}
                </div>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <form
                onSubmit={handleFormSubmit}
                className="rounded-3xl border border-primary-foreground/20 bg-primary-foreground/5 p-6 backdrop-blur md:p-8"
              >
                {formStatus === 'success' ? (
                  <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center">
                    <span className="grid size-14 place-items-center rounded-full bg-background text-foreground">
                      <Check className="size-6" />
                    </span>
                    <p className="mt-5 text-xl font-medium">Message sent successfully!</p>
                    <p className="mt-2 max-w-xs text-sm opacity-80">Thanks for reaching out. I&apos;ll get back to you shortly.</p>
                    <button type="button" onClick={() => setFormStatus('idle')} className="mt-6 font-mono text-[10px] tracking-[0.14em] uppercase opacity-70 hover:opacity-100">Send another →</button>
                  </div>
                ) : formStatus === 'error' ? (
                  <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center">
                    <span className="grid size-14 place-items-center rounded-full bg-destructive text-primary-foreground">
                      <X className="size-6" />
                    </span>
                    <p className="mt-5 text-xl font-medium">Something went wrong.</p>
                    <p className="mt-2 max-w-xs text-sm opacity-80">Please try again or email me directly at {contactInfo.email}.</p>
                    <button type="button" onClick={() => setFormStatus('idle')} className="mt-6 font-mono text-[10px] tracking-[0.14em] uppercase opacity-70 hover:opacity-100">Try again →</button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block">
                        <span className="font-mono text-[10px] tracking-[0.14em] uppercase opacity-70">Name</span>
                        <input required type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" className="contact-input mt-2" />
                      </label>
                      <label className="block">
                        <span className="font-mono text-[10px] tracking-[0.14em] uppercase opacity-70">Email</span>
                        <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@email.com" className="contact-input mt-2" />
                      </label>
                    </div>
                    <label className="block">
                      <span className="font-mono text-[10px] tracking-[0.14em] uppercase opacity-70">Subject</span>
                      <input required type="text" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="What's this about?" className="contact-input mt-2" />
                    </label>
                    <label className="block">
                      <span className="font-mono text-[10px] tracking-[0.14em] uppercase opacity-70">Message</span>
                      <textarea required rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Tell me about your project, idea, or just say hi." className="contact-input mt-2 resize-none" />
                    </label>
                    <button type="submit" disabled={formStatus === 'loading'} className="flex w-full items-center justify-center gap-2 rounded-full bg-background px-5 py-3 font-mono text-[11px] tracking-[0.14em] text-foreground uppercase transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-70">
                      {formStatus === 'loading' ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" /> Sending...
                        </>
                      ) : (
                        <>
                          Send message <Send className="size-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                )}
              </form>
            </Reveal>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border bg-background">
        <div className="mx-auto max-w-350 px-5 py-10 md:px-10 lg:px-14">
          <div className="flex flex-col justify-between gap-8 md:flex-row md:items-center">
            <a href="#top" className="group flex items-center gap-3 font-mono text-xs tracking-[0.18em] uppercase">
              <span className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground transition-transform group-hover:rotate-12">{siteConfig.initials}</span>
              {siteConfig.name} / Dev
            </a>
            <div className="flex flex-wrap gap-6 font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
              {navItems.map((item) => (
                <a key={item.href} href={item.href} className="hover:text-foreground">{item.label}</a>
              ))}
            </div>
            <div className="flex gap-3">
              {Object.entries(siteConfig.social).map(([key, href]) => (
                <a key={key} href={href} target={key === 'email' ? undefined : '_blank'} rel="noreferrer" className="grid size-8 place-items-center rounded-full border border-border transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground" aria-label={key}>
                  <SocialIcon platform={key} />
                </a>
              ))}
            </div>
          </div>
          <div className="mt-10 flex flex-col gap-3 border-t border-border pt-5 font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase sm:flex-row sm:items-center sm:justify-between">
            <span>© {new Date().getFullYear()} {siteConfig.name}. All rights reserved.</span>
            <span>Built with Next.js · Tailwind · {siteConfig.established} — ∞</span>
          </div>
        </div>
      </footer>
    </main>
  )
}