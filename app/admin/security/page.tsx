/**
 * app/admin/security/page.tsx
 *
 * Part 2.6 — Security & Session
 * Server component: reads + verifies the session cookie (with revocation
 * check) to get the current admin's email, same pattern as every other
 * protected admin page, then hands off to the client component.
 */

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ADMIN_COOKIE_NAME, verifySessionTokenWithRevocation } from '@/lib/admin-auth'
import SecurityClient from './security-client'

export const metadata = {
  title: 'Security & Session — Admin',
  robots: { index: false, follow: false },
}

export default async function SecurityPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value
  const session = token ? await verifySessionTokenWithRevocation(token) : null

  if (!session) {
    redirect('/admin?redirect=/admin/security')
  }

  return <SecurityClient adminEmail={session.email} />
}