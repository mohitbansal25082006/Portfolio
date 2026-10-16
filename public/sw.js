/**
 * public/sw.js — Service worker for the PUBLIC portfolio PWA (scope "/").
 * ─────────────────────────────────────────────────────────────────────────────
 * The admin dashboard is a separate PWA with its own worker (admin-sw.js,
 * scope "/admin"), which takes precedence for /admin pages because its scope
 * is more specific. This worker still explicitly ignores /admin and /api so
 * it never caches authenticated content even before the admin worker is
 * installed.
 *
 * Strategies:
 *  • Page navigations + RSC payloads → network-first (content edited in the
 *    admin dashboard shows up immediately), cached copy when offline, then
 *    /offline.html as a last resort.
 *  • /_next/static/* (content-hashed, immutable) → cache-first.
 *  • Images, fonts, PDFs and other public files → stale-while-revalidate.
 *
 * Pages are NOT precached on install, because a worker-initiated fetch of "/"
 * would be counted as a page view by proxy.ts → lib/site-analytics.ts.
 *
 * Bump VERSION to force old caches to be dropped on the next activation.
 * Only caches prefixed "site-" are touched, so admin caches are left alone.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const VERSION = 'v1'
const PREFIX = 'site-'
const PRECACHE = `${PREFIX}precache-${VERSION}`
const PAGES = `${PREFIX}pages-${VERSION}`
const STATIC = `${PREFIX}static-${VERSION}`
const ASSETS = `${PREFIX}assets-${VERSION}`

const OFFLINE_URL = '/offline.html'
const PRECACHE_URLS = [
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
]

const MAX_ENTRIES = { [PAGES]: 40, [ASSETS]: 120 }

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  const keep = new Set([PRECACHE, PAGES, STATIC, ASSETS])
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys.filter((k) => k.startsWith(PREFIX) && !keep.has(k)).map((k) => caches.delete(k)),
      )
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable()
      }
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

  const path = url.pathname
  if (path.startsWith('/admin') || path.startsWith('/api')) return
  if (path === '/sw.js' || path === '/admin-sw.js') return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(event))
    return
  }

  if (path.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, STATIC))
    return
  }

  // Client-side navigations fetch React Server Component payloads.
  if (request.headers.get('RSC') === '1' || url.searchParams.has('_rsc')) {
    event.respondWith(networkFirst(request, PAGES))
    return
  }

  if (
    path.startsWith('/_next/image') ||
    /\.(?:png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf|pdf|webmanifest|mp4|webm)$/i.test(path)
  ) {
    event.respondWith(staleWhileRevalidate(event, ASSETS))
  }
})

async function networkFirstPage(event) {
  const { request } = event
  try {
    const preload = await event.preloadResponse
    const response = preload || (await fetch(request))
    if (response.ok && response.type === 'basic') {
      const copy = response.clone()
      event.waitUntil(putAndTrim(PAGES, request, copy))
    }
    return response
  } catch {
    const cached = await caches.match(request, { ignoreSearch: true })
    if (cached) return cached
    const offline = await caches.match(OFFLINE_URL)
    return offline || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request)
    if (response.ok) await putAndTrim(cacheName, request, response.clone())
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached
    throw new Error('offline')
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) {
    const cache = await caches.open(cacheName)
    await cache.put(request, response.clone())
  }
  return response
}

async function staleWhileRevalidate(event, cacheName) {
  const { request } = event
  const cached = await caches.match(request)
  const network = fetch(request)
    .then(async (response) => {
      if (response.ok && (response.type === 'basic' || response.type === 'default')) {
        await putAndTrim(cacheName, request, response.clone())
      }
      return response
    })
    .catch(() => undefined)

  if (cached) {
    event.waitUntil(network)
    return cached
  }
  const response = await network
  return response || new Response('', { status: 504 })
}

async function putAndTrim(cacheName, request, response) {
  const cache = await caches.open(cacheName)
  await cache.put(request, response)
  const max = MAX_ENTRIES[cacheName]
  if (!max) return
  const keys = await cache.keys()
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i])
}
