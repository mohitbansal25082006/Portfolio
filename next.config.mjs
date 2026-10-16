/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow all common local network IPs for development
  allowedDevOrigins: [
    '192.168.0.109',  // Existing IP
    '172.20.10.2',    // Current hotspot IP
    'localhost',
    '127.0.0.1',
  ],

  typescript: {
    ignoreBuildErrors: true,
  },

  images: {
    unoptimized: true,
  },

  // PWA — service workers and manifests must always be revalidated so
  // updates roll out on the next visit instead of being stuck in HTTP cache.
  async headers() {
    const noCache = { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }
    return [
      {
        source: '/:sw(sw|admin-sw).js',
        headers: [noCache, { key: 'Content-Type', value: 'application/javascript; charset=utf-8' }],
      },
      {
        source: '/:manifest(manifest|admin).webmanifest',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'Content-Type', value: 'application/manifest+json' },
        ],
      },
      { source: '/offline.html', headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }] },
    ]
  },
};

export default nextConfig;