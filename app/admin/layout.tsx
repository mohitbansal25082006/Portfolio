/**
 * app/admin/layout.tsx
 *
 * Thin wrapper for the /admin section.
 * - NO hardcoded data-theme here — each admin page applies the theme itself
 *   via a client-side localStorage hook so the user's chosen theme persists.
 * - Prevents search-engine indexing for all admin routes.
 * - Added viewport meta for mobile compatibility.
 */

import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'Admin — Mohit Bansal Portfolio',
  description: 'Protected admin dashboard.',
  robots: { index: false, follow: false },
}

// Mobile viewport configuration for proper rendering on all devices
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // Let each admin page apply its own data-theme from localStorage.
  // We only guarantee the minimum required classes here.
  return <div className="admin-viewport-height overflow-hidden">{children}</div>
}