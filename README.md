# Portfolio — Project Detail

A single-page Next.js portfolio for **Mohit Bansal** (Full-Stack Developer ·
AI Engineer · Mobile Developer), featuring a live GitHub integration,
theme switching, project search/filtering, an advanced in-browser resume
PDF viewer, and a working contact form.

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
| 7 | **Projects** | `#work` | Searchable, filterable project showcase (8 projects) — multi-screenshot gallery per project, features/stack/challenges/metrics, Live + GitHub links. |
| 8 | **Tech Sphere** | — | Interactive 3D rotating sphere of tech-stack tags (mouse-follow + auto-spin). |
| 9 | **GitHub** | `#github` | **Live, real-time GitHub data** — see §3 below for full breakdown. |
| 10 | **Timeline** | `#timeline` | Vertical alternating timeline of milestones (2024 → Future), animated on scroll. |
| 11 | **Resume** | `#resume` | **Advanced canvas-rendered PDF viewer** — see §3.5 below for full breakdown. |
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
- **Advanced, mobile-safe resume viewer** — canvas-rendered PDF (via `pdfjs-dist`) with zoom, pan, page navigation, and full-screen mode — see §3.5.
- **Full mobile responsiveness** — every section (including the GitHub section and the resume viewer) is tuned down to small phone widths.

---

## 3. GitHub section — live data (the headline feature)

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

## 3.5 Resume section — advanced in-browser PDF viewer

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

---

## 4. Environment variables required

| Variable | Used by | Purpose |
|---|---|---|
| `GITHUB_TOKEN` | `lib/github.ts` | Fine-grained GitHub PAT (public repos + followers, read-only) for GraphQL/REST calls. |
| `GITHUB_USERNAME` | `app/api/github/route.ts`, `app/api/github/day/route.ts` | Default GitHub login when the client doesn't pass `?username=`. |
| `EMAIL_USER` | `app/api/contact/route.ts` | Gmail address the contact form sends from/to. |
| `EMAIL_PASS` | `app/api/contact/route.ts` | Gmail App Password for Nodemailer auth. |

See `.env.local.example` for the template and `GITHUB_INTEGRATION_GUIDE.md`
for full token-creation and setup steps. The resume PDF viewer requires **no**
environment variables — it works entirely client-side against the static
file at `siteConfig.resumeUrl`.

---

## 5. File map

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
│   ├── portfolio-site.tsx             Main page component — assembles every section, theme switcher, nav, contact form logic, resume viewer
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

## 6. Tech stack

- **Framework**: Next.js 16 (App Router, Turbopack dev server)
- **Styling**: Tailwind CSS v4 + custom CSS variables (`oklch()` color themes)
- **UI primitives**: `@base-ui/react`, `class-variance-authority`, `lucide-react` icons
- **Email**: Nodemailer (Gmail SMTP)
- **Data**: GitHub GraphQL API v4 + REST API v3 (native `fetch`, no client library)
- **PDF rendering**: `pdfjs-dist` — canvas-based, client-side PDF rendering that replaces native iframe PDF viewing for consistent cross-browser/mobile compatibility (zoom, pan, page navigation, full-screen)
- **Analytics**: `@vercel/analytics`
- **Fonts**: Geist / Geist Mono (via `next/font/google`)

---

## 7. Dependencies to install

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