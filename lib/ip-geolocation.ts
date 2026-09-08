/**
 * lib/ip-geolocation.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Part 2.9 — IP Geolocation for Sessions Panel
 * ---------------------------------------------------------------------------
 * Provides approximate city-level geolocation for IP addresses displayed
 * in the Active Sessions panel. Uses a free, no-API-key geolocation service
 * with caching to avoid rate limits.
 *
 * Approach:
 *   - Uses ipapi.co (free tier: 1000 requests/day, no API key required)
 *   - Falls back gracefully if service is unavailable
 *   - Caches results in memory to avoid repeated lookups
 *   - Only shows approximate city (not exact location)
 *
 * Privacy:
 *   - Only the city and country are displayed, never exact coordinates
 *   - Results cached server-side only
 *   - No external service called for private/loopback IPs
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Types ────────────────────────────────────────────────────────────────

export interface GeoLocationInfo {
  /** Approximate city name (e.g., "San Francisco") */
  city: string
  /** Country name (e.g., "United States") */
  country: string
  /** Country code (e.g., "US") */
  countryCode: string
  /** ISO timestamp of when this lookup was performed */
  cachedAt: string
}

// ─── In-memory cache ──────────────────────────────────────────────────────

const geoCache = new Map<string, GeoLocationInfo | null>()
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours
const MAX_CACHE_SIZE = 500 // Prevent unbounded growth

// ─── Private IP detection ─────────────────────────────────────────────────

function isPrivateIp(ip: string): boolean {
  // Check for localhost
  if (ip === '::1' || ip === '127.0.0.1' || ip === 'localhost' || ip === 'unknown') {
    return true
  }

  // Check for private IPv4 ranges
  const parts = ip.split('.').map(Number)
  if (parts.length === 4) {
    // 10.0.0.0/8
    if (parts[0] === 10) return true
    // 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true
    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true
    // 169.254.0.0/16 (link-local)
    if (parts[0] === 169 && parts[1] === 254) return true
  }

  // Check for IPv6 loopback/private
  if (ip.includes('::')) return true
  if (ip.toLowerCase().startsWith('fe80:')) return true
  if (ip.toLowerCase().startsWith('fc') || ip.toLowerCase().startsWith('fd')) return true

  return false
}

// ─── Cache management ─────────────────────────────────────────────────────

function getCachedGeo(ip: string): GeoLocationInfo | null | undefined {
  const cached = geoCache.get(ip)
  if (!cached) return undefined
  if (cached === null) return null // Negative cache (lookup failed)
  
  // Check if cache is still valid
  const cachedTime = new Date(cached.cachedAt).getTime()
  if (Date.now() - cachedTime > CACHE_TTL_MS) {
    geoCache.delete(ip)
    return undefined
  }
  
  return cached
}

function setCachedGeo(ip: string, geo: GeoLocationInfo | null): void {
  // Evict oldest entry if cache is full
  if (geoCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = geoCache.keys().next().value
    if (oldestKey !== undefined) {
      geoCache.delete(oldestKey)
    }
  }
  geoCache.set(ip, geo)
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Gets approximate city-level geolocation for an IP address.
 * Returns null if the IP is private/loopback or if the lookup fails.
 * Results are cached in memory for 24 hours.
 */
export async function getGeoLocation(ip: string): Promise<GeoLocationInfo | null> {
  // Return null for private/loopback IPs (no point looking them up)
  if (isPrivateIp(ip)) {
    return null
  }

  // Check cache first
  const cached = getCachedGeo(ip)
  if (cached !== undefined) {
    return cached
  }

  try {
    // Use ipapi.co free tier (no API key required, 1000 req/day)
    const response = await fetch(`https://ipapi.co/${ip}/json/`, {
      signal: AbortSignal.timeout(5000), // 5 second timeout
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Portfolio-Admin/2.9',
      },
    })

    if (!response.ok) {
      setCachedGeo(ip, null)
      return null
    }

    const data = await response.json()
    
    // Check if we got valid data
    if (data.error || !data.city) {
      setCachedGeo(ip, null)
      return null
    }

    const geo: GeoLocationInfo = {
      city: data.city || 'Unknown',
      country: data.country_name || 'Unknown',
      countryCode: data.country_code || 'XX',
      cachedAt: new Date().toISOString(),
    }

    setCachedGeo(ip, geo)
    return geo
  } catch {
    // Network error, timeout, or service unavailable
    setCachedGeo(ip, null)
    return null
  }
}

/**
 * Formats geolocation info for display in the sessions panel.
 * Returns empty string if no geolocation data is available.
 */
export function formatGeoLocation(geo: GeoLocationInfo | null): string {
  if (!geo) return ''
  
  const parts: string[] = []
  if (geo.city && geo.city !== 'Unknown') {
    parts.push(geo.city)
  }
  if (geo.country && geo.country !== 'Unknown') {
    parts.push(geo.country)
  }
  
  return parts.join(', ')
}

/**
 * Batch lookup for multiple IPs — used by the security API route.
 * Returns a map of IP → formatted location string.
 */
export async function batchGetGeoLocations(ips: string[]): Promise<Record<string, string>> {
  const uniqueIps = [...new Set(ips.filter(ip => !isPrivateIp(ip)))]
  const results: Record<string, string> = {}

  // Process in parallel with concurrency limit (avoid rate limiting)
  const CONCURRENCY_LIMIT = 5
  const batches: string[][] = []
  
  for (let i = 0; i < uniqueIps.length; i += CONCURRENCY_LIMIT) {
    batches.push(uniqueIps.slice(i, i + CONCURRENCY_LIMIT))
  }

  for (const batch of batches) {
    const batchResults = await Promise.all(
      batch.map(async (ip) => {
        const geo = await getGeoLocation(ip)
        return { ip, location: formatGeoLocation(geo) }
      })
    )

    for (const { ip, location } of batchResults) {
      if (location) {
        results[ip] = location
      }
    }
  }

  return results
}