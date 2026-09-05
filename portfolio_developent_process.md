# Portfolio Website — Development Process (Part 1)

## Overview
Part 1 covers the initial build of the portfolio site: project scaffolding, the main single-page layout, the live GitHub integration, the custom PDF and image viewers, and the OTP-verified contact form.

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

---

## Summary
Part 1 established the full working foundation of the portfolio: a themeable, animated single-page site with a real backend layer (GitHub API proxy + OTP contact form), and two hand-built media viewers (PDF and image) engineered specifically to work reliably on mobile. By the end of Part 1, the site was live and functional at mohitbansal.online with all core sections in place.



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

## Bugs Fixed

| # | Bug | Fix |
|---|---|---|
| 1 | `middleware.ts` deprecated in Next.js 16 | Renamed to `proxy.ts`, function renamed from `middleware` to `proxy` |
| 2 | Node `crypto` imported in Edge Runtime | Split into `lib/admin-auth-edge.ts` (Web Crypto only) for proxy, `lib/admin-auth.ts` (Node crypto) for server routes |
| 3 | `proxy.ts` exported `middleware` not `proxy` | Renamed exported function to `proxy` |
| 4 | Input text invisible on dark themes | Replaced `var(--primary-foreground)` with `var(--foreground)` in input styles |
| 5 | Sidebar overflowing viewport height | Root wrapper set to `h-screen overflow-hidden`; nav and main body scroll independently |
| 6 | `Shield` placeholder icon in header | Replaced with `<img src="/icon.ico">` (actual site favicon) |
| 7 | Hardcoded `data-theme="midnight"` in layout | Removed; theme now applied per-page via localStorage hook |
