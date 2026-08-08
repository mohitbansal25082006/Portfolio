# Portfolio — Project Detail

A single-page Next.js portfolio for **Mohit Bansal** (Full-Stack Developer ·
AI Engineer · Mobile Developer), featuring a live GitHub integration,
theme switching, a searchable/filterable project showcase with a
full-screen image viewer, an advanced in-browser resume PDF viewer, and a
working contact form.

---

## 1. Sections (in page order)

| # | Section | ID | What it does |
|---|---|---|---|
| 1 | **Nav bar** | — | Sticky top nav with active-section highlighting (IntersectionObserver-driven), mobile hamburger menu, "Let's talk" CTA. |
| 2 | **Hero** | `#top` | Name, title, availability pill, one-liner, resume download, social links, scroll cue. |
| 3 | **Marquee** | — | Infinite-scrolling strip of skill keywords (AI Engineering, Full-Stack, etc). |
| 4 | **About** | `#about` | Bio paragraphs, college/year, interest tags, 3 "pillars" (Build / Innovate / Grow). |
| 5 | **Stats** | — | Animated count-up cards (Projects Built, DSA Problems, AI Tools, GitHub Contributions, Technologies, Years Coding). |
| 6 | **Skills** | `#skills` | 7 categorized skill groups (Languages, Frontend, Backend, Database, AI/ML, Mobile, Tools) as icon cards. |
| 7 | **Projects** | `#work` | Searchable, filterable project showcase (8 projects) — see §3 below for the full breakdown of the redesigned gallery + full-screen viewer. |
| 8 | **Tech Sphere** | — | Interactive 3D rotating sphere of tech-stack tags (mouse-follow + auto-spin). |
| 9 | **GitHub** | `#github` | **Live, real-time GitHub data** — see §4 below for full breakdown. |
| 10 | **Timeline** | `#timeline` | Vertical alternating timeline of milestones (2024 → Future), animated on scroll. |
| 11 | **Resume** | `#resume` | **Advanced canvas-rendered PDF viewer** — see §5 below for full breakdown. |
| 12 | **Contact** | `#contact` | Working contact form (POSTs to `/api/contact`, sends email via Nodemailer/Gmail) with loading/success/error states, plus email-copy button and social links. |
| 13 | **Footer** | — | Logo, nav links, social icons, copyright. |
| — | **Theme switcher** | — | Floating bottom-right button cycling 6 color themes (Midnight, Cyberpunk, Glass, Minimal, Neon, Ocean) via `data-theme` attribute + CSS custom properties. |

---

## 2. Global features

- **6 swappable color themes** — all driven by CSS custom properties in `oklch()`, switched instantly via a `data-theme` attribute on `<html>`.
- **Scroll-reveal animations** — a shared `<Reveal>` wrapper fades/slides content in via `IntersectionObserver`.
- **Animated stat counters** — `<CountUp>` eases numbers up when scrolled into view.
- **Project search + category filters** — client-side filtering across name, description, stack, and features.
- **Responsive mobile menu** — hamburger nav with slide-down panel.
- **Grain + aurora background effects** — subtle SVG noise overlay and blurred animated color blobs for visual depth.
- **Working contact form** — real email delivery via Nodemailer, with a branded HTML email template.
- **Full-screen image viewer** — reusable component powering every project's screenshot gallery, see §3.
- **Advanced, mobile-safe resume viewer** — canvas-rendered PDF (via `pdfjs-dist`) with zoom, pan, page navigation, and full-screen mode — see §5.
- **Full mobile responsiveness** — every section (project gallery, image viewer, GitHub section, resume viewer) is tuned down to small phone widths, including dynamic-viewport-height handling so full-screen overlays never get clipped by mobile browser chrome.

---

## 3. Projects section — gallery + full-screen image viewer

The projects section (`#work`) was redesigned for two things: comfortably
hosting large, screenshot-heavy projects (like DeepDive AI's 12 screenshots)
and being fully usable on both mobile and desktop.

### 3.1 Layout (`ProjectCard`, inside `components/portfolio-site.tsx`)

- Each project renders as a `ProjectCard`: a compact in-page gallery on one
  side and full detail (name, problem statement, live/GitHub links,
  features, stack, challenges, metrics) on the other.
- Alternates left/right at the `lg` breakpoint only, and stacks vertically
  below that — so it reads cleanly through tablet widths, not just phones.
- On large screens the gallery **sticks** (`lg:sticky`) while the detail
  column scrolls alongside it.
- The **feature list collapses** to 6 items with a "+N more" toggle, since
  large projects (DeepDive AI has 15 features) previously produced a wall
  of text.
- Metrics and challenges stack vertically on mobile instead of squeezing
  side-by-side.

### 3.2 In-page gallery (`ProjectGallery`, inside `components/portfolio-site.tsx`)

A compact "browser chrome" card that lives inline in each project's detail
block:

- Left / right arrow buttons (fade in on hover on desktop, always visible
  on mobile), swipe support, arrow-key navigation when focused
- Slide counter (`3 / 12`) and progress dots (dots only render when a
  project has ≤ 8 images, so large sets like DeepDive AI's don't overflow)
- Scrollable thumbnail strip along the bottom, highlighting the active shot
- Clicking the main image, or the dedicated zoom button, opens the
  **full-screen viewer** (§3.3) at the currently active image

### 3.3 Full-screen image viewer (`components/image-viewer.tsx` — new file)

A standalone, reusable `ImageViewer` component (not specific to
projects — any image set can use it) that opens as a full-screen overlay.

**Desktop**
- Left/right on-screen arrow buttons
- `←` / `→` arrow keys, `Esc` to close, `0` to reset zoom
- `Ctrl/Cmd + scroll wheel`, or `+`/`−` buttons, to zoom (up to 4×)
- Click-and-drag to pan once zoomed in
- Double-click to toggle 100% ↔ 200%

**Mobile**
- One-finger swipe left/right to move between images
- Pinch-to-zoom, one-finger drag to pan once zoomed in
- Double-tap to toggle 100% ↔ 200%
- Same on-screen arrow buttons as large tap targets, so navigation is
  discoverable even before a user tries swiping

**Shared**
- Thumbnail strip at the bottom to jump directly to any image
- Slide counter, zoom-percentage readout, reset-zoom button
- Body scroll is locked while open; closes via the × button, `Esc`, or a
  backdrop click
- Uses **dynamic viewport height** (`100dvh`) rather than `100vh`, and a
  `min-h-0` flex layout for the image stage, so the viewer always fits
  within what's actually visible — this specifically fixes an earlier bug
  where the image and bottom thumbnail bar could get pushed off-screen on
  mobile once the browser's address bar was accounted for
- The image itself is centered with a **deterministic flex box**
  (`flex items-center justify-center` + a fully-sized, `object-contain`
  `<img>`) rather than `absolute` positioning with auto-margins — the
  latter resolved the image's size inconsistently across browsers when
  combined with the zoom/pan CSS transform, which was the cause of the
  image intermittently rendering small and off-center with a clipped
  right-arrow button. The current approach renders correctly every time,
  on every screen size.

### 3.4 `content.ts` project numbering fix

Two projects were previously both numbered `'02'` and both named
"DeepDive AI" (the real project plus a leftover placeholder), which
collided with the gallery's list keys. Numbering was corrected — the real
DeepDive AI is now `01`, and the placeholder was renamed to "MannSahay"
(matching the existing timeline entry) pending its own real content and
screenshots.

---

## 4. GitHub section — live data

Unlike most of the rest of the site (which is static content from
`lib/content.ts`), the GitHub section pulls **real, real-time data** from
GitHub's GraphQL and REST APIs on every page load, cached at the edge for
performance.

**What it shows:**
- **Stat cards**: public repo count, total stars earned, **all-time total contributions** (summed across every contribution year via one aliased GraphQL query), longest contribution streak.
- **Contribution heatmap** for a **selectable year** (dropdown lists every year GitHub has contribution data for), with **month labels** aligned above the correct week columns and a current-streak indicator.
- **Click-to-inspect commits**: clicking any day square opens a bottom-sheet/modal listing that day's actual commits (via GitHub's Search Commits API), each linking directly to the commit on GitHub.
- **All languages**: a full, byte-weighted breakdown of every language used across the account's repositories (GitHub's own "top languages" methodology — not capped at a handful), with a proportional color bar and scrollable list.
- **Pinned repositories** (up to 4): live stars, forks, description, and primary language, pulled from what's actually pinned on the GitHub profile.
- **Recent activity feed**: live public events (pushes, PRs, issues, stars, releases, forks, reviews) with relative timestamps and links.
- **Manual refresh button**: forces a real network refetch (bypasses both browser and server caches) and updates a "Synced Xm ago" indicator.
- **Loading skeletons** and a **dedicated error state** with retry, so a missing/invalid token degrades gracefully instead of breaking the page.

**How it stays fast without hammering GitHub's API:** server responses are
cached for 1 hour (contribution/profile data) or 15 minutes (activity feed)
via Next.js's `fetch` revalidation, with an additional CDN-level
`Cache-Control` header. A manual refresh explicitly bypasses all of that to
guarantee fresh data on demand.

---

## 5. Resume section — advanced in-browser PDF viewer

**The problem it replaces:** the resume preview previously used a raw
`<iframe src="/resume.pdf">`. Many mobile browsers — Android Chrome
WebViews, in-app browsers (Instagram/LinkedIn/etc.), and several iOS Safari
configurations — have no built-in PDF plugin to hand the iframe request off
to, so the embed silently rendered blank on those devices.

**The fix:** the resume preview now renders the PDF itself, client-side, to
`<canvas>` using `pdfjs-dist` — the same rendering engine that powers
Firefox's and Chrome's own native PDF viewers — so it looks and behaves
identically across desktop and mobile, regardless of the browser's native
plugin support.

**Inline preview card** (`components/pdf-viewer.tsx` → `PdfViewer`)
- Renders a real, live thumbnail of page 1 (not a static placeholder)
- Reuses the existing `.resume-preview` tilt-on-hover styling from `globals.css`
- Tap or click anywhere on the card opens the full-screen viewer
- Loading spinner while the thumbnail renders; graceful fallback text ("Preview unavailable — tap to open") if rendering fails, so the resume is still reachable

**Full-screen viewer** (`PdfModal`, mounted on demand when the card is opened)
- **Continuous scroll** through every page, lazy-rendered per page as it enters view (`IntersectionObserver`-driven), with a live current-page indicator
- **Zoom** (50%–400%):
  - `+` / `−` buttons and a tap-to-reset percentage readout
  - `Ctrl/Cmd + scroll wheel` on desktop
  - **Pinch-to-zoom** on touch devices
  - **Double-tap** (touch) / **double-click** (desktop) to toggle 100% ↔ 200%
- **Pan**: click-and-drag on desktop, one-finger drag on touch once zoomed past 100%
- **Page navigation**: prev/next buttons, a jump-to-page number input, and keyboard shortcuts (`←`/`→`, `PageUp`/`PageDown`, `Esc` to close, `0` to reset zoom)
- **Rotate** in 90° increments
- **Download**, **open in new tab**, and **print** actions, all wired to the same `siteConfig.resumeUrl`
- Body scroll is locked while the modal is open; `Esc` or the × button closes it
- **Loading and error states** — if the PDF fails to parse, the viewer falls back to direct download/open links instead of a blank screen
- A small mobile-only hint bar reminds touch users: "Pinch to zoom · Double-tap to zoom · Drag to pan"

No changes to `siteConfig.resumeUrl` or `/public/resume.pdf` were required —
the viewer reads from the exact same path the old iframe used.

> **Note:** the resume viewer's full-screen modal and the new project image
> viewer (§3.3) solve very similar problems (zoom, pan, full-screen,
> mobile gestures) but are intentionally separate components — the PDF
> viewer is tied to `pdfjs-dist` page rendering, while `ImageViewer` is a
> general-purpose image lightbox usable anywhere in the site.

---

## 6. Environment variables required

| Variable | Used by | Purpose |
|---|---|---|
| `GITHUB_TOKEN` | `lib/github.ts` | Fine-grained GitHub PAT (public repos + followers, read-only) for GraphQL/REST calls. |
| `GITHUB_USERNAME` | `app/api/github/route.ts`, `app/api/github/day/route.ts` | Default GitHub login when the client doesn't pass `?username=`. |
| `EMAIL_USER` | `app/api/contact/route.ts` | Gmail address the contact form sends from/to. |
| `EMAIL_PASS` | `app/api/contact/route.ts` | Gmail App Password for Nodemailer auth. |

See `.env.local.example` for the template and `GITHUB_INTEGRATION_GUIDE.md`
for full token-creation and setup steps. Neither the resume PDF viewer nor
the project image viewer requires **any** environment variables — both work
entirely client-side against static assets (`siteConfig.resumeUrl` and each
project's `images` array in `lib/content.ts`, respectively).

---

## 7. File map

```
portfolio-website/
│
├── app/
│   ├── layout.tsx                     Root layout — fonts, metadata, Vercel Analytics, hydration-safe <html>/<body>
│   ├── globals.css                    All theme tokens, base styles, component CSS (sphere, marquee, cards, resume-preview tilt, etc.)
│   ├── page.tsx                       (not shown — renders <PortfolioSite />)
│   └── api/
│       ├── contact/
│       │   └── route.ts               Contact form email handler (Nodemailer + Gmail)
│       └── github/
│           ├── route.ts               GET /api/github — live profile/contribution/language/repo data
│           └── day/
│               └── route.ts           GET /api/github/day — commits made on a specific date
│
├── components/
│   ├── portfolio-site.tsx             Main page component — assembles every section, theme switcher, nav, project gallery + card, contact form logic, resume viewer
│   ├── image-viewer.tsx               ★ NEW — full-screen image viewer/lightbox: arrow nav + keyboard on desktop, swipe/pinch/double-tap on mobile, thumbnail strip, zoom/pan. Used by the project gallery, reusable anywhere else an image set needs a full-screen view.
│   ├── github-section.tsx             Live GitHub section — heatmap, year picker, day-commit modal, languages, pinned repos, activity
│   ├── pdf-viewer.tsx                 Advanced PDF viewer — canvas rendering (pdfjs-dist), zoom/pan/rotate/page-nav, full-screen modal, mobile gestures
│   └── ui/
│       └── button.tsx                 Shared shadcn-style Button component (variants/sizes)
│
├── hooks/
│   ├── use-github-profile.ts          Client hook: fetches /api/github, exposes data/loading/error/refetch (force-bypasses cache on manual refresh)
│   └── use-day-commits.ts             Client hook: fetches /api/github/day for the click-a-day commit modal
│
├── lib/
│   ├── content.ts                     Single source of truth for all static content (bio, projects, skills, timeline, theme swatches, githubConfig)
│   ├── github.ts                      Server-only GitHub GraphQL/REST client — profile, contributions, languages, pinned repos, activity, day-commits
│   └── utils.ts                       (not shown — likely `cn()` classname helper used by button.tsx)
│
├── public/
│   └── resume.pdf                     Resume file served at siteConfig.resumeUrl, rendered client-side by components/pdf-viewer.tsx
│
├── .env.local                         Local secrets (git-ignored) — GITHUB_TOKEN, GITHUB_USERNAME, EMAIL_USER, EMAIL_PASS
├── .env.local.example                 Template for the above
├── GITHUB_INTEGRATION_GUIDE.md        Step-by-step setup guide for the live GitHub integration
└── PROJECT_DETAIL.md                  This file
```

---

## 8. Tech stack

- **Framework**: Next.js 16 (App Router, Turbopack dev server)
- **Styling**: Tailwind CSS v4 + custom CSS variables (`oklch()` color themes)
- **UI primitives**: `@base-ui/react`, `class-variance-authority`, `lucide-react` icons
- **Email**: Nodemailer (Gmail SMTP)
- **Data**: GitHub GraphQL API v4 + REST API v3 (native `fetch`, no client library)
- **PDF rendering**: `pdfjs-dist` — canvas-based, client-side PDF rendering that replaces native iframe PDF viewing for consistent cross-browser/mobile compatibility (zoom, pan, page navigation, full-screen)
- **Image viewing**: custom `ImageViewer` component (`components/image-viewer.tsx`) — no external dependency, built on native pointer/touch events
- **Analytics**: `@vercel/analytics`
- **Fonts**: Geist / Geist Mono (via `next/font/google`)

---

## 9. Dependencies to install

In addition to the existing `package.json` dependencies, the resume viewer
requires:

```json
"dependencies": {
  "pdfjs-dist": "^4.9.155"
}
```

```bash
npm install
# or
pnpm install
```

The PDF.js worker script is loaded automatically at runtime from the
Cloudflare CDN (`cdnjs.cloudflare.com/ajax/libs/pdf.js/<version>/pdf.worker.min.mjs`),
matched to the exact installed `pdfjs-dist` version — no local worker file
or webpack config changes are required.

**Optional — self-host the worker** (avoids the CDN request):
1. Copy `node_modules/pdfjs-dist/build/pdf.worker.min.mjs` to `/public/pdf.worker.min.mjs`
2. In `components/pdf-viewer.tsx`, change:
   ```ts
   mod.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
   ```

The project image viewer (`components/image-viewer.tsx`) requires **no**
additional dependencies — it's built entirely on native browser APIs
(pointer/touch events, CSS transforms) and only imports icons already used
elsewhere in the project (`lucide-react`).