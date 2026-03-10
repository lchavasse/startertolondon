import { LondonEvent, EventScraper } from '@/lib/types'

const DISCOVERY_URL = 'https://api.lu.ma/discover/get-paginated-events'
const LONDON_PLACE_ID = 'discplace-QCcNk3HXowOR97j'

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

interface LumaResponse {
  entries: LumaEntry[]
  has_more: boolean
  next_cursor: string | null
}

export class LumaDiscoveryScraper implements EventScraper {
  name = 'luma-discovery'

  async run(): Promise<LondonEvent[]> {
    const events: LondonEvent[] = []
    let cursor: string | null = null
    const scrapedAt = new Date().toISOString()

    while (true) {
      const url = new URL(DISCOVERY_URL)
      url.searchParams.set('discover_place_api_id', LONDON_PLACE_ID)
      url.searchParams.set('pagination_limit', '50')
      if (cursor) url.searchParams.set('pagination_cursor', cursor)

      const res = await fetch(url.toString(), {
        headers: {
          'x-luma-client-type': 'luma-web',
          origin: 'https://luma.com',
        },
      })

      if (!res.ok) {
        throw new Error(`Luma API error: ${res.status} ${res.statusText}`)
      }

      const data: LumaResponse = await res.json()

      for (const entry of data.entries) {
        const { event, calendar } = entry
        if (
          event.location_type !== 'offline' ||
          event.geo_address_info?.city !== 'London'
        ) {
          continue
        }

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
          organiserName: calendar?.name ?? '',
          organiserAvatarUrl: calendar?.avatar_url ?? null,
          tags: calendar?.name ? [calendar.name] : [],
          source: 'luma-discovery',
          scrapedAt,
          curated: false,
        })
      }

      if (!data.has_more || !data.next_cursor) break
      cursor = data.next_cursor
    }

    return events
  }
}
