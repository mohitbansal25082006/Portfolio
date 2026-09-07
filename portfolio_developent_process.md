# Portfolio Website — Development Process & Change Log

# Part 1 — Initial Build

## Overview
Initial project scaffold: single-page portfolio layout, live GitHub integration, custom PDF/image viewers, and an OTP-verified contact form.

## Features Added
- Single-page layout (hero, about, skills, projects, timeline, contact) with scroll-reveal animations
- 6 swappable color themes (Midnight, Cyberpunk, Glass, Minimal, Neon, Ocean) via `oklch()` + `data-theme`
- 3D interactive tech sphere (mouse/touch-reactive tag cloud)
- Animated count-up stat cards
- Live GitHub integration — stats, contribution heatmap w/ day modal, language breakdown, pinned repos, activity feed
- Custom in-browser PDF viewer (`pdf.js`) — zoom/pan, pinch-to-zoom, keyboard shortcuts, jump-to-page, download/print/rotate
- Custom image lightbox — swipe nav, pinch/double-tap zoom, thumbnail strip
- OTP-verified, rate-limited contact form (per-IP daily cap, OTP expiry/attempts, resend cooldown)
- Project gallery component; Vercel Analytics integration

## Files Created
```
.env.example, .gitignore, README.md, components.json, next-env.d.ts, next.config.mjs,
package.json, package-lock.json, pnpm-lock.yaml, postcss.config.mjs, tsconfig.json

app/layout.tsx, app/page.tsx, app/globals.css, app/icon.ico
app/api/github/route.ts, app/api/github/day/route.ts
app/api/contact/send-otp/route.ts, app/api/contact/verify-otp/route.ts

components/portfolio-site.tsx, components/github-section.tsx,
components/pdf-viewer.tsx, components/image-viewer.tsx, components/ui/button.tsx

hooks/use-github-profile.ts, hooks/use-day-commits.ts
lib/content.ts, lib/github.ts, lib/rate-limit.ts, lib/utils.ts

public/banner.png, public/resume.pdf
public/deepdive/ (21 images), public/finsight-ai/ (8 images),
public/mannsahay/ (11 images), public/neurafusion/ (6 images), public/teamscript/ (3 images)
```

## Commands Run
```bash
git clone https://github.com/mohitbansal25082006/Portfolio.git
cd portfolio-website
npm install   # or pnpm install
cp .env.example .env.local
npm run dev
npm run build
npm run lint
```

---

# Part 2.1 — Admin Authentication

## Overview
Introduces the admin dashboard: site-owner auth system, protected `/admin/*` routes, and the 6-theme system integrated into the admin UI.

## Features Added
- Admin login page (`/admin`) with validation, show/hide password, aurora+grid background
- Dashboard shell (`/admin/dashboard`) — sidebar, top nav, stat card slots, activity feed placeholder, quick actions
- Multi-admin credentials via unlimited `ADMIN_MAILn/ADMIN_PASSWORDn` env vars
- HMAC-SHA256 signed session tokens in `httpOnly`/`secure`/`sameSite=strict` cookie
- Auto-redirects (logged-in → dashboard; unauthenticated → login) and logout endpoint
- Timing-safe credential comparison; admin pages excluded from search indexing
- Edge `proxy.ts` guarding all `/admin/*` routes (Web Crypto, double-layer auth w/ server DAL)
- Edge-safe vs Node-only auth split (`admin-auth-edge.ts` vs `admin-auth.ts`)
- Full theme integration + persisted theme switcher (`localStorage('admin-theme')`)
- Input text visibility fix; sidebar viewport fix (independent scroll regions); real favicon logo

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

---

# Part 2.2 — Messages Inbox

## Overview
Builds the Messages inbox in the admin dashboard, backed by dual storage (Upstash Redis in prod, local JSON in dev) so contact submissions persist across serverless deploys.

## Features Added
- Messages dashboard (`/admin/messages`) — full inbox for contact submissions
- Live search/filters (All, Unread, Read, Replied) across name/email/subject/body
- Bulk mark read/unread/delete
- Detail modal with inline reply via `nodemailer` (Gmail)
- Live unread-count stats on dashboard cards and sidebar badge
- Upstash Redis in production; local `.data/portfolio-messages.json` fallback in dev
- `verify-otp` route now saves messages to the store on successful verification

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

---

# Part 2.3 — Analytics Dashboard

## Overview
Adds a full Analytics dashboard sourced live from the Vercel Web Analytics REST API, plus a live-wired stat card on the main dashboard.

## Features Added
- Analytics page (`/admin/analytics`) — 4 key stat cards (page views, unique visitors, avg daily views, top referrers)
- Pure-SVG visit trend bar chart (7d/30d) and device breakdown donut chart
- Top referrers table; period toggle; manual refresh with cache-busting
- Credentials-missing banner + per-section error banner (distinct failure states)
- Dashboard "Page Views" card wired to the same live data
- Auth-guarded backend proxy (`/api/admin/analytics`) hitting 4 Vercel endpoints in parallel, with automatic `by`/`by[]` retry and per-section error propagation
- Avg Daily Views derived from trend data; Top Referrers card corrected to page-view units
- Analytics nav item added (between Messages and Content)

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

---

# Part 2.4 — Resume Management

## Overview
Adds Resume Management: upload, inline preview via the site's own PDF viewer, and download-count tracking, backed by Vercel Blob + Upstash Redis.

## Features Added
- Resume page (`/admin/resume`) with drag-and-drop upload (magic-byte PDF validation, 15MB cap)
- Inline preview reusing `PdfViewer` from Part 1 (zoom, pan, rotate, jump-to-page, download/print)
- Download-count tracking + stat cards (Total downloads, Last updated, File size)
- Storage-not-persistent warning banner when Blob isn't configured
- Resume nav item added (between Analytics and Content)
- Vercel Blob in production (public access, random suffix, best-effort delete of old blob); local-disk fallback (`public/resume.pdf`) in dev
- Metadata stored in Redis (`resume:meta`) with local-file fallback
- Public routes: `GET /api/resume/download` (tracks + 307 redirects) and `GET /api/resume` (metadata)
- Portfolio download buttons and inline viewer now use live resume URL/filename with static fallback

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

---

# Part 2.5 — Site Settings

## Overview
Adds Site Settings for maintenance mode, contact email, availability status, and social links — editable live without a redeploy, using the same dual-storage pattern as Part 2.2.

## Features Added
- Settings page (`/admin/settings`) split into 4 independently-saveable sections
- Maintenance mode toggle + editable banner message (300 char)
- Contact email, availability status (80 char, live counter), and social links (GitHub/LinkedIn/email/Twitter/LeetCode) management
- Live maintenance banner and public settings sync on the portfolio site (availability line, social icons, contact copy button), with static fallback
- Storage-not-persistent warning banner; Settings nav item added after Visitors
- Upstash Redis in prod / local JSON fallback in dev; server-side validation (email format, lengths, URL well-formedness, auto `mailto:` normalization)
- Full theme integration matching other admin pages

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
npm run build
```

---

# Part 2.6 — Security & Session Management

## Overview
Adds Security & Session management: active session viewing, force logout, runtime password change, and a login attempt log — using the same dual-storage pattern, no new env vars.

## Features Added
- Security page (`/admin/security`) — 4 panels: Active Sessions, Force Logout, Change Password, Login Attempts
- Session tracking on login (id, email, IP, user agent, timestamp) embedded in the signed token; current session flagged "This device"
- Force Logout All — confirm-gated, revokes via per-email cutoff timestamp (covers tokens without a live tracked row)
- Edge-safe revocation check in `proxy.ts` via direct Upstash REST fetch (fails open if Redis unconfigured)
- Runtime password override (no `.env` edit) — salted SHA-256 hash, constant-time verification, `.env` remains fallback
- Rolling capped login-attempt log (email, IP, user agent, timestamp, outcome) with All/Failed-only filter
- Storage-not-persistent warning banner; Security nav item added as 8th canonical item
- Security & Session quick action added to Dashboard
- Logout now deregisters the tracked session (no stale "active" rows)
- Full theme integration matching other admin pages

## Files Created
```
lib/admin-security.ts
app/api/admin/security/route.ts
app/admin/security/page.tsx
app/admin/security/security-client.tsx
```

## Files Updated
```
lib/admin-auth.ts                          (verifyAdminCredentials is now async and checks the runtime password override before falling back to .env; createSessionToken embeds a sid + iat; added verifySessionTokenWithRevocation, verifyCurrentPassword, isKnownAdminEmail)
lib/admin-auth-edge.ts                     (verifySessionTokenEdge now also checks the revocation cutoff via a direct Upstash REST fetch, Edge-safe, fails open when Redis isn't configured)
app/api/admin/login/route.ts               (logs every login attempt success/failure with IP + user agent, registers a tracked session on success)
app/api/admin/logout/route.ts              (looks up and removes the session's tracked row, not just clearing the cookie)
app/admin/dashboard/dashboard-client.tsx   (added Security nav item + Security & Session quick action)
app/admin/messages/messages-client.tsx     (added Security nav item)
app/admin/analytics/analytics-client.tsx   (added Security nav item)
app/admin/resume/resume-client.tsx         (added Security nav item)
app/admin/settings/settings-client.tsx     (added Security nav item)
.env.example                               (added Part 2.6 note — no new variables, reuses KV_REST_API_URL/KV_REST_API_TOKEN, documents optional SECURITY_FILE override)
```

## Commands Run
```bash
# No new dependencies — password hashing uses Node's built-in crypto,
# session/login-log storage reuses @upstash/redis already installed in Part 2.2
npm run dev
npm run build
```

---

# Part 2.7 — Content Management

## Overview
Adds Content Management to the admin dashboard: full CRUD over projects, timeline, about section, and skill groups, backed by the same dual-storage pattern. Also removes the redundant Visitors nav item and redesigns the dashboard with live stats across all features.

## Features Added
- Content Management page (`/admin/content`) — 4 tabs: Projects, Timeline, About, Skills
- **Projects tab** — edit description/links/stack/features/images; add/remove/reorder projects (drag-and-drop or buttons); full editor modal with section tabs
- **Timeline tab** — edit year/title/subtitle; add/remove/reorder entries
- **About tab** — edit college/current year; add/remove/reorder paragraphs and interests
- **Skills tab** — edit categories; add/remove/reorder skills and skill groups
- Live content sync — public site fetches `/api/content` on mount, static fallback until resolved; admin edits reflect immediately, no redeploy
- Dual-backend storage: Upstash Redis in prod (reuses existing KV, no new env vars), local `.data/portfolio-content.json` fallback in dev
- Storage-not-persistent warning banner
- Visitors nav item removed (8 → 7 canonical items); Content nav item now uses `FolderKanban` icon
- Redesigned admin dashboard — 6 stat cards (Page Views, Messages, Resume Downloads, Content status, Active Sessions, Projects count), all clickable; live combined activity feed; updated Quick Actions panel
- Full theme integration matching other admin pages

## Files Created
```
lib/content-store.ts
app/api/admin/content/route.ts
app/api/content/route.ts
app/admin/content/page.tsx
app/admin/content/content-client.tsx
```

## Files Updated
```
app/admin/dashboard/dashboard-client.tsx   (Redesigned dashboard with 6 integrated stat cards, live activity feed, updated quick actions, removed Visitors nav item, added Content with FolderKanban icon)
app/admin/messages/messages-client.tsx     (Removed Visitors nav item, added Content with FolderKanban icon)
app/admin/analytics/analytics-client.tsx   (Removed Visitors nav item, added Content with FolderKanban icon, removed Users import)
app/admin/resume/resume-client.tsx         (Removed Visitors nav item, added Content with FolderKanban icon, removed Users import)
app/admin/settings/settings-client.tsx     (Removed Visitors nav item, added Content with FolderKanban icon, removed Users import)
app/admin/security/security-client.tsx     (Removed Visitors nav item, added Content with FolderKanban icon, removed Users import)
components/portfolio-site.tsx              (Fetches live content from /api/content on mount; projects, about, skills, and timeline sections now read from liveContent state with static fallback)
```

## Commands Run
```bash
# No new dependencies — reuses @upstash/redis already installed in Part 2.2
npm run dev
npm run build
npm run lint
```