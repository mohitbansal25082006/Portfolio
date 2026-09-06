# Portfolio Website — Development Process (Part 1)

## Overview
Part 1 covers the initial build of the portfolio site: project scaffolding, the main single-page layout, the live GitHub integration, the custom PDF and image viewers, and the OTP-verified contact form.

---

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

---

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

---

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

## Features Added

### Authentication System
- **Admin login page** at `/admin` — email + password form with field validation, show/hide password toggle, generic error banner, aurora + grid background, styled with existing design tokens
- **Admin dashboard shell** at `/admin/dashboard` — responsive sidebar, top nav bar, welcome banner, 4 stat card slots, activity feed placeholder, quick actions panel
- **Multi-admin credential support** — reads `ADMIN_MAIL1/ADMIN_PASSWORD1`, `ADMIN_MAIL2/ADMIN_PASSWORD2`, … (unlimited) from `.env.local` at runtime
- **HMAC-SHA256 session tokens** — signed with `ADMIN_SESSION_SECRET`, no external JWT library required, stored in `httpOnly` / `secure` / `sameSite=strict` cookie
- **Automatic redirects** — already-logged-in users visiting `/admin` → `/admin/dashboard`; unauthenticated users hitting protected routes → `/admin?redirect=<path>`
- **Logout** — `POST /api/admin/logout` immediately expires the cookie; client redirects to `/admin`
- **Timing-safe credential comparison** — uses `crypto.timingSafeEqual` to prevent timing attacks
- **Admin pages excluded from search indexing** — `robots: { index: false }` in admin layout metadata

### Route Protection
- **Next.js 16 `proxy.ts`** — edge proxy guards all `/admin/*` routes using the Web Crypto API (no Node.js modules), double-layer auth (proxy + server component DAL)
- **Edge-safe auth split** — `lib/admin-auth-edge.ts` (Web Crypto, edge-compatible) vs `lib/admin-auth.ts` (Node crypto, server-only) to avoid runtime conflicts

### UI & Theme System
- **Full theme integration** — all 6 portfolio themes (Midnight, Cyberpunk, Glass, Minimal, Neon, Ocean) work in the admin section
- **Theme switcher** — Palette button on both login page and dashboard header; theme persisted in `localStorage('admin-theme')`; defaults to Midnight
- **Input text visibility** — inputs use `var(--foreground)` for text (readable on all themes); removed `.contact-input` class which used near-black `var(--primary-foreground)` on dark backgrounds
- **Sidebar viewport fix** — root wrapper is `h-screen overflow-hidden`; sidebar nav scrolls internally; page body scrolls independently — sidebar never overflows viewport
- **Logo** — replaced placeholder `<Shield>` icon with actual site favicon (`/icon.ico`) in sidebar header and welcome banner
- **Admin layout decoupled** — removed hardcoded `data-theme="midnight"` from layout; each page applies its own theme via client-side hook

---

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

## Features Added

### Messages Inbox UI
- **Messages Dashboard** at `/admin/messages` — Full-featured inbox to view all contact form submissions.
- **Live Search & Filters** — Filter by All, Unread, Read, Replied, and search across name, email, subject, and message content.
- **Bulk Actions** — Select multiple messages to mark as read/unread or delete them in bulk.
- **Detail Modal & Inline Reply** — Click a message to read the full text and reply directly from the dashboard. Replies are sent via `nodemailer` using the portfolio's connected Gmail account.
- **Live Stats Integration** — Dashboard overview cards and the sidebar navigation badge now fetch and display the real-time unread messages count.

### Dual-Backend Storage System
- **Upstash Redis (Production)** — Automatically used when `KV_REST_API_URL` and `KV_REST_API_TOKEN` are present (injected by Vercel KV). Ensures messages persist across serverless deployments.
- **Local JSON Fallback (Development)** — Automatically falls back to saving a `.data/portfolio-messages.json` file in local dev environments without requiring any external database setup.

### Contact Form Integration
- **Message Persistence** — Updated the public contact form's `verify-otp` route to save messages into the dual-backend store immediately upon successful verification and email delivery.

---

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

## Packages Installed

```bash
npm install @upstash/redis
```



# Part 2.3 — Development Process & Change Log

## Features Added

### Analytics Overview Dashboard
- **Analytics page** at `/admin/analytics` — Full analytics dashboard showing real-time data from the Vercel Web Analytics REST API.
- **4 Key Metric Stat Cards** — Total Page Views, Unique Visitors, Average Daily Views, and Top Referrers — displayed as themed cards with icons.
- **Visit Trend Bar Chart** — Pure SVG bar chart (zero external libs) showing daily page views for the last 7 or 30 days. Y-axis ticks, x-axis date labels, hover tooltips.
- **Device Breakdown Donut Chart** — Pure SVG donut ring visualising Desktop / Mobile / Tablet split with a percentage legend and a total-visits counter in the center.
- **Top Referrers Table** — Horizontal bar table showing traffic sources with absolute counts and percentage breakdown.
- **Period Toggle** — Switch between "7d" and "30d" views; all data (stats, trend, devices, referrers) re-fetches instantly on toggle.
- **Refresh Button** — Manual data refresh with cache-busting (`_t` timestamp param + `cache: 'no-store'`) to bypass both Next.js server-side cache and browser cache.
- **Credentials-not-configured Banner** — Amber warning banner shown when `VERCEL_API_TOKEN` or `VERCEL_PROJECT_ID` is missing, with an inline display of the API reason string for debugging.
- **Per-section error banner** — Distinct from the credentials banner; shown when credentials ARE configured but one or more of the four Vercel calls (count / trend / referrers / devices) still failed, listing which section failed and why.
- **Dashboard "Page Views" stat card wired to live data** — the Admin Dashboard overview card now fetches the same `/api/admin/analytics?period=7d` data used by the Analytics page and displays real total page views plus a unique-visitors subtext, instead of a static placeholder.

### Vercel Web Analytics REST API Integration
- **Backend proxy route** at `/api/admin/analytics` — Auth-guarded server route that proxies 4 Vercel API calls in parallel:
  - `GET /v1/query/web-analytics/visits/count` → total pageviews + visitors
  - `GET /v1/query/web-analytics/visits/aggregate?by=day` → daily trend
  - `GET /v1/query/web-analytics/visits/aggregate?by=referrerHostname` → top referrers
  - `GET /v1/query/web-analytics/visits/aggregate?by=deviceType` → device breakdown
- **All responses parsed with verified field names** — field mapping confirmed against the Vercel REST API reference: `data.pageviews`, `data.visitors`, `row.timestamp`, `row.referrerHostname`, `row.deviceType`.
- **Automatic `by` param retry** — sends the simple `by=<dimension>` form first; if that specific call 400s, retries once with the array form (`by[]=<dimension>`) before giving up.
- **Per-section error propagation** — the route returns an `_errors` object (keyed `count` / `trend` / `referrers` / `devices`) alongside the data whenever a specific call fails, instead of silently returning a zero/empty result for that section.
- **Avg. Daily Views recalculated from trend data** — derived directly from the same `trend` array the chart renders (sum of daily views ÷ number of days in range) rather than `totalViews / period`, keeping it visually consistent with the chart above it.
- **Top Referrers stat card corrected** — now shows total referred page views (matching the units of the other three stat cards) instead of a raw source count; source count moved to the card's subtext.

### Dashboard Integration
- **Analytics nav item** added to the admin sidebar in `dashboard-client.tsx` (between Messages and Content).
- **Page Views stat card** now shows real data (see above) instead of a static sub-text placeholder.

---

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