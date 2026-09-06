/**
 * app/api/resume/download/route.ts
 *
 * Part 2.4 — Resume Management
 * ---------------------------------------------------------------------------
 * PUBLIC route (no admin auth — this is hit by visitors clicking "Download
 * Resume" on the live portfolio). Increments the download counter, then
 * redirects (307) to the actual current resume URL (Blob URL in prod,
 * /resume.pdf locally).
 *
 * Why a redirect instead of streaming the file through this route?
 *   - Vercel Blob URLs are already public + CDN-backed; proxying the bytes
 *     through a serverless function would add latency and function
 *     execution time for zero benefit.
 *   - `download` on the <a> tag on the client still triggers a native
 *     "Save As" instead of a navigation, since the redirect target itself
 *     doesn't set Content-Disposition — see the `?download=1` handling
 *     below, which Vercel Blob honors for `put()`'d objects when the
 *     request includes it, prompting a save dialog rather than an inline
 *     view. Local dev's /resume.pdf doesn't support this param, but
 *     Next.js's static file serving still allows `download` on the <a>
 *     itself to work fine there.
 *
 * The increment happens fire-and-forget-safe: if the metadata store hiccups,
 * we still redirect the visitor to their file rather than blocking or
 * erroring their download over an analytics counter.
 * ---------------------------------------------------------------------------
 */

import { NextResponse } from 'next/server'
import { getResumeMeta, incrementDownloadCount } from '@/lib/resume'

export async function GET() {
  let meta
  try {
    meta = await getResumeMeta()
  } catch (err) {
    console.error('Failed to load resume meta for download redirect:', err)
    // Last-resort fallback so a storage hiccup never breaks the download
    // link entirely — fall back to the static file shipped in /public.
    return NextResponse.redirect(new URL('/resume.pdf', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'))
  }

  // Best-effort — never let a counter failure block the actual download.
  incrementDownloadCount().catch((err) => {
    console.error('Failed to increment resume download count (non-blocking):', err)
  })

  // Vercel Blob respects a `download` query param on its public URLs to
  // force Content-Disposition: attachment with the original filename.
  const target = meta.url.includes('blob.vercel-storage.com')
    ? `${meta.url}${meta.url.includes('?') ? '&' : '?'}download=${encodeURIComponent(meta.fileName)}`
    : meta.url

  return NextResponse.redirect(target, { status: 307 })
}