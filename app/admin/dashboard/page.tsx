/**
 * app/admin/dashboard/page.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin Dashboard — /admin/dashboard  (Server Component, protected by middleware)
 *
 * Part 2.1 ships the authenticated shell:
 *  • Reads & decodes the session cookie server-side (second layer of auth)
 *  • Shows the logged-in admin email
 *  • Logout button (client action)
 *  • Placeholder stat cards ready for Part 2.2+ features
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySessionToken, ADMIN_COOKIE_NAME } from '@/lib/admin-auth'
import AdminDashboardClient from './dashboard-client'

export default async function AdminDashboardPage() {
  // ── Server-side double-check (middleware already checked, this is the DAL layer) ──
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value

  const payload = token ? verifySessionToken(token) : null
  if (!payload) {
    redirect('/admin')
  }

  return <AdminDashboardClient adminEmail={payload.email} />
}
