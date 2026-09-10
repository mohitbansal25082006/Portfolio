/**
 * app/admin/dashboard/page.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin Dashboard — /admin/dashboard  (Server Component, protected)
 *
 * Part 3.2 (Dashboard upgrade) — server page unchanged in shape; still does
 * the DAL-layer session check and hands the admin email to the client.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySessionToken, ADMIN_COOKIE_NAME } from '@/lib/admin-auth'
import AdminDashboardClient from './dashboard-client'

export default async function AdminDashboardPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value

  const payload = token ? verifySessionToken(token) : null
  if (!payload) {
    redirect('/admin')
  }

  return <AdminDashboardClient adminEmail={payload.email} />
}