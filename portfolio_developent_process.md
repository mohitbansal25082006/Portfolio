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
app/admin/layout.tsx
app/admin/page.tsx
app/admin/dashboard/dashboard-client.tsx
lib/admin-auth.ts
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
app/api/contact/verify-otp/route.ts
app/admin/dashboard/dashboard-client.tsx
.env.example
.gitignore
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
app/admin/dashboard/dashboard-client.tsx
app/layout.tsx
.env.example
app/api/admin/analytics/route.ts
app/admin/analytics/analytics-client.tsx
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
app/admin/dashboard/dashboard-client.tsx
components/portfolio-site.tsx
.env.example
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
components/portfolio-site.tsx
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
lib/admin-auth.ts
lib/admin-auth-edge.ts
app/api/admin/login/route.ts
app/api/admin/logout/route.ts
app/admin/dashboard/dashboard-client.tsx
app/admin/messages/messages-client.tsx
app/admin/analytics/analytics-client.tsx
app/admin/resume/resume-client.tsx
app/admin/settings/settings-client.tsx
.env.example
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
app/admin/dashboard/dashboard-client.tsx
app/admin/messages/messages-client.tsx
app/admin/analytics/analytics-client.tsx
app/admin/resume/resume-client.tsx
app/admin/settings/settings-client.tsx
app/admin/security/security-client.tsx
components/portfolio-site.tsx
```

---

# Part 2.8 — Two-Factor Authentication (TOTP)

## Overview
Adds Two-Factor Authentication (2FA) to the admin login using TOTP (Time-based One-Time Password) compatible with Google Authenticator, Authy, Microsoft Authenticator, and other authenticator apps. Includes QR code setup, manual secret entry, replay protection, and full theme integration.

## Features Added
- TOTP implementation (RFC 6238) — HMAC-SHA1, 160-bit Base32 secrets, 30-second windows, ±1 window clock drift tolerance
- Two-step login flow — email+password verified first, then 6-digit code prompt if 2FA enabled
- QR code display via `qrcode.react` (SVG rendering) + manual setup key with copy-to-clipboard
- Replay protection — each TOTP code can only be used once (tracked via `lastUsedCode`)
- Enable flow — generate secret → scan QR → verify code → 2FA active
- Disable flow — requires current valid 6-digit code (prevents session hijackers from disabling 2FA)
- Regenerate option for new secret before activation
- Login attempt logging for 2FA events (`invalid_2fa_code`, `2fa_enabled`, `2fa_disabled`)
- Dual-backend storage: Upstash Redis in prod (reuses existing KV), local `.data/portfolio-2fa.json` fallback in dev
- Separate API route files for proper Next.js nested route handling (`/api/admin/2fa`, `/api/admin/2fa/setup`, `/api/admin/2fa/verify`)
- Full theme integration matching other admin pages
- No new env vars required

## Files Created
```
lib/admin-2fa.ts
app/api/admin/2fa/route.ts
app/api/admin/2fa/setup/route.ts
app/api/admin/2fa/verify/route.ts
```

## Files Updated
```
lib/admin-auth.ts
app/api/admin/login/route.ts
app/admin/page.tsx
app/admin/security/security-client.tsx
package.json
.env.example
```

---

# Part 2.9 — 2FA Recovery Codes & Session Geolocation

## Overview
Enhances 2FA with one-time recovery codes for authenticator loss scenarios and adds approximate city-level geolocation to the Active Sessions panel.

## Features Added

**2FA Recovery Codes:**
- 10 single-use recovery codes generated alongside QR setup (format: `XXXX-XXXX-XX`)
- Recovery codes displayed once during setup with copy/download options
- Codes stored as SHA-256 hashes (never plaintext) in dual-backend storage
- Recovery code login flow — toggle between TOTP and recovery code on login page
- Each recovery code is single-use — removed from store after successful use
- Recovery code status tracking (X of 10 remaining) with generated date
- Regeneration flow — requires current TOTP code, invalidates previous codes, displays new set
- Login attempt logging for recovery code events (`invalid_recovery_code`, `recovery_codes_regenerated`)
- Auto-formatting input for recovery codes on login page

**Session Geolocation:**
- Approximate city/country display in Active Sessions panel (e.g., "San Francisco, United States")
- IP geolocation via ipapi.co free tier (no API key required, 1000 req/day)
- 24-hour in-memory caching with negative cache for failed lookups
- Private/loopback IP detection (localhost, 10.x.x.x, 172.16-31.x.x, 192.168.x.x) — no external calls
- Batch lookup with concurrency limiting (5 parallel requests) to avoid rate limits
- Graceful fallback if geolocation service unavailable
- Scrollable sessions list (max-height 400px) for better UI with many active sessions

## Files Created
```
lib/ip-geolocation.ts
app/api/admin/2fa/recovery/route.ts
```

## Files Updated
```
lib/admin-2fa.ts
lib/admin-security.ts
app/api/admin/security/route.ts
app/api/admin/login/route.ts
app/api/admin/2fa/route.ts
app/api/admin/2fa/setup/route.ts
app/admin/page.tsx
app/admin/security/security-client.tsx
```
# Part 2.10 — Content Version History & Backup

## Overview
Adds version history with rollback capability to content edits and a one-click JSON backup/export system for all site data. Includes version renaming, deletion, and prevents double version creation during rollback operations.

## Features Added
- **Version History** — every content save automatically creates a snapshot
- **Rollback** — restore any previous version with one click (creates single new version, not double)
- **Rename Versions** — custom names for easy identification
- **Delete Versions** — remove unwanted snapshots (current version protected)
- **JSON Backup/Export** — one-click download of all content, settings, and messages
- **Import Backup** — restore from previously exported JSON file
- **Dual-backend storage** — Upstash Redis in prod, local `.data/portfolio-content-versions.json` fallback
- **Version cap** — max 100 versions with automatic trimming
- **Full theme integration** — matches all 6 admin themes
- **Mobile responsive** — proper viewport handling and safe-area padding

## Files Created
```
lib/content-versioning.ts
app/api/admin/content/versions/route.ts
app/api/admin/content/versions/[id]/route.ts
app/api/admin/backup/route.ts
app/admin/content/version-history-client.tsx
app/admin/content/backup-client.tsx
```

## Files Updated
```
lib/content-store.ts
app/api/admin/content/route.ts
app/admin/content/content-client.tsx
```

## Part 3 — Advanced Project Image Management Summary

### Files Created (New):
```
lib/project-images.ts
app/api/admin/project-images/route.ts
app/api/admin/project-images/cleanup/route.ts
components/project-image-manager.tsx
```

### Files Updated:
```
lib/content-store.ts
lib/content-versioning.ts
app/api/admin/backup/route.ts
app/admin/content/content-client.tsx
app/admin/content/version-history-client.tsx
app/admin/content/backup-client.tsx
```

### Features Added:
- **Vercel Blob image upload** — drag-and-drop, multi-file, project-specific organization
- **Any URL support** — Google Drive, external links, local paths (no validation restrictions)
- **No max image limit** — unlimited images per project
- **Image preview grid** — hover actions, drag-to-reorder, move up/down
- **Inline image preview** — click to view full-size
- **Orphaned image cleanup** — detect and remove unused images
- **Image metadata tracking** — filename, size, type, upload timestamp

### Features Updated:
- **Content store** — image metadata support, relaxed URL validation
- **Version history** — image stats per version (count, size, storage type)
- **Backup system** — includes image metadata in JSON export/import
- **Content client** — integrated image manager, storage warnings, cleanup button
- **Version history UI** — shows image stats for each version
- **Backup UI** — displays image count and size in backup info



## Part 3.2 Summary


### Files Updated:
- `lib/content-store.ts` — Added category management helpers, tech stack normalization, full content normalization
- `lib/content-versioning.ts` — Enhanced backup with full content coverage, category counts in summary
- `app/admin/content/content-client.tsx` — Removed Tech Stack tab, added Categories section in Project Editor, fixed fs import error (moved helpers to client-side)
- `app/admin/content/backup-client.tsx` — Removed unnecessary info line, added categories count display
- `app/api/admin/backup/route.ts` — Updated with full backup coverage, info endpoint, import/export validation
- `components/portfolio-site.tsx` — Fixed TechSphere to handle empty/invalid items, added fallback to static techStack

### Features Added:
- **Project Categories Management** — Add/remove/update categories directly in Project Editor with quick-add buttons (ai, web, mobile, open-source)
- **Tech Stack 3D Sphere Fix** — Filters empty/invalid items, deduplicates, shows graceful empty state, falls back to static data
- **Full Backup Coverage** — Backup now includes ALL content fields (hero, stats, techStack, filters, navItems, pillars, categories)
- **Backup Info Endpoint** — `GET /api/admin/backup?info=true` returns full data summary with category counts
- **Category Normalization** — Categories auto-lowercased and trimmed


## Part 3.2 Summary

### Files Created:
- `components/site-paused-screen.tsx` — Full-screen animated maintenance page
- `app/api/admin/security/logout-all-except/route.ts` — API endpoint for logout all except current device

### Files Updated:
- `lib/admin-security.ts` — Added logout-all-except function, expired session cleanup, login attempts week filtering
- `app/api/admin/security/route.ts` — Updated GET with login attempt filtering, removed nested route handling
- `app/admin/security/security-client.tsx` — Added "Log out all other devices" option, login attempts note, session expiry display
- `lib/settings.ts` — Added sitePaused, sitePausedTitle, sitePausedMessage fields
- `app/api/settings/route.ts` — Exposed sitePaused fields publicly
- `app/api/admin/settings/route.ts` — Added sitePaused validation
- `app/admin/settings/settings-client.tsx` — Added "Site Availability" section with pause toggle and customization
- `components/portfolio-site.tsx` — Shows SitePausedScreen when sitePaused enabled, maintenance banner support
- `app/globals.css` — Added site-paused screen styles, animations, mobile optimizations

### Features Added:
- **Logout all except current device** — Revokes all other sessions while keeping current device signed in
- **Auto session cleanup** — Expired sessions (8+ hours) automatically removed from active sessions list
- **Login attempts smart filter** — Shows last 7 days of attempts, falls back to latest 10 if no recent activity
- **Full site pause mode** — Completely hides portfolio and shows animated maintenance screen
- **Customizable pause screen** — Admin can set custom title and message for maintenance screen
- **Session expiry display** — Active sessions now show expiry time

### Features Updated:
- **Active Sessions** — Now shows expiry time, auto-removes expired sessions
- **Force Logout** — Added "Log out all other devices" option alongside "Log out all sessions"
- **Login Attempts** — Smart filtering with informational note about displayed time range
- **Settings UI** — Reorganized into "Site Availability" section with pause and banner options
- **Portfolio Site** — Shows full-screen pause when enabled, banner when maintenance mode on


## Part 3.3 — Analytics: Own-Site Page Views, IP-Based Unique Visitors, Device Breakdown & Top Referrers

### Features Updated
- Total Page Views now counts only the deployed portfolio site (excludes `/admin/*` and API routes)
- Unique Visitors now deduped by hashed IP address instead of Vercel's cookieless fingerprint
- Visit Trend chart now shows exactly 7 or 30 days (fixed off-by-one/boundary-day bug), and is now interactive — hover a bar to see exact date + views, animated highlight
- Device Breakdown now sourced from our own site-only tracking (desktop/mobile/tablet classified from User-Agent), consistent with Total Page Views
- Top Referrers now sourced from our own site-only tracking (referrer hostname per visit, "Direct" for no referrer or same-site navigation), consistent with Total Page Views
- Removed "Top Referrers" stat card from the top Key Metrics grid (now 3 cards instead of 4); bottom Top Referrers panel unchanged
- All five metrics (views, visitors, trend, devices, referrers) now derived from one self-hosted, site-scoped source instead of Vercel Analytics — guaranteed internally consistent
- Fixed 404 on `/admin/analytics` caused by overlapping Proxy matcher entries
- Fixed all-zero/empty data caused by a broken Proxy matcher regex that stopped visit recording on public pages
- Hardened read/write paths so a single failing Redis call can no longer zero out unrelated metrics

### Files Created
```
lib/site-analytics.ts
```

### Files Updated
```
proxy.ts
app/api/admin/analytics/route.ts
app/admin/analytics/analytics-client.tsx
```


# Part 3.4 (Dashboard Upgrade) — Summary

## Files Created
```
lib/dashboard-aggregator.ts
app/api/admin/dashboard/route.ts
components/admin/charts.tsx
components/admin/widgets.tsx
components/admin/dashboard-shell.tsx
components/admin/stat-card.tsx
```

## Files Updated
```
app/admin/dashboard/dashboard-client.tsx
app/admin/dashboard/page.tsx
app/globals.css
```

## Features Added
- **Single aggregated dashboard endpoint** (`/api/admin/dashboard`) — one round-trip returns analytics, messages, resume, content, security, settings, activity feed, and health checks, with per-section error isolation.
- **Theme-aware SVG chart toolkit** — `Sparkline`, interactive `BarChart` (hover tooltip), `DonutChart` (hover legend), `ProgressRing`, `MiniStackedBar`, `DeltaBadge`. Zero external chart deps, all 6 themes work automatically.
- **Reusable admin chrome** (`DashboardShell`) — collapsible sidebar (persisted), full mobile drawer with overlay, breadcrumb, theme picker, session chip, refresh control, admin badge, logout.
- **Rich `StatCard`** — count-up animation, sparkline row, delta badge vs previous period, progress bar / custom stacked segments, badge pill, hover lift + shine, whole-card link.
- **Layout primitives** — `Panel`, `PanelHeader`, `SkeletonBlock`, `EmptyState`, `HealthDot` (ping animation), `ActivityRow`, `QuickActionButton`, `InlineSpinner`.
- **Period toggle (7d / 30d)** with live refresh.
- **Combined activity feed** across messages / content / resume / security / settings with tone tints.
- **System Health panel** — Redis, Blob, site status, content versioning with green/amber dots.
- **Site summary strip** — status, availability, contact email, social link count.
- **Distinct device colors** — `DISTINCT_DEVICE_COLORS` palette (blue/green/amber) guarantees no two slices share a hue across any theme.
- **Storage-awareness banners** — amber "running on local storage" + degraded-data banner.
- **Full mobile optimisation** — 1→2→3 col stat grid, 12-col responsive main grid, safe-area insets, dynamic viewport height, hover states degrade to tap.

## Features Updated
- **Dashboard home fully rewritten** — replaced the Part 2.7 layout with a 12-column responsive grid (trend 8 + devices 4 → activity 5 + referrers 4 + health 3 → messages 7 + quick actions 5 → full-width site strip). No orphan columns on any breakpoint.
- **"Content" card → "Projects"** — now shows project count with timeline + skill-group sub-line.
- **"Tech Stack" card → "Site Settings"** — shows Live/Paused/Banner status, social link count, availability.
- **Image count + size fixed** — aggregator now counts every non-empty URL across `project.images` + `project-images.ts` records, so it can never show 0 when the Content page shows >0.
- **"0 B" hidden** — Size cell only renders when `images > 0` and byte count is real; image strip gracefully collapses to 2 or 1 column when data is partial.
- **`app/globals.css`** — appended `skeleton-shimmer` keyframe, reduced-motion overrides, iOS scroll helper, and collapsed-sidebar centering rule.