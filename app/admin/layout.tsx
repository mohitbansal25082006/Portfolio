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
import { InstallAppButton } from '@/components/pwa/install-app-button'

export const metadata: Metadata = {
  title: 'Admin — Mohit Bansal Portfolio',
  description: 'Protected admin dashboard.',
  robots: { index: false, follow: false },
  // Separate installable PWA (scope /admin) with its own badge-marked icons.
  applicationName: 'MB Admin',
  manifest: '/admin.webmanifest',
  appleWebApp: { capable: true, title: 'MB Admin', statusBarStyle: 'black' },
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
  return (
    <div className="admin-viewport-height overflow-hidden">
      {/* Capture the install prompt before hydration — see InstallAppButton. */}
      <script
        dangerouslySetInnerHTML={{
          __html:
            "window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__pwaInstallPrompt=e});",
        }}
      />
      {children}
      <InstallAppButton />
    </div>
  )
}