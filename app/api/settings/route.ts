/**
 * app/api/settings/route.ts
 *
 * Part 2.5 — Site Settings (public)
 * ---------------------------------------------------------------------------
 * Unauthenticated GET so the public portfolio (portfolio-site.tsx) and the
 * root layout (maintenance-mode gate) can always read the live settings —
 * mirrors the public GET /api/resume pattern from Part 2.4.
 *
 * Only exposes the fields the public site actually needs; deliberately does
 * NOT return internal fields that might be added later (nothing sensitive
 * currently, but keeping this route intentionally minimal/explicit).
 * ---------------------------------------------------------------------------
 */

import { NextResponse } from 'next/server'
import { getSettings } from '@/lib/settings'

export async function GET() {
  try {
    const settings = await getSettings()
    return NextResponse.json({
      maintenanceMode: settings.maintenanceMode,
      maintenanceMessage: settings.maintenanceMessage,
      contactEmail: settings.contactEmail,
      availabilityStatus: settings.availabilityStatus,
      socialLinks: settings.socialLinks,
    })
  } catch (err) {
    console.error('Failed to load public settings:', err)
    // Fail open with safe, empty-ish defaults rather than breaking the
    // public site if the settings store is briefly unreachable.
    return NextResponse.json({
      maintenanceMode: false,
      maintenanceMessage: '',
      contactEmail: null,
      availabilityStatus: null,
      socialLinks: null,
    })
  }
}