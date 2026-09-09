/**
 * app/api/admin/settings/route.ts
 *
 * Part 2.5 — Site Settings (admin-only)
 * Part 3.2 — Added sitePaused validation
 * ---------------------------------------------------------------------------
 * GET  -> returns current settings + storage status.
 * PUT  -> accepts a partial patch and saves it via lib/settings.ts.
 * ---------------------------------------------------------------------------
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ADMIN_COOKIE_NAME, verifySessionToken } from '@/lib/admin-auth'
import {
  getSettings,
  updateSettings,
  getSettingsStorageStatus,
  type SiteSettings,
} from '@/lib/settings'

async function requireAuth() {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value
  if (!token) return false
  const payload = verifySessionToken(token)
  return !!payload
}

export async function GET() {
  const authed = await requireAuth()
  if (!authed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [settings, storage] = await Promise.all([
    getSettings(),
    Promise.resolve(getSettingsStorageStatus()),
  ])

  return NextResponse.json({ settings, storage })
}

export async function PUT(req: NextRequest) {
  const authed = await requireAuth()
  if (!authed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Partial<Omit<SiteSettings, 'updatedAt'>>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // ── Basic validation ──────────────────────────────────────────────────
  if (body.contactEmail !== undefined) {
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/
    if (typeof body.contactEmail !== 'string' || !emailRegex.test(body.contactEmail.trim())) {
      return NextResponse.json({ error: 'Please provide a valid contact email.' }, { status: 400 })
    }
  }

  if (body.availabilityStatus !== undefined) {
    if (typeof body.availabilityStatus !== 'string' || body.availabilityStatus.trim().length === 0) {
      return NextResponse.json({ error: 'Availability status cannot be empty.' }, { status: 400 })
    }
    if (body.availabilityStatus.length > 80) {
      return NextResponse.json({ error: 'Availability status is too long (max 80 characters).' }, { status: 400 })
    }
  }

  if (body.maintenanceMessage !== undefined && body.maintenanceMessage.length > 300) {
    return NextResponse.json({ error: 'Maintenance message is too long (max 300 characters).' }, { status: 400 })
  }

  // Part 3.2 — Site pause validation
  if (body.sitePausedTitle !== undefined && body.sitePausedTitle.length > 100) {
    return NextResponse.json({ error: 'Site pause title is too long (max 100 characters).' }, { status: 400 })
  }

  if (body.sitePausedMessage !== undefined && body.sitePausedMessage.length > 500) {
    return NextResponse.json({ error: 'Site pause message is too long (max 500 characters).' }, { status: 400 })
  }

  if (body.socialLinks !== undefined) {
    const urlFields = ['github', 'linkedin', 'twitter', 'leetcode'] as const
    for (const field of urlFields) {
      const val = body.socialLinks[field]
      if (val && typeof val === 'string' && val.trim().length > 0) {
        try {
          // Must be a well-formed absolute URL.
          new URL(val)
        } catch {
          return NextResponse.json({ error: `The ${field} link isn't a valid URL.` }, { status: 400 })
        }
      }
    }
    // Email social link is stored as a mailto: link, so validate loosely.
    if (body.socialLinks.email && !body.socialLinks.email.startsWith('mailto:')) {
      body.socialLinks.email = `mailto:${body.socialLinks.email}`
    }
  }

  try {
    const updated = await updateSettings(body)
    return NextResponse.json({ settings: updated })
  } catch (err) {
    console.error('Failed to update settings:', err)
    return NextResponse.json({ error: 'Failed to save settings. Please try again.' }, { status: 500 })
  }
}