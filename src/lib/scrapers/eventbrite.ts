import { LondonEvent, EventScraper } from '@/lib/types'

const LONDON_PLACE_ID = '101750367'
const SEARCH_URL = 'https://www.eventbrite.co.uk/api/v3/destination/search/'
const PAGE_SIZE = 50

interface EBAddress {
  city?: string
  localized_address_display?: string
}

interface EBVenue {
  name?: string
  address?: EBAddress
}

interface EBOrganizer {
  name?: string
  logo?: { url?: string } | null
}

interface EBImage {
  url?: string
}

interface EBEvent {
  id?: string
  eid?: string
  name?: string
  url?: string
  timezone?: string
  start_date?: string
  start_time?: string
  end_date?: string
  end_time?: string
  is_online_event?: boolean
  image?: EBImage | null
  primary_venue?: EBVenue | null
  primary_organizer?: EBOrganizer | null
  tags?: Array<{ prefix?: string; display_name?: string }>
}

interface SearchResponse {
  events?: {
    results?: EBEvent[]
    pagination?: {
      object_count?: number
      continuation?: string | null
    }
  }
}

async function fetchCsrfToken(): Promise<{
  csrf: string
  cookieHeader: string
}> {
  const res = await fetch(
    'https://www.eventbrite.co.uk/d/united-kingdom--london/tech-events/',
    {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(15000),
    }
  )

  if (!res.ok) throw new Error(`Eventbrite page fetch failed: ${res.status}`)

  // Collect Set-Cookie headers
  const rawCookies = res.headers.getSetCookie?.() ?? []
  const cookieMap: Record<string, string> = {}
  for (const raw of rawCookies) {
    const [pair] = raw.split(';')
    const [name, value] = pair.split('=')
    if (name && value !== undefined) cookieMap[name.trim()] = value.trim()
  }

  const csrf = cookieMap['csrftoken']
  if (!csrf) throw new Error('Could not find Eventbrite CSRF token')

  const cookieHeader = Object.entries(cookieMap)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')

  return { csrf, cookieHeader }
}

async function searchEvents(
  csrf: string,
  cookieHeader: string,
  continuation: string | null = null
): Promise<SearchResponse> {
  const body: Record<string, unknown> = {
    event_search: {
      q: 'tech events',
      places: [LONDON_PLACE_ID],
      dates: 'current_future',
      dedup: true,
      online_events_only: false,
      tags: ['EventbriteCategory/102'],
      page_size: PAGE_SIZE,
      ...(continuation ? { continuation } : { page: 1 }),
    },
    'expand.destination_event': [
      'primary_venue',
      'image',
      'primary_organizer',
      'ticket_availability',
    ],
  }

  const res = await fetch(SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrf,
      Cookie: cookieHeader,
      Referer:
        'https://www.eventbrite.co.uk/d/united-kingdom--london/tech-events/',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) throw new Error(`Eventbrite search failed: ${res.status}`)
  return res.json()
}

function mapEvent(e: EBEvent, scrapedAt: string): LondonEvent | null {
  const id = e.eid ?? e.id
  if (!id || e.is_online_event) return null

  const city = e.primary_venue?.address?.city
  if (city && city !== 'London') return null

  const startAt =
    e.start_date && e.start_time
      ? `${e.start_date}T${e.start_time}`
      : e.start_date ?? ''
  const endAt =
    e.end_date && e.end_time
      ? `${e.end_date}T${e.end_time}`
      : e.end_date ?? ''

  const tags = (e.tags ?? [])
    .filter((t) => t.prefix === 'OrganizerTag' && t.display_name)
    .map((t) => t.display_name!)
    .slice(0, 3)

  return {
    id: `eb-${id}`,
    name: e.name ?? '',
    startAt,
    endAt,
    timezone: e.timezone ?? 'Europe/London',
    url: e.url ?? '',
    coverUrl: e.image?.url ?? null,
    locationName:
      e.primary_venue?.address?.localized_address_display ??
      e.primary_venue?.name ??
      'London',
    city: 'London',
    organiserName: e.primary_organizer?.name ?? '',
    organiserAvatarUrl: e.primary_organizer?.logo?.url ?? null,
    tags,
    source: 'eventbrite',
    scrapedAt,
    curated: false,
  }
}

export class EventbriteScraper implements EventScraper {
  name = 'eventbrite'

  async run(): Promise<LondonEvent[]> {
    const scrapedAt = new Date().toISOString()
    const { csrf, cookieHeader } = await fetchCsrfToken()

    const events: LondonEvent[] = []
    let continuation: string | null = null
    let page = 0

    while (true) {
      const data = await searchEvents(csrf, cookieHeader, continuation ?? null)
      const results = data.events?.results ?? []

      for (const e of results) {
        const event = mapEvent(e, scrapedAt)
        if (event) events.push(event)
      }

      continuation = data.events?.pagination?.continuation ?? null
      page++

      // Limit to first 6 pages (300 events) to keep scrape time reasonable
      if (!continuation || page >= 6) break
    }

    return events
  }
}
