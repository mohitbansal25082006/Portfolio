/**
 * public/admin-sw.js — Service worker for the ADMIN dashboard PWA
 * (scope "/admin"), installed separately from the public portfolio PWA.
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin pages and /api responses are session-protected and always live, so
 * they are NEVER cached; the network is always used. The only things cached
 * are:
 *  • /_next/static/* (content-hashed, immutable) → cache-first, so the app
 *    shell boots quickly.
 *  • The admin icons + manifest + /offline.html, shown when a navigation
 *    fails because the device is offline.
 *
 * Only caches prefixed "admin-" are touched, so the public site's caches are
 * left alone.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const VERSION = 'v1'
const PREFIX = 'admin-'
const PRECACHE = `${PREFIX}precache-${VERSION}`
const STATIC = `${PREFIX}static-${VERSION}`

const OFFLINE_URL = '/offline.html'
const PRECACHE_URLS = [
  OFFLINE_URL,
  '/admin.webmanifest',
  '/icons/admin-icon-192.png',
  '/icons/admin-icon-512.png',
  '/icons/admin-apple-touch-icon.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  const keep = new Set([PRECACHE, STATIC])
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys.filter((k) => k.startsWith(PREFIX) && !keep.has(k)).map((k) => caches.delete(k)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const offline = await caches.match(OFFLINE_URL)
        return offline || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
      }),
    )
    return
  }

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then(async (response) => {
            if (response.ok) {
              const cache = await caches.open(STATIC)
              await cache.put(request, response.clone())
            }
            return response
          }),
      ),
    )
    return
  }

  if (url.pathname.startsWith('/icons/admin-')) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request)))
  }
})
