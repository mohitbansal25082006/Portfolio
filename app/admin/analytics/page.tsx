/**
 * app/admin/analytics/page.tsx
 * Server component — auth-protected, passes admin email to client.
 */

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySessionToken, ADMIN_COOKIE_NAME } from '@/lib/admin-auth'
import AnalyticsClient from './analytics-client'

export const metadata = {
  title: 'Analytics — Admin',
  robots: { index: false },
}

export default async function AnalyticsPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value
  const payload = token ? verifySessionToken(token) : null
  if (!payload) redirect('/admin')

  return <AnalyticsClient adminEmail={payload.email} />
}
