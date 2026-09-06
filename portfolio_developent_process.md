# Portfolio Website — Development Process (Part 1)

## Overview
Part 1 covers the initial build of the portfolio site: project scaffolding, the main single-page layout, the live GitHub integration, the custom PDF and image viewers, and the OTP-verified contact form.

## Features Added

- **Single-page portfolio layout** (`portfolio-site.tsx`) — hero, about, skills, projects, timeline, contact, all sections assembled with scroll-based reveal animations.
- **6 swappable color themes** (Midnight, Cyberpunk, Glass, Minimal, Neon, Ocean) via `oklch()` CSS variables and a `data-theme` attribute.
- **3D interactive tech sphere** — rotating tag cloud that follows mouse/touch input.
- **Scroll-triggered reveal animations** using `IntersectionObserver`.
- **Animated count-up stats** cards.
- **Live GitHub integration** (`github-section.tsx`, `lib/github.ts`, `hooks/use-github-profile.ts`, `hooks/use-day-commits.ts`) — stat cards, contribution heatmap with day-click modal, language breakdown, pinned repos, activity feed, manual refresh.
- **Custom in-browser PDF viewer** (`pdf-viewer.tsx`) — built on `pdfjs-dist`; thumbnail card, full-screen modal, zoom/pan, pinch-to-zoom, keyboard shortcuts, jump-to-page, download/print/rotate.
- **Custom image lightbox** (`image-viewer.tsx`) — swipe navigation, pinch-to-zoom, double-tap zoom, keyboard/desktop controls, smart thumbnail strip.
- **OTP-verified, rate-limited contact form** (`app/api/contact/send-otp`, `app/api/contact/verify-otp`, `lib/rate-limit.ts`) — two-step email verification, per-IP daily send cap, OTP expiry/attempt limits, resend cooldown.
- **Project gallery component** for browsing per-project screenshots.
- **Vercel Analytics** integration in `layout.tsx`.

## Files Created

```
.env.example
.gitignore
README.md
components.json
next-env.d.ts
next.config.mjs
package.json
package-lock.json
pnpm-lock.yaml
postcss.config.mjs
tsconfig.json

app/layout.tsx
app/page.tsx
app/globals.css
app/icon.ico

app/api/github/route.ts
app/api/github/day/route.ts
app/api/contact/send-otp/route.ts
app/api/contact/verify-otp/route.ts

components/portfolio-site.tsx
components/github-section.tsx
components/pdf-viewer.tsx
components/image-viewer.tsx
components/ui/button.tsx

hooks/use-github-profile.ts
hooks/use-day-commits.ts

lib/content.ts
lib/github.ts
lib/rate-limit.ts
lib/utils.ts

public/banner.png
public/resume.pdf
public/deepdive/  (21 images)
public/finsight-ai/  (8 images)
public/mannsahay/  (11 images)
public/neurafusion/  (6 images)
public/teamscript/  (3 images)
```

## Commands Run

```bash
# Clone repo
git clone https://github.com/mohitbansal25082006/Portfolio.git
cd portfolio-website

# Install dependencies
npm install
# or
pnpm install

# Set up environment variables
cp .env.example .env.local

# Run dev server
npm run dev

# Build check
npm run build

# Lint
npm run lint
```



# Part 2.1 — Development Process & Change Log

## Overview
Part 2.1 introduces the admin dashboard: an authentication system for the site owner, protected `/admin/*` routes, and full integration of the existing 6-theme system into the admin UI.

## Features Added

- **Admin login page** at `/admin` — email + password form with field validation, show/hide password toggle, generic error banner, aurora + grid background, styled with existing design tokens.
- **Admin dashboard shell** at `/admin/dashboard` — responsive sidebar, top nav bar, welcome banner, 4 stat card slots, activity feed placeholder, quick actions panel.
- **Multi-admin credential support** — reads `ADMIN_MAIL1/ADMIN_PASSWORD1`, `ADMIN_MAIL2/ADMIN_PASSWORD2`, … (unlimited) from `.env.local` at runtime.
- **HMAC-SHA256 session tokens** — signed with `ADMIN_SESSION_SECRET`, no external JWT library required, stored in `httpOnly` / `secure` / `sameSite=strict` cookie.
- **Automatic redirects** — already-logged-in users visiting `/admin` → `/admin/dashboard`; unauthenticated users hitting protected routes → `/admin?redirect=<path>`.
- **Logout** — `POST /api/admin/logout` immediately expires the cookie; client redirects to `/admin`.
- **Timing-safe credential comparison** — uses `crypto.timingSafeEqual` to prevent timing attacks.
- **Admin pages excluded from search indexing** — `robots: { index: false }` in admin layout metadata.
- **Next.js 16 `proxy.ts`** — edge proxy guards all `/admin/*` routes using the Web Crypto API (no Node.js modules), double-layer auth (proxy + server component DAL).
- **Edge-safe auth split** — `lib/admin-auth-edge.ts` (Web Crypto, edge-compatible) vs `lib/admin-auth.ts` (Node crypto, server-only) to avoid runtime conflicts.
- **Full theme integration** — all 6 portfolio themes (Midnight, Cyberpunk, Glass, Minimal, Neon, Ocean) work in the admin section.
- **Theme switcher** — Palette button on both login page and dashboard header; theme persisted in `localStorage('admin-theme')`; defaults to Midnight.
- **Input text visibility** — inputs use `var(--foreground)` for text (readable on all themes); removed `.contact-input` class which used near-black `var(--primary-foreground)` on dark backgrounds.
- **Sidebar viewport fix** — root wrapper is `h-screen overflow-hidden`; sidebar nav scrolls internally; page body scrolls independently — sidebar never overflows viewport.
- **Logo** — replaced placeholder `<Shield>` icon with actual site favicon (`/icon.ico`) in sidebar header and welcome banner.
- **Admin layout decoupled** — removed hardcoded `data-theme="midnight"` from layout; each page applies its own theme via client-side hook.

## Files Created

```
lib/admin-auth.ts
lib/admin-auth-edge.ts
proxy.ts
app/admin/layout.tsx
app/admin/page.tsx
app/admin/dashboard/page.tsx
app/admin/dashboard/dashboard-client.tsx
app/api/admin/login/route.ts
app/api/admin/logout/route.ts
```

## Files Updated

```
.env.example
app/admin/layout.tsx       (removed hardcoded theme)
app/admin/page.tsx         (input fix, icon.ico logo, theme switcher)
app/admin/dashboard/dashboard-client.tsx  (sidebar fix, icon.ico, theme switcher)
lib/admin-auth.ts          (re-exports ADMIN_COOKIE_NAME from edge file, removed duplicate)
```



# Part 2.2 — Development Process & Change Log

## Overview
Part 2.2 builds the Messages inbox inside the admin dashboard, backed by a dual-storage system (Upstash Redis in production, a local JSON file in development) so contact form submissions persist reliably across serverless deployments.

## Features Added

- **Messages Dashboard** at `/admin/messages` — full-featured inbox to view all contact form submissions.
- **Live Search & Filters** — filter by All, Unread, Read, Replied, and search across name, email, subject, and message content.
- **Bulk Actions** — select multiple messages to mark as read/unread or delete them in bulk.
- **Detail Modal & Inline Reply** — click a message to read the full text and reply directly from the dashboard. Replies are sent via `nodemailer` using the portfolio's connected Gmail account.
- **Live Stats Integration** — dashboard overview cards and the sidebar navigation badge now fetch and display the real-time unread messages count.
- **Upstash Redis (Production)** — automatically used when `KV_REST_API_URL` and `KV_REST_API_TOKEN` are present (injected by Vercel KV). Ensures messages persist across serverless deployments.
- **Local JSON Fallback (Development)** — automatically falls back to saving a `.data/portfolio-messages.json` file in local dev environments without requiring any external database setup.
- **Message Persistence** — updated the public contact form's `verify-otp` route to save messages into the dual-backend store immediately upon successful verification and email delivery.

## Files Created

```
lib/messages.ts
app/api/admin/messages/route.ts
app/api/admin/messages/[id]/route.ts
app/api/admin/messages/reply/route.ts
app/admin/messages/page.tsx
app/admin/messages/messages-client.tsx
```

## Files Updated

```
app/api/contact/verify-otp/route.ts       (Added saveMessage call on success)
app/admin/dashboard/dashboard-client.tsx  (Added live stats fetch and UI wiring)
.env.example                              (Added Upstash Redis / Vercel KV variables)
.gitignore                                (Added *.tsbuildinfo rule)
```

## Commands Run

```bash
npm install @upstash/redis
```



# Part 2.3 — Development Process & Change Log

## Overview
Part 2.3 adds a full Analytics dashboard to the admin panel, sourced live from the Vercel Web Analytics REST API, including a visit trend chart, device breakdown, referrer table, and a live-wired stat card on the main dashboard overview.

## Features Added

- **Analytics page** at `/admin/analytics` — full analytics dashboard showing real-time data from the Vercel Web Analytics REST API.
- **4 Key Metric Stat Cards** — Total Page Views, Unique Visitors, Average Daily Views, and Top Referrers — displayed as themed cards with icons.
- **Visit Trend Bar Chart** — pure SVG bar chart (zero external libs) showing daily page views for the last 7 or 30 days. Y-axis ticks, x-axis date labels, hover tooltips.
- **Device Breakdown Donut Chart** — pure SVG donut ring visualising Desktop / Mobile / Tablet split with a percentage legend and a total-visits counter in the center.
- **Top Referrers Table** — horizontal bar table showing traffic sources with absolute counts and percentage breakdown.
- **Period Toggle** — switch between "7d" and "30d" views; all data (stats, trend, devices, referrers) re-fetches instantly on toggle.
- **Refresh Button** — manual data refresh with cache-busting (`_t` timestamp param + `cache: 'no-store'`) to bypass both Next.js server-side cache and browser cache.
- **Credentials-not-configured Banner** — amber warning banner shown when `VERCEL_API_TOKEN` or `VERCEL_PROJECT_ID` is missing, with an inline display of the API reason string for debugging.
- **Per-section error banner** — distinct from the credentials banner; shown when credentials ARE configured but one or more of the four Vercel calls (count / trend / referrers / devices) still failed, listing which section failed and why.
- **Dashboard "Page Views" stat card wired to live data** — the Admin Dashboard overview card now fetches the same `/api/admin/analytics?period=7d` data used by the Analytics page and displays real total page views plus a unique-visitors subtext, instead of a static placeholder.
- **Backend proxy route** at `/api/admin/analytics` — auth-guarded server route that proxies 4 Vercel API calls in parallel (visits count, daily trend, top referrers, device breakdown).
- **Automatic `by` param retry** — sends the simple `by=<dimension>` form first; if that specific call 400s, retries once with the array form (`by[]=<dimension>`) before giving up.
- **Per-section error propagation** — the route returns an `_errors` object (keyed `count` / `trend` / `referrers` / `devices`) alongside the data whenever a specific call fails, instead of silently returning a zero/empty result for that section.
- **Avg. Daily Views recalculated from trend data** — derived directly from the same `trend` array the chart renders, keeping it visually consistent with the chart above it.
- **Top Referrers stat card corrected** — now shows total referred page views (matching the units of the other three stat cards) instead of a raw source count; source count moved to the card's subtext.
- **Analytics nav item** added to the admin sidebar in `dashboard-client.tsx` (between Messages and Content).

## Files Created

```
app/api/admin/analytics/route.ts
app/admin/analytics/page.tsx
app/admin/analytics/analytics-client.tsx
```

## Files Updated

```
app/admin/dashboard/dashboard-client.tsx  (Added BarChart2 import, Analytics sidebar nav item, wired Page Views stat card to live analytics data)
app/layout.tsx                            (Removed NODE_ENV === 'production' guard from <Analytics /> — must always render for Vercel to detect it)
.env.example                              (Added VERCEL_API_TOKEN, VERCEL_PROJECT_ID, VERCEL_TEAM_ID section)
app/api/admin/analytics/route.ts          (Per-section error handling, `by`/`by[]` retry logic)
app/admin/analytics/analytics-client.tsx  (Avg. Daily Views and Top Referrers stat card fixes, inline error states)
```



# Part 2.4 — Development Process & Change Log

## Overview
Part 2.4 adds Resume Management to the admin dashboard: uploading a new resume PDF, viewing the current resume inline using the site's own custom PDF viewer, and tracking resume download counts — backed by Vercel Blob for file storage and the existing Upstash Redis instance for metadata.

## Features Added

- **Resume page** at `/admin/resume` — dedicated admin page for managing the single resume PDF visitors download from the live portfolio.
- **Drag-and-drop upload** — a themed dropzone (click-to-browse or drag a file onto it) that uploads a new resume PDF via `multipart/form-data`, replacing whatever was previously live. Validates the file is actually a PDF by checking its `%PDF-` magic bytes server-side, and enforces a 15MB size ceiling.
- **Inline resume preview using the site's own custom PDF viewer** — reuses `components/pdf-viewer.tsx` (the same `PdfViewer` from Part 1) instead of a plain `<iframe>`: an animated terminal-style trigger card that opens a full-screen, portal-rendered modal with zoom, pinch-to-zoom, pan, rotate, jump-to-page, and download/print controls. Fully re-themes with the rest of the admin UI since it's already built on the same CSS variables.
- **Download count tracking** — every time a visitor downloads the resume from the public site, a counter increments; the admin Resume page displays this as a live stat card ("Total downloads").
- **Additional stat cards** — Last updated (timestamp of the most recent upload) and File size, alongside the download counter.
- **Storage-not-persistent warning banner** — if Vercel Blob isn't configured, an amber banner explains that uploads are only being saved to local disk and won't survive a redeploy.
- **Resume nav item** added to the admin sidebar (`dashboard-client.tsx`), between Analytics and Content.
- **Vercel Blob (Production)** — automatically used when `BLOB_READ_WRITE_TOKEN` is present. Stores the actual PDF bytes with public access and `addRandomSuffix: true` so re-uploads get a fresh URL. The previous blob is deleted (best-effort) on every successful re-upload.
- **Local disk fallback (Development)** — without a Blob token, uploads are written straight to `public/resume.pdf` on disk, served immediately by `next dev`.
- **Metadata (both environments)** — reuses the existing Upstash Redis instance from Part 2.2 to store `{ url, fileName, size, uploadedAt, downloadCount, blobPathname }` under the key `resume:meta`, with a `.data/resume-meta.json` local-file fallback when Redis isn't configured.
- **Public download-tracking route** at `GET /api/resume/download` — increments the download counter (fire-and-forget) and issues a 307 redirect to the current resume's real URL, appending `?download=<filename>` for Vercel Blob URLs to force a native "Save As" dialog.
- **Public metadata route** at `GET /api/resume` — unauthenticated, returns `{ url, fileName }` so the public portfolio's inline PdfViewer and "View in browser" links always point at the current file.
- **`portfolio-site.tsx` updated** — both "Download Resume" buttons now point at `/api/resume/download`; the "View in browser" link and the inline PdfViewer now use a `resumeUrl` / `resumeFileName` pair fetched client-side from `/api/resume` on mount, falling back to the original static `siteConfig.resumeUrl` until that fetch resolves.

## Files Created

```
lib/resume.ts
app/api/admin/resume/route.ts
app/api/resume/route.ts
app/api/resume/download/route.ts
app/admin/resume/page.tsx
app/admin/resume/resume-client.tsx
```

## Files Updated

```
app/admin/dashboard/dashboard-client.tsx  (Added Resume sidebar nav item, between Analytics and Content)
components/portfolio-site.tsx             (Download buttons routed through /api/resume/download; inline PdfViewer and "View in browser" link now use live resumeUrl/resumeFileName fetched from /api/resume)
.env.example                              (Added BLOB_READ_WRITE_TOKEN and NEXT_PUBLIC_SITE_URL under a new "Resume Management (Part 2.4)" section)
```

## Commands Run

```bash
npm install @vercel/blob
```



# Part 2.5 — Development Process & Change Log

## Overview
Part 2.5 adds Site Settings to the admin dashboard: toggling site-wide maintenance mode with a custom banner message, updating the contact email shown on the public site, updating the "Open to Internships" availability status line, and updating social links — all editable live from the admin panel without a redeploy, backed by the same dual-storage pattern (Upstash Redis in production, a local JSON file in development) introduced in Part 2.2.

## Features Added

- **Settings page** at `/admin/settings` — dedicated admin page for controlling site-wide configuration, split into four independently saveable sections.
- **Maintenance Mode toggle** — a themed switch to turn maintenance mode on/off, paired with a custom, editable banner message (up to 300 characters) shown to visitors on the live site while enabled.
- **Contact Email management** — update the email address shown in the hero, contact section, and footer copy-to-clipboard button, without touching source code.
- **Availability Status editor** — update the short "Open to Internships & Collaborations" status line shown in the hero, with an 80-character limit and live counter.
- **Social Links management** — update GitHub, LinkedIn, contact email, Twitter/X, and LeetCode links shown across the hero, contact section, and footer; optional links (e.g. Twitter) can be left blank to hide that icon entirely.
- **Per-section independent saving** — each of the four settings sections (Maintenance, Contact, Availability, Social) saves and reports success/failure independently, so editing one doesn't require resubmitting the others.
- **Live maintenance banner** — the public portfolio (`portfolio-site.tsx`) fetches current settings on load and renders a sticky, dismiss-free banner at the top of the page whenever maintenance mode is active, using the admin-configured message.
- **Public settings sync** — the hero availability line, all social icon links (hero, contact, footer), and the contact email copy button on the public site now read live from the settings store instead of static values in `lib/content.ts`, falling back to those static values until the client fetch resolves.
- **Storage-not-persistent warning banner** — if Upstash Redis isn't configured, an amber banner explains that settings changes are only being saved to a local file and won't survive a redeploy, matching the same warning pattern from the Resume page in Part 2.4.
- **Settings nav item** added to the admin sidebar (`dashboard-client.tsx`), after Visitors.
- **Upstash Redis (Production)** — automatically used when `KV_REST_API_URL` and `KV_REST_API_TOKEN` are present, reusing the same KV store already configured for messages and resume metadata. No new environment variables required.
- **Local JSON fallback (Development)** — automatically falls back to saving a `.data/portfolio-settings.json` file in local dev environments, matching the pattern from Parts 2.2 and 2.4.
- **Server-side validation** — the settings API validates email format, availability status length, maintenance message length, and that social URLs are well-formed before saving; the email social link is normalized to a `mailto:` prefix automatically.
- **Full theme integration** — the Settings page uses the same `useAdminTheme` hook, `data-theme` attribute, and CSS-variable styling as the Dashboard, Analytics, and Resume admin pages, so all 6 portfolio themes (Midnight, Cyberpunk, Glass, Minimal, Neon, Ocean) apply consistently, synced via the same `localStorage('admin-theme')` key.

## Files Created

```
lib/settings.ts
app/api/admin/settings/route.ts
app/api/settings/route.ts
app/admin/settings/page.tsx
app/admin/settings/settings-client.tsx
```

## Files Updated

```
components/portfolio-site.tsx  (Live settings fetched from /api/settings on mount; maintenance banner added; hero availability line, all social icon links, and contact email copy button now read from live settings with static fallback)
```

## Commands Run

```bash
# No new dependencies — reuses @upstash/redis already installed in Part 2.2
npm run dev

# Build check
npm run build
```