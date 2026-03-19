import { LondonEvent, EventScraper } from '@/lib/types'

const GQL_URL = 'https://www.meetup.com/gql2'
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const QUERY = `
  query EventSearch($filter: EventSearchFilter!, $first: Int, $after: String) {
    eventSearch(filter: $filter, first: $first, after: $after) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id title dateTime endTime eventType eventUrl
          venue { name address city country }
          group { name urlname timezone }
          featuredEventPhoto { highResUrl }
        }
      }
    }
  }
`

interface GQLEvent {
  id: string
  title: string
  dateTime: string
  endTime?: string | null
  eventType: string
  eventUrl: string
  venue?: { name?: string | null; address?: string | null; city?: string | null; country?: string | null } | null
  group?: { name?: string | null; urlname?: string | null; timezone?: string | null } | null
  featuredEventPhoto?: { highResUrl?: string | null } | null
}

function mapEvent(raw: GQLEvent, scrapedAt: string): LondonEvent | null {
  if (!raw.id || !raw.title || !raw.dateTime || !raw.eventUrl) return null
  if (raw.eventType !== 'PHYSICAL') return null

  const city = raw.venue?.city ?? ''
  if (city && !city.toLowerCase().startsWith('london') && city.toLowerCase() !== 'greater london') return null

  const timezone = raw.group?.timezone ?? 'Europe/London'
  const locationName = raw.venue?.address
    ? `${raw.venue.address}${city ? ', ' + city : ''}`
    : city || 'London'

  return {
    id: `meetup-${raw.id}`,
    name: raw.title,
    startAt: raw.dateTime,
    endAt: raw.endTime ?? raw.dateTime,
    timezone,
    url: raw.eventUrl,
    coverUrl: raw.featuredEventPhoto?.highResUrl ?? null,
    locationName,
    city: 'London',
    organiserName: raw.group?.name ?? '',
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
    const events: LondonEvent[] = []

    const baseFilter = {
      lat: 51.5074,
      lon: -0.1278,
      radius: 25.0,
      query: 'tech',
      eventType: 'PHYSICAL',
      startDateRange: new Date().toISOString(),
    }

    let after: string | null = null
    let page = 0
    const MAX_PAGES = 5

    while (page < MAX_PAGES) {
      const res: Response = await fetch(GQL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
        body: JSON.stringify({
          operationName: 'EventSearch',
          variables: { filter: baseFilter, first: 50, ...(after ? { after } : {}) },
          query: QUERY,
        }),
        signal: AbortSignal.timeout(20000),
      })

      if (!res.ok) throw new Error(`Meetup GraphQL failed: ${res.status}`)

      const data = await res.json()
      if (data.errors) throw new Error(`Meetup GraphQL error: ${data.errors[0]?.message}`)

      const search = data?.data?.eventSearch
      const edges: { node: GQLEvent }[] = search?.edges ?? []

      for (const { node } of edges) {
        const event = mapEvent(node, scrapedAt)
        if (event) events.push(event)
      }

      if (!search?.pageInfo?.hasNextPage) break
      after = search.pageInfo.endCursor
      page++
    }

    return events
  }
}
