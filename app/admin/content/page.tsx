/**
 * app/admin/content/page.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Part 2.7 — Content Management
 * Server component: verifies admin session, renders the content management UI.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ADMIN_COOKIE_NAME, verifySessionToken } from '@/lib/admin-auth'
import ContentClient from './content-client'

export const metadata = {
  title: 'Content Management — Admin',
  robots: { index: false },
}

export default async function AdminContentPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value
  const payload = token ? verifySessionToken(token) : null

  if (!payload) {
    redirect('/admin?redirect=/admin/content')
  }

  return <ContentClient adminEmail={payload.email} />
}