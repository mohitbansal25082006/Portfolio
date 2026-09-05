/**
 * app/admin/messages/page.tsx
 * Server component — protected, passes admin email to client shell.
 */

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySessionToken, ADMIN_COOKIE_NAME } from '@/lib/admin-auth'
import MessagesClient from './messages-client'

export const metadata = {
  title: 'Messages — Admin',
  robots: { index: false },
}

export default async function MessagesPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value
  const payload = token ? verifySessionToken(token) : null
  if (!payload) redirect('/admin')

  return <MessagesClient adminEmail={payload.email} />
}
