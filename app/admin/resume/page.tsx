/**
 * app/admin/resume/page.tsx
 *
 * Part 2.4 — Resume Management
 * ---------------------------------------------------------------------------
 * Server component shell for /admin/resume. Follows the exact same pattern
 * as app/admin/messages/page.tsx and app/admin/analytics/page.tsx from
 * Parts 2.2/2.3: the route itself is already covered by proxy.ts (edge auth
 * guard on all /admin/* paths) plus the server-side DAL check here, then
 * renders the interactive client component.
 * ---------------------------------------------------------------------------
 */

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { ADMIN_COOKIE_NAME, verifySessionToken } from '@/lib/admin-auth'
import ResumeClient from './resume-client'

export const metadata = {
  title: 'Resume · Admin',
  robots: { index: false },
}

export default async function AdminResumePage() {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value
  const session = token ? verifySessionToken(token) : null

  if (!session) {
    redirect('/admin?redirect=/admin/resume')
  }

  return <ResumeClient adminEmail={session.email} />
}