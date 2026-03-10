import { LondonEvent, EventScraper } from '@/lib/types'

const FIND_URL =
  'https://www.meetup.com/find/?categoryId=546&source=EVENTS&keywords=london&radius=10'

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

type ApolloCache = Record<string, Record<string, unknown>>

interface ApolloEvent {
  __typename: 'Event'
  id?: string
  title?: string | null
  dateTime?: string | null
  endTime?: string | null
  eventType?: string | null
  eventUrl?: string | null
  timezone?: string | null
  venue?: {
    __typename?: string
    name?: string | null
    address?: string | null
    city?: string | null
    country?: string | null
  } | null
  group?: { __ref: string } | null
  featuredEventPhoto?: { __ref: string } | null
  displayPhoto?: { __ref: string } | null
}

interface ApolloGroup {
  __typename: 'Group'
  name?: string | null
  urlname?: string | null
  timezone?: string | null
}

interface ApolloPhoto {
  __typename: 'PhotoInfo'
  highResUrl?: string | null
  baseUrl?: string | null
}

function mapEvent(cache: ApolloCache, key: string, scrapedAt: string): LondonEvent | null {
  const raw = cache[key] as unknown as ApolloEvent
  if (!raw?.id || !raw.title || !raw.dateTime || !raw.eventUrl) return null
  if (raw.eventType && raw.eventType !== 'PHYSICAL') return null

  const venue = raw.venue
  const city = venue?.city ?? ''
  // city can be "London EC1V 9BP" or just "London"
  if (city && !city.toLowerCase().startsWith('london')) return null

  const groupRef = raw.group?.__ref
  const group = groupRef ? (cache[groupRef] as unknown as ApolloGroup) : null

  const photoRef = raw.featuredEventPhoto?.__ref ?? raw.displayPhoto?.__ref
  const photo = photoRef ? (cache[photoRef] as unknown as ApolloPhoto) : null
  const coverUrl = photo?.highResUrl ?? null

  const timezone = group?.timezone ?? raw.timezone ?? 'Europe/London'

  const locationName = venue?.address
    ? `${venue.address}${city ? ', ' + city : ''}`
    : city || 'London'

  return {
    id: `meetup-${raw.id}`,
    name: raw.title,
    startAt: raw.dateTime,
    endAt: raw.endTime ?? raw.dateTime,
    timezone,
    url: raw.eventUrl,
    coverUrl,
    locationName,
    city: 'London',
    organiserName: group?.name ?? '',
    organiserAvatarUrl: null,
    tags: [],
    source: 'meetup',
    scrapedAt,
    curated: false,
  }
}

export class MeetupScraper implements EventScraper {
  name = 'meetup'

  async run(): Promise<LondonEvent[]> {
    const scrapedAt = new Date().toISOString()

    const res = await fetch(FIND_URL, {
      headers: { 'User-Agent': UA, Accept: 'text/html' },
      signal: AbortSignal.timeout(20000),
    })

    if (!res.ok) throw new Error(`Meetup fetch failed: ${res.status}`)

    const html = await res.text()
    const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
    if (!match) throw new Error('Meetup: __NEXT_DATA__ not found')

    const nextData = JSON.parse(match[1])
    const cache: ApolloCache = nextData?.props?.pageProps?.__APOLLO_STATE__ ?? {}

    const events: LondonEvent[] = []
    for (const key of Object.keys(cache)) {
      if (!key.startsWith('Event:')) continue
      const event = mapEvent(cache, key, scrapedAt)
      if (event) events.push(event)
    }

    return events
  }
}
