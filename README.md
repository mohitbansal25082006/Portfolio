<p align="center">
  <img src="./public/banner.png" alt="Mohit Bansal – Portfolio Banner" width="100%" />
</p>

<h1 align="center">
  <img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=28&pause=1000&color=00F5A0&center=true&vCenter=true&random=false&width=600&height=50&lines=Hi+%F0%9F%91%8B%2C+I'm+Mohit+Bansal;Full-Stack+Developer;AI+Engineer;Mobile+Developer" alt="Typing SVG" />
</h1>

<p align="center">
  <a href="https://www.mohitbansal.online/" target="_blank">
    <img src="https://img.shields.io/badge/LIVE_DEMO-Visit_Website-00F5A0?style=for-the-badge&logo=vercel&logoColor=white" alt="Live Demo" />
  </a>
  <a href="https://github.com/mohitbansal/portfolio-website" target="_blank">
    <img src="https://img.shields.io/badge/SOURCE_CODE-GitHub-181717?style=for-the-badge&logo=github&logoColor=white" alt="Source Code" />
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/pdf.js-4.9-red?style=flat-square&logo=mozilla&logoColor=white" alt="PDF.js" />
  <img src="https://img.shields.io/badge/Admin-2FA_%2B_Sessions-8A2BE2?style=flat-square&logo=shieldsdotio&logoColor=white" alt="Admin Security" />
  <img src="https://img.shields.io/badge/Status-Live_&_Maintained-success?style=flat-square" alt="Status" />
</p>

---

## 🌟 Overview

A single-page, highly interactive portfolio built for **Mohit Bansal** — backed by a full self-built **admin dashboard** for managing the site without ever touching code or redeploying.

This isn't just a static resume. It's a real-time web application featuring live GitHub API integration, an advanced cross-platform resume PDF viewer, a custom-built image lightbox, an OTP-verified & rate-limited contact form, 6 fully swappable color themes, and — behind `/admin` — a private control panel with authentication, 2FA, session management, live analytics, content editing, resume management, version history, and one-click backups.

🚀 **Live Site:** [https://www.mohitbansal.online/](https://www.mohitbansal.online/)

---

## ✨ Public Site Features

### 🎨 Design & Experience
- **6 Swappable Color Themes:** Midnight, Cyberpunk, Glass, Minimal, Neon, and Ocean. Driven entirely by `oklch()` CSS custom properties and switched instantly via a `data-theme` attribute — used consistently across the public site *and* the entire admin dashboard.
- **Scroll-Triggered Animations:** Custom `<Reveal>` wrapper using `IntersectionObserver` for buttery-smooth fade/slide-ins.
- **3D Interactive Tech Sphere:** A rotating sphere of tech-stack tags that follows the mouse and auto-spins — hardened to filter empty/invalid items, dedupe entries, and gracefully fall back to static data if live content is unavailable.
- **Aurora & Grain Backgrounds:** Subtle SVG noise overlay and blurred animated color blobs for visual depth.
- **Animated Stats:** Count-up cards that trigger when scrolled into view.
- **Site Pause / Maintenance Mode:** Admin-togglable full-screen animated "paused" screen with a customizable title and message, plus a lighter maintenance banner mode for smaller notices.

### 💻 Advanced Functionality
- **Live GitHub Integration:** Real-time data fetching via GraphQL & REST APIs — stat cards, contribution heatmap (with day-click modal), language breakdown, pinned repos, and activity feed.
- **In-Browser PDF Viewer:** Canvas-rendered resume viewer (`pdf.js`) replacing unreliable native `<iframe>` plugins — zoom/pan, pinch-to-zoom, keyboard shortcuts, jump-to-page, download/print/rotate.
- **Custom Image Lightbox:** A zero-dependency, mobile-safe full-screen image viewer with swipe navigation, pinch/double-tap zoom, and a thumbnail strip.
- **OTP-Verified Contact Form:** Two-step email verification via a 6-digit one-time code, plus per-IP daily rate limiting, to keep the inbox spam- and spoof-free.
- **Live Content, Settings & Resume:** The public site pulls projects, timeline, about, skills, site settings, and the live resume file from the admin-managed backend on every load — with static fallbacks so nothing breaks if a data store is briefly unavailable.

---

## 🔐 Admin Dashboard

Everything under `/admin` is a private, authenticated control panel for running the site without a redeploy. Built incrementally, feature by feature:

### Authentication & Access Control
- **Multi-admin login** via unlimited `ADMIN_MAILn` / `ADMIN_PASSWORDn` environment variable pairs, with timing-safe credential comparison.
- **Signed sessions:** HMAC-SHA256 tokens in an `httpOnly` / `secure` / `sameSite=strict` cookie.
- **Edge-enforced protection:** `proxy.ts` guards every `/admin/*` route at the edge (Web Crypto) with a second server-side check for defense in depth. Admin pages are excluded from search indexing.
- **Two-Factor Authentication (TOTP):** RFC 6238-compliant, HMAC-SHA1, 160-bit Base32 secrets, 30-second windows with ±1 window clock-drift tolerance. Compatible with Google Authenticator, Authy, Microsoft Authenticator, etc. QR code setup (`qrcode.react`) plus manual key entry, one-time-use replay protection, and a two-step login flow (password → 6-digit code).
- **Recovery Codes:** 10 single-use codes (`XXXX-XXXX-XX` format) generated at 2FA setup, shown once with copy/download, stored only as SHA-256 hashes, with a dedicated recovery-code login path and a regeneration flow gated behind a valid TOTP code.
- **Runtime password change:** Override the `.env` password at runtime (salted SHA-256, constant-time verification) — no redeploy needed.

### Session & Security Management
- **Active Sessions panel:** Every login is tracked (id, email, IP, approximate city/country, user agent, timestamp, expiry) with the current device flagged.
- **Session geolocation:** Approximate city-level lookups via the free `ipapi.co` tier, 24-hour in-memory caching (including negative caching), private/loopback IP short-circuiting, and concurrency-limited batch lookups.
- **Force logout:** "Log out all sessions" or "Log out all other devices" (keeps the current session alive), enforced via a per-email revocation cutoff so it also invalidates tokens that aren't in the live session list.
- **Auto session cleanup:** Sessions older than 8 hours are pruned automatically.
- **Login attempt log:** Rolling, capped log of every login/2FA/recovery-code attempt (email, IP, user agent, outcome) with an All/Failed-only filter and a smart 7-day window that falls back to the latest 10 attempts if nothing recent exists.

### Messages Inbox
- Full contact-form submission inbox with live search and filters (All / Unread / Read / Replied) across name, email, subject, and body.
- Bulk mark read/unread/delete, a detail modal, and inline reply sent via `nodemailer` (Gmail).
- Live unread-count badges on the dashboard and sidebar.

### Analytics
- Self-hosted, site-scoped analytics — **no third-party dependency** for core metrics.
- **Total Page Views** (portfolio pages only — `/admin/*` and API routes excluded).
- **Unique Visitors** deduped by hashed IP address.
- **Visit Trend chart:** exact 7d/30d windows, interactive hover tooltips showing date + views.
- **Device Breakdown** and **Top Referrers**, both classified from the same self-hosted tracking data so every metric stays internally consistent.
- Credentials-missing and per-section error banners for graceful degradation.

### Resume Management
- Drag-and-drop upload with magic-byte PDF validation and a 15MB cap.
- Inline preview reusing the site's own `PdfViewer` (zoom, pan, rotate, jump-to-page, download/print).
- Download-count tracking with stat cards (total downloads, last updated, file size).
- **Vercel Blob** storage in production (public access, randomized suffix, best-effort cleanup of the old file) with a local-disk fallback in development.

### Content Management
- Full CRUD across four tabs: **Projects**, **Timeline**, **About**, and **Skills**.
- **Projects:** edit description, links, stack, features, and images; add/remove/reorder via drag-and-drop or buttons; full editor modal with section tabs; project **category** management with quick-add presets (ai, web, mobile, open-source).
- **Timeline:** edit year/title/subtitle; add/remove/reorder entries.
- **About:** edit college/current year; add/remove/reorder paragraphs and interests.
- **Skills:** edit categories; add/remove/reorder skills and skill groups.
- Changes reflect on the live site immediately — no redeploy required.

### Advanced Project Image Management
- **Vercel Blob** drag-and-drop multi-file uploads, organized per project.
- Accepts any image URL (Google Drive, external links, local paths) — no restrictive validation.
- No cap on images per project; preview grid with drag-to-reorder, move up/down, and full-size inline preview.
- **Orphaned image cleanup** to detect and remove unused uploads, with metadata tracking (filename, size, type, upload timestamp).

### Version History & Backups
- Every content save automatically snapshots a new version (capped at 100, with automatic trimming).
- One-click **rollback** to any previous version (creates a single new version, never a duplicate).
- Rename or delete versions (the current version is protected from deletion).
- **One-click JSON export** of all content, settings, and messages, plus **import** to restore from a previous backup — full coverage of every content field (hero, stats, tech stack, filters, nav items, pillars, categories).

### Site Settings
- **Maintenance mode** toggle with an editable banner message (300 char limit).
- **Site Availability:** full-page pause mode with a customizable title/message, independent of the lighter banner mode.
- Contact email, availability status line (80 char, live counter), and social links (GitHub, LinkedIn, email, Twitter, LeetCode) — all synced live to the public site with server-side validation (email format, length limits, URL well-formedness, automatic `mailto:` normalization).

### Unified Dashboard
- Single aggregated endpoint (`/api/admin/dashboard`) fetches analytics, messages, resume, content, security, and settings data in one round-trip, with **per-section error isolation** so one failing section never blanks the rest.
- Theme-aware, zero-dependency SVG chart toolkit: sparklines, interactive bar charts, donut charts, progress rings, stacked bars, and delta badges — all six themes supported automatically.
- Collapsible sidebar (state persisted), full mobile drawer, breadcrumbs, theme picker, session chip, manual refresh, and 7d/30d period toggle.
- Live combined activity feed across messages, content, resume, security, and settings.
- **System Health panel** — Redis, Blob storage, site status, and content versioning shown with live status dots.
- Fully responsive: 1→2→3 column stat grid, 12-column responsive main layout, safe-area insets for mobile, and graceful hover→tap degradation on touch devices.

---

## 📸 Deep Dive: Custom Viewers

Both the Resume and Projects sections required handling complex media on mobile devices without breaking the UI. Two custom viewers were built from scratch to solve this.

<details>
  <summary><b>📄 Advanced Resume PDF Viewer (Click to expand)</b></summary>
  <br/>

  **The Problem:** Mobile browsers (especially in-app WebViews like Instagram/LinkedIn) lack PDF plugins. An `<iframe src="/resume.pdf">` silently renders blank on these devices.

  **The Solution:** A client-side PDF viewer built on `pdfjs-dist` (the engine powering Firefox/Chrome).
  - **Inline Thumbnail Card:** Renders a live page 1 thumbnail to `<canvas>` with a tilt-on-hover effect.
  - **Full-Screen Modal:** Continuous scroll through all pages, lazy-rendered via `IntersectionObserver`.
  - **Gestures:**
    - Desktop: `Ctrl/Cmd + scroll` to zoom, click-and-drag to pan.
    - Mobile: Pinch-to-zoom, one-finger drag to pan, double-tap to toggle zoom.
  - **Navigation:** Prev/next buttons, jump-to-page input, `←`/`→`/`PageUp`/`PageDown`/`Esc` keyboard shortcuts.
  - **Actions:** Download, open in new tab, print, and rotate (90° increments).
  - **Dynamic Viewport:** Uses `100dvh` and `min-h-0` flexbox to prevent mobile browser chrome from clipping the UI.
  - Reused as-is inside the admin **Resume Management** page for live preview of uploaded files.
</details>

<details>
  <summary><b>🖼️ Project Image Viewer (Click to expand)</b></summary>
  <br/>

  **The Problem:** Projects like "DeepDive AI" have a dozen-plus screenshots. Standard lightboxes overflow or clip navigation arrows on mobile.

  **The Solution:** A standalone, reusable `ImageViewer` component built on native pointer/touch events.
  - **Mobile-Safe:** One-finger swipe to navigate, pinch-to-zoom, double-tap to toggle 100% ↔ 200%.
  - **Desktop-Safe:** `←`/`→` keys, `Esc` to close, `Ctrl/Cmd + scroll` zoom (up to 4×), click-and-drag to pan.
  - **Deterministic Flexbox:** Replaced unpredictable `absolute` positioning with a centered flex layout to ensure the image and arrows render perfectly every time.
  - **Smart Thumbnails:** Thumbnail strip only renders if the project has ≤ 8 images to prevent UI overflow.
</details>

<details>
  <summary><b>🛡️ OTP-Verified, Rate-Limited Contact Form (Click to expand)</b></summary>
  <br/>

  **The Problem:** A plain contact form lets anyone type a fake or mistyped email address into the "From" field, and lets bots/spammers hammer the send button with unlimited requests.

  **The Solution:** A two-step, server-verified flow with per-IP throttling.
  - **Step 1 — Request a code:** The visitor fills out the form. The server validates the email format, checks the sender's daily quota, and emails a 6-digit one-time code to the address entered (not to the site owner).
  - **Step 2 — Verify & send:** The visitor enters the code in an auto-advancing 6-digit input (with paste support). Only once the code is confirmed does the server send the actual message to the site owner's inbox — with the sender's email marked "(verified ✓)" — and store it in the admin **Messages Inbox**.
  - **Rate Limiting:** Capped at **2 successfully-sent messages per IP address per day**, tracked server-side (not client-side, so it can't be bypassed by clearing local storage). A separate, slightly more lenient cap on OTP *requests* themselves stops someone from spamming the code-send step without ever completing verification.
  - **OTP Safety:** Codes expire after 10 minutes, allow a maximum of 5 incorrect attempts before requiring a fresh code, and are single-use (deleted immediately on successful verification).
  - **UX Details:** Live email-format validation before submitting, a 45-second cooldown on "Resend code," an "Edit details" escape hatch back to the form, and clear inline error states for expired/incorrect codes or a reached rate limit.
</details>

<details>
  <summary><b>🔑 Two-Factor Authentication & Recovery Codes (Click to expand)</b></summary>
  <br/>

  **The Problem:** A password alone isn't enough to protect a control panel that can edit live site content, view visitor messages, and manage the resume file.

  **The Solution:** Standard TOTP 2FA plus a safety net for lost devices.
  - **Setup:** Generate a Base32 secret → scan the QR code (or enter the key manually) → confirm with a 6-digit code → 2FA is active, and 10 recovery codes are shown once for safekeeping.
  - **Login:** Password is verified first; if 2FA is enabled, a second screen asks for either a 6-digit TOTP code or a recovery code.
  - **Replay protection:** Each TOTP code can only be accepted once, even within its 30-second window.
  - **Recovery codes:** Stored only as SHA-256 hashes, each usable exactly once, with regeneration gated behind a valid TOTP code so a stolen session token alone can't silently disable protection.
  - **Disabling 2FA** always requires a fresh valid code — a hijacked session cookie by itself isn't enough to turn it off.
</details>

---

## 🐙 Live GitHub Section

Unlike most of the static content (which is now admin-editable rather than hardcoded), this section pulls **real, real-time data** from GitHub on every load, cached at the edge.

- **Stat Cards:** Public repos, total stars, all-time contributions, longest streak.
- **Contribution Heatmap:** Selectable year dropdown, aligned month labels, click any day to view actual commits in a modal.
- **Language Breakdown:** Byte-weighted color bar of every language used across all repositories.
- **Pinned Repos & Activity Feed:** Live stars/forks, recent push/PR/issue events.
- **Manual Refresh:** Bypasses server/edge cache to force a fresh network fetch.

---

## 🛠️ Tech Stack

| Category | Technology |
| --- | --- |
| **Framework** | Next.js 16 (App Router, Turbopack) |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS v4, `oklch()` CSS Variables — shared token system across public site & admin |
| **UI Primitives** | `@base-ui/react`, `class-variance-authority`, `lucide-react` |
| **PDF Rendering** | `pdfjs-dist` (Canvas-based, client-side) |
| **Charts** | Zero-dependency in-house SVG toolkit (sparklines, bar, donut, progress ring, stacked bar) |
| **2FA** | `qrcode.react` + custom RFC 6238 TOTP implementation |
| **Backend / API** | Next.js Route Handlers (GitHub GraphQL v4, REST v3, OTP-verified contact, full admin API surface) |
| **Auth** | HMAC-SHA256 signed sessions, edge middleware (`proxy.ts`), TOTP 2FA, SHA-256-hashed recovery codes |
| **Data Storage** | Upstash Redis (production) with local JSON file fallback (development) — dual-backend pattern used across messages, settings, content, versions, security, and 2FA |
| **File Storage** | Vercel Blob (resume + project images), with local-disk fallback in development |
| **Geolocation** | `ipapi.co` free tier for approximate session location |
| **Email** | Nodemailer (Gmail SMTP) |
| **Analytics** | Self-hosted, site-scoped tracking (no third-party analytics dependency) |
| **Deployment** | Vercel |

---

## 📂 Project Architecture

```text
portfolio-website/
├── app/
│   ├── admin/                          # Admin dashboard (all routes edge-protected)
│   │   ├── page.tsx                    # Login (password + 2FA/recovery step)
│   │   ├── layout.tsx                  # Admin shell/auth guard
│   │   ├── dashboard/                  # Aggregated overview: stats, activity, health
│   │   ├── messages/                   # Contact form inbox
│   │   ├── analytics/                  # Self-hosted site analytics
│   │   ├── resume/                     # Resume upload/preview/download tracking
│   │   ├── content/                    # Projects / Timeline / About / Skills CRUD
│   │   │   ├── content-client.tsx
│   │   │   ├── version-history-client.tsx
│   │   │   └── backup-client.tsx
│   │   ├── settings/                   # Maintenance mode, availability, social links
│   │   └── security/                   # Sessions, force logout, password, 2FA, login log
│   ├── api/
│   │   ├── admin/                      # All authenticated admin endpoints
│   │   │   ├── login/, logout/
│   │   │   ├── 2fa/, 2fa/setup/, 2fa/verify/, 2fa/recovery/
│   │   │   ├── security/, security/logout-all-except/
│   │   │   ├── messages/, messages/[id]/, messages/reply/
│   │   │   ├── analytics/, resume/, settings/
│   │   │   ├── content/, content/versions/, content/versions/[id]/
│   │   │   ├── project-images/, project-images/cleanup/
│   │   │   ├── backup/
│   │   │   └── dashboard/              # Single aggregated dashboard endpoint
│   │   ├── contact/
│   │   │   ├── send-otp/route.ts       # Step 1: validates email, checks quota, emails code
│   │   │   └── verify-otp/route.ts     # Step 2: verifies code, sends message, saves to inbox
│   │   ├── content/route.ts            # Public read of live content
│   │   ├── settings/route.ts           # Public read of live settings
│   │   ├── resume/route.ts             # Public resume metadata
│   │   ├── resume/download/route.ts    # Public download (tracks + redirects)
│   │   └── github/                     # GitHub GraphQL/REST API proxy
│   ├── globals.css                     # Theme tokens, base styles, animations
│   └── layout.tsx                      # Root layout, fonts, metadata
├── components/
│   ├── portfolio-site.tsx              # Main page assembly & sections (incl. OTP contact form UI)
│   ├── image-viewer.tsx                # ★ Custom mobile-safe image lightbox
│   ├── pdf-viewer.tsx                  # ★ Advanced pdfjs-dist viewer (shared by site + admin)
│   ├── github-section.tsx              # Live GitHub data UI
│   ├── project-image-manager.tsx       # Admin project-image drag/drop manager
│   ├── site-paused-screen.tsx          # Full-screen maintenance/pause screen
│   ├── admin/                          # Reusable admin chrome & chart toolkit
│   │   ├── dashboard-shell.tsx
│   │   ├── charts.tsx
│   │   ├── widgets.tsx
│   │   └── stat-card.tsx
│   └── ui/button.tsx                   # Shared button component
├── hooks/
│   ├── use-github-profile.ts           # Fetches /api/github
│   └── use-day-commits.ts              # Fetches day-specific commits
├── lib/
│   ├── content.ts                      # Static content fallback
│   ├── content-store.ts                # Live content CRUD (dual-backend)
│   ├── content-versioning.ts           # Version history + backup/export logic
│   ├── project-images.ts               # Project image metadata + cleanup
│   ├── github.ts                       # Server-only GitHub client
│   ├── rate-limit.ts                   # ★ In-memory IP rate limiter + OTP session store
│   ├── messages.ts                     # Contact message store (dual-backend)
│   ├── settings.ts                     # Site settings store (dual-backend)
│   ├── resume.ts                       # Resume storage + download tracking
│   ├── admin-auth.ts                   # Node-only auth logic
│   ├── admin-auth-edge.ts              # Edge-safe auth logic (Web Crypto)
│   ├── admin-2fa.ts                    # TOTP + recovery code logic
│   ├── admin-security.ts               # Sessions, force logout, login attempt log
│   ├── ip-geolocation.ts               # Session geolocation (ipapi.co, cached)
│   ├── site-analytics.ts               # Self-hosted analytics aggregation
│   ├── dashboard-aggregator.ts         # Combined dashboard data fetch
│   └── utils.ts                        # cn() classname helper
├── proxy.ts                             # Edge middleware — guards /admin/*, checks revocation
└── public/
    └── resume.pdf                       # Local-dev fallback resume
```

---

## ⚙️ Environment Variables

To run this project locally, set up the following in a `.env.local` file. See `.env.example` for the full template.

| Variable | Purpose |
| --- | --- |
| `GITHUB_TOKEN` | Fine-grained GitHub PAT (public repos + followers, read-only). |
| `GITHUB_USERNAME` | Default GitHub login if `?username=` isn't passed. |
| `EMAIL_USER` | Gmail address used to send OTP codes, receive contact-form messages, and send admin replies. |
| `EMAIL_PASS` | Gmail App Password for Nodemailer auth. |
| `ADMIN_MAIL1`, `ADMIN_PASSWORD1`, `ADMIN_MAIL2`, `ADMIN_PASSWORD2`, ... | Admin login credentials — add as many numbered pairs as you need. |
| `SESSION_SECRET` | Secret used to sign admin session tokens (HMAC-SHA256). |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Production data store for messages, settings, content, versions, security, and 2FA. Falls back to local JSON files in development if unset. |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob storage for the resume file and project images (production). Falls back to local disk in development. |

> **Note:** The PDF viewer and Image viewer work entirely client-side and need no environment variables. 2FA, recovery codes, sessions, analytics, and site settings all reuse the existing Redis/Blob configuration above — **no additional env vars** were introduced for any admin feature after the initial auth/storage setup.

> **Serverless caveat:** Every admin data store (messages, settings, content, versions, security, 2FA) follows the same dual-backend pattern: Upstash Redis in production, a local `.data/*.json` file in development. This keeps data consistent across Vercel's serverless instances without extra setup for local development.

---

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/mohitbansal25082006/Portfolio.git
cd portfolio-website
```

### 2. Install dependencies
```bash
npm install
# or
pnpm install
```

### 3. Set up environment variables
Copy the example file and fill in your details:
```bash
cp .env.example .env.local
```

### 4. Run the development server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the public site, and [http://localhost:3000/admin](http://localhost:3000/admin) to log in to the admin dashboard.

---

## 🤝 Connect With Me

<p align="center">
  <a href="https://mohitbansal-kohl.vercel.app/"><img src="https://img.shields.io/badge/Portfolio-000000?style=for-the-badge&logo=About.me&logoColor=white" alt="Portfolio"/></a>
  <a href="https://github.com/mohitbansal25082006"><img src="https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white" alt="GitHub"/></a>
  <a href="https://www.linkedin.com/in/mohit-bansal-383440315"><img src="https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white" alt="LinkedIn"/></a>
  <a href="mailto:mohitbansal2508@gmail.com"><img src="https://img.shields.io/badge/Email-D14836?style=for-the-badge&logo=gmail&logoColor=white" alt="Email"/></a>
</p>

---

<p align="center">
  Built with ❤️, ☕, and a lot of <code>100dvh</code> bug fixes by Mohit Bansal.
</p>