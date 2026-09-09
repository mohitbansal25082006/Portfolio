/**
 * app/api/settings/route.ts
 *
 * Part 2.5 — Site Settings (public)
 * Part 3.2 — Added sitePaused field to public API
 * ---------------------------------------------------------------------------
 * Unauthenticated GET so the public portfolio (portfolio-site.tsx) and the
 * root layout (maintenance-mode gate) can always read the live settings.
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
      sitePaused: settings.sitePaused,
      sitePausedTitle: settings.sitePausedTitle,
      sitePausedMessage: settings.sitePausedMessage,
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
      sitePaused: false,
      sitePausedTitle: 'Site Under Maintenance',
      sitePausedMessage: '',
      contactEmail: null,
      availabilityStatus: null,
      socialLinks: null,
    })
  }
}