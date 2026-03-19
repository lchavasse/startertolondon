import { LondonEvent, EventScraper, FailedSource } from '@/lib/types'

const API_BASE = 'https://api2.luma.com'
const API_HEADERS = {
  'x-luma-client-type': 'luma-web',
  origin: 'https://luma.com',
}

interface EventObj {
  api_id: string
  name: string
  start_at: string
  end_at: string
  timezone: string
  url: string
  cover_url?: string | null
  location_type: string
  geo_address_info?: {
    city?: string
    full_address?: string
  }
}

interface CalendarObj {
  name?: string
  avatar_url?: string | null
}

async function fetchUserEvents(
  username: string,
  scrapedAt: string,
  curated: boolean
): Promise<LondonEvent[]> {
  const url = new URL(`${API_BASE}/user/profile/events`)
  url.searchParams.set('username', username)

  const res = await fetch(url.toString(), {
    headers: API_HEADERS,
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`) as Error & { statusCode: number }
    err.statusCode = res.status
    throw err
  }

  const data = await res.json()

  // Fallback organiser info from the user object
  const fallbackName: string = data.user?.name ?? username
  const fallbackAvatar: string | null = data.user?.avatar_url ?? null

  const events: LondonEvent[] = []

  for (const item of data.events_hosting ?? []) {
    // Handle both wrapped {event, calendar} and flat event object shapes
    const event: EventObj = item.event ?? item
    const calendar: CalendarObj = item.calendar ?? {}

    if (
      !event.api_id ||
      event.location_type !== 'offline' ||
      event.geo_address_info?.city !== 'London'
    )
      continue

    events.push({
      id: event.api_id,
      name: event.name,
      startAt: event.start_at,
      endAt: event.end_at,
      timezone: event.timezone,
      url: `https://lu.ma/${event.url}`,
      coverUrl: event.cover_url ?? null,
      locationName: event.geo_address_info?.full_address ?? '',
      city: 'London',
      organiserName: calendar.name ?? fallbackName,
      organiserAvatarUrl: calendar.avatar_url ?? fallbackAvatar,
      tags: calendar.name ? [calendar.name] : [],
      source: 'luma-profile',
      calendarSlug: username,
      scrapedAt,
      curated,
    })
  }

  return events
}

export class LumaUserScraper implements EventScraper {
  name = 'luma-user'
  _failed: FailedSource[] = []

  constructor(private sources: string[], private curated: boolean = false) {}

  async run(): Promise<LondonEvent[]> {
    const scrapedAt = new Date().toISOString()
    const failed: FailedSource[] = []

    const results = await Promise.allSettled(
      this.sources.map((u) => fetchUserEvents(u, scrapedAt, this.curated))
    )

    const events: LondonEvent[] = []
    for (const [i, result] of results.entries()) {
      if (result.status === 'fulfilled') {
        events.push(...result.value)
      } else {
        const err = result.reason
        const statusCode = (err as { statusCode?: number }).statusCode
        const isRateLimit = statusCode === 429
        const statusNote = statusCode === 404 ? `${statusCode} (may be rate limit)` : statusCode ?? 'err'
        console.warn(`[luma-user] Failed for ${this.sources[i]} (${statusNote}):`, err)
        failed.push({
          slug: this.sources[i],
          error: err instanceof Error ? err.message : String(err),
          statusCode,
          isRateLimit,
          timestamp: scrapedAt,
        })
      }
    }

    this._failed = failed
    return events
  }
}
