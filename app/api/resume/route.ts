/**
 * app/api/resume/route.ts
 *
 * Part 2.4 — Resume Management
 * ---------------------------------------------------------------------------
 * PUBLIC, unauthenticated GET endpoint used by the live portfolio
 * (components/portfolio-site.tsx) to fetch the *current* resume's direct
 * URL + filename, so:
 *   - The inline PdfViewer (pdf-viewer.tsx) can render the real PDF bytes
 *     via pdfjs-dist (it needs the actual file URL, not a redirect chain).
 *   - "View in browser" links open the current file directly.
 *
 * Deliberately separate from GET /api/admin/resume (which is auth-guarded
 * and also returns downloadCount + storage status — admin-only details that
 * have no business being exposed publicly).
 * ---------------------------------------------------------------------------
 */

import { NextResponse } from 'next/server'
import { getResumeMeta } from '@/lib/resume'

export async function GET() {
  try {
    const meta = await getResumeMeta()
    return NextResponse.json({ url: meta.url, fileName: meta.fileName })
  } catch (err) {
    console.error('GET /api/resume failed:', err)
    // Fall back to the static bundled file so the public site never breaks.
    return NextResponse.json({ url: '/resume.pdf', fileName: 'resume.pdf' })
  }
}