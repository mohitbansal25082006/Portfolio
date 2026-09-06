/**
 * app/admin/settings/page.tsx
 *
 * Part 2.5 — Site Settings admin page.
 * Server component: verifies the admin session (redirects to /admin if not
 * authenticated, same double-layer auth as every other /admin/* page —
 * proxy.ts guards the route at the edge, this is the server-component DAL
 * check underneath it), then renders the client UI.
 */

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { ADMIN_COOKIE_NAME, verifySessionToken } from '@/lib/admin-auth'
import SettingsClient from './settings-client'

export const metadata = {
  robots: { index: false },
}

export default async function AdminSettingsPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value
  const payload = token ? verifySessionToken(token) : null

  if (!payload) {
    redirect('/admin?redirect=/admin/settings')
  }

  return <SettingsClient />
}