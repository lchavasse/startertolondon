import { LondonEvent, EventScraper } from '@/lib/types'
import { CHANNEL_SOURCES } from './sources'

const DISCOVERY_URL = 'https://api.lu.ma/discover/get-paginated-events'
const API_BASE = 'https://api2.luma.com'
const API_HEADERS = {
  'x-luma-client-type': 'luma-web',
  origin: 'https://luma.com',
}
const PAGE_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

interface LumaEntry {
  event: {
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
  calendar?: {
    name?: string
    avatar_url?: string | null
  }
}

type ChannelId =
  | { type: 'discovery'; placeId: string }
  | { type: 'calendar'; calId: string }
  | null

async function identifyChannel(slug: string): Promise<ChannelId> {
  try {
    const res = await fetch(`https://luma.com/${slug}`, {
      headers: PAGE_HEADERS,
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const html = await res.text()
    const dataMatch = html.match(
      /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/
    )
    if (!dataMatch) return null
    const json = dataMatch[1]

    const placeMatch = json.match(/"api_id"\s*:\s*"(discplace-[A-Za-z0-9]+)"/)
    if (placeMatch) return { type: 'discovery', placeId: placeMatch[1] }

    const calMatch = json.match(/"api_id"\s*:\s*"(cal-[A-Za-z0-9]+)"/)
    if (calMatch) return { type: 'calendar', calId: calMatch[1] }

    return null
  } catch {
    return null
  }
}

async function fetchDiscoveryEntries(placeId: string): Promise<LumaEntry[]> {
  const entries: LumaEntry[] = []
  let cursor: string | null = null

  while (true) {
    const url = new URL(DISCOVERY_URL)
    url.searchParams.set('discover_place_api_id', placeId)
    url.searchParams.set('pagination_limit', '50')
    if (cursor) url.searchParams.set('pagination_cursor', cursor)

    const res = await fetch(url.toString(), {
      headers: API_HEADERS,
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) break

    const data = await res.json()
    entries.push(...(data.entries ?? []))
    if (!data.has_more || !data.next_cursor) break
    cursor = data.next_cursor
  }

  return entries
}

async function fetchCalendarEntries(calId: string): Promise<LumaEntry[]> {
  const entries: LumaEntry[] = []
  let cursor: string | null = null

  while (true) {
    const url = new URL(`${API_BASE}/calendar/get-items`)
    url.searchParams.set('calendar_api_id', calId)
    url.searchParams.set('pagination_limit', '50')
    url.searchParams.set('period', 'upcoming')
    if (cursor) url.searchParams.set('pagination_cursor', cursor)

    const res = await fetch(url.toString(), {
      headers: API_HEADERS,
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) break

    const data = await res.json()
    entries.push(...(data.entries ?? []))
    if (!data.has_more || !data.next_cursor) break
    cursor = data.next_cursor
  }

  return entries
}

function mapEntry(
  entry: LumaEntry,
  source: LondonEvent['source'],
  scrapedAt: string
): LondonEvent | null {
  const { event, calendar } = entry
  if (
    event.location_type !== 'offline' ||
    event.geo_address_info?.city !== 'London'
  )
    return null

  return {
    id: event.api_id,
    name: event.name,
    startAt: event.start_at,
    endAt: event.end_at,
    timezone: event.timezone,
    url: `https://lu.ma/${event.url}`,
    coverUrl: event.cover_url ?? null,
    locationName: event.geo_address_info?.full_address ?? '',
    city: 'London',
    organiserName: calendar?.name ?? '',
    organiserAvatarUrl: calendar?.avatar_url ?? null,
    tags: calendar?.name ? [calendar.name] : [],
    source,
    scrapedAt,
    curated: false,
  }
}

export class LumaChannelScraper implements EventScraper {
  name = 'luma-channel'

  async run(): Promise<LondonEvent[]> {
    const scrapedAt = new Date().toISOString()
    const events: LondonEvent[] = []

    await Promise.all(
      CHANNEL_SOURCES.map(async (slug) => {
        const channel = await identifyChannel(slug)
        if (!channel) {
          console.warn(`[luma-channel] Could not identify channel: ${slug}`)
          return
        }

        try {
          let entries: LumaEntry[]
          let source: LondonEvent['source']

          if (channel.type === 'discovery') {
            entries = await fetchDiscoveryEntries(channel.placeId)
            source = 'luma-discovery'
          } else {
            entries = await fetchCalendarEntries(channel.calId)
            source = 'luma-calendar'
          }

          for (const entry of entries) {
            const event = mapEntry(entry, source, scrapedAt)
            if (event) events.push(event)
          }
        } catch (err) {
          console.warn(`[luma-channel] Failed fetching ${slug}:`, err)
        }
      })
    )

    return events
  }
}
