import { LondonEvent, EventScraper } from '@/lib/types'
import { ChannelCacheEntry } from '@/lib/kv'
import { CHANNEL_SOURCES } from './sources'

const DISCOVERY_URL = 'https://api.lu.ma/discover/get-paginated-events'
const API_BASE = 'https://api2.luma.com'
const API_HEADERS = {
  'x-luma-client-type': 'luma-web',
  origin: 'https://luma.com',
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

  constructor(private channelCache: Record<string, ChannelCacheEntry> = {}) {}

  async run(): Promise<LondonEvent[]> {
    const scrapedAt = new Date().toISOString()
    const events: LondonEvent[] = []

    // All channel IDs are pre-resolved by the orchestrator's pre-flight pass
    await Promise.all(
      CHANNEL_SOURCES.map(async (slug) => {
        const channel = this.channelCache[slug]
        if (!channel) {
          console.warn(`[luma-channel] No cached id for channel: ${slug} (will retry next run)`)
          return
        }

        try {
          let entries: LumaEntry[]
          let source: LondonEvent['source']

          if (channel.type === 'discovery') {
            entries = await fetchDiscoveryEntries(channel.id)
            source = 'luma-discovery'
          } else {
            entries = await fetchCalendarEntries(channel.id)
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
