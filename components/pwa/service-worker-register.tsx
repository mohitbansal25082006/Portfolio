'use client'

/**
 * Registers the right service worker for the current app:
 *  • /admin/*  → /admin-sw.js, scope "/admin" (admin dashboard PWA)
 *  • elsewhere → /sw.js,       scope "/"      (public portfolio PWA)
 *
 * The two are installed as separate PWAs (see public/manifest.webmanifest and
 * public/admin.webmanifest). Production only, since a worker caching
 * /_next/static would fight with dev-server HMR.
 */

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export function ServiceWorkerRegister() {
  const isAdmin = usePathname()?.startsWith('/admin') ?? false

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return

    const [url, scope] = isAdmin ? ['/admin-sw.js', '/admin'] : ['/sw.js', '/']
    navigator.serviceWorker
      .register(url, { scope, updateViaCache: 'none' })
      .catch((err) => console.warn('[pwa] service worker registration failed:', err))
  }, [isAdmin])

  return null
}
