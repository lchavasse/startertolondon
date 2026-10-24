import { LondonEvent, EventScraper } from '@/lib/types'

const CV_API_URL = 'https://api.cerebralvalley.ai/v1/public/event/pull'
const PAGE_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
}

interface CVEvent {
  id: string
  name: string
  startDateTime: string
  endDateTime: string
  url: string
  imageUrl?: string | null
  location?: string | null
  venue?: string | null
  type?: string | null
}

interface LumaEventData {
  event: {
    api_id: string
    name: string
    start_at: string
    end_at: string
    timezone: string
    url: string
    cover_url?: string | null
    geo_address_info?: { full_address?: string; city?: string }
  }
  calendar?: {
    name?: string
    avatar_url?: string | null
  }
}

// CV serves naive datetimes ("2026-07-30 16:30:00") with timeZone always null.
// Verified against Luma for the same events: the wall clock is UTC. Left raw,
// `new Date()` parses it as *local* time, so BST events render an hour early and
// near-midnight ones bucket to the wrong day.
function toIso(naive: string): string {
  const m = naive.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)$/)
  if (!m) return naive // already offset-qualified (or unparseable) — leave alone
  return new Date(`${m[1]}T${m[2]}Z`).toISOString()
}

function extractLumaSlug(url: string): string | null {
  // Handles https://luma.com/slug, https://lu.ma/slug
  const match = url.match(/(?:luma\.com|lu\.ma)\/([a-zA-Z0-9._-]+)/)
  return match ? match[1] : null
}

async function fetchLumaEventDetails(
  slug: string
): Promise<LumaEventData | null> {
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

    const nextData = JSON.parse(dataMatch[1])
    const inner =
      nextData?.props?.pageProps?.initialData?.data

    if (!inner?.event?.api_id) return null

    return {
      event: inner.event,
      calendar: inner.calendar,
    }
  } catch {
    return null
  }
}

// Extract the underlying-platform identifiers from a CV event's URL so we can
// remap it to the correct source ('eventbrite' / 'meetup') and dedupe-by-id
// against our own EB/Meetup scrapers.
function detectPlatform(url: string): { source: 'eventbrite' | 'meetup' | null; id?: string; meetupGroup?: string } {
  const eb = url.match(/eventbrite\.[^/]+\/e\/(?:[^/]*-)?tickets-(\d+)/i)
  if (eb) return { source: 'eventbrite', id: eb[1] }
  const mu = url.match(/meetup\.com\/([^/]+)\/events\/(\d+)/i)
  if (mu) return { source: 'meetup', meetupGroup: mu[1], id: mu[2] }
  return { source: null }
}

// CV's `location` is self-reported and often wrong — Munich, San Jose, Belfast
// and Edinburgh conferences all arrive tagged "London, UK", with `timeZone` and
// `platformEventData` both null, so there is no better field to trust. Where the
// event is on Luma we re-check the real city after enrichment (see `run()`);
// where it isn't, `venue` is the only signal left.
//
// Biased towards precision: a false positive silently drops a real London event,
// so ambiguous city names that are also London place names (Leicester Square,
// Cambridge Heath, Manchester Square, Liverpool Street) are matched exactly or
// qualified rather than as bare substrings. Extend both lists as offenders show up.
const NON_LONDON_VENUE_EXACT = [
  'leicester',
  'belfast',
  'mcenery convention center',
  'john mcintyre conference centre',
  'national space centre',
]

const NON_LONDON_VENUE_TOKENS = [
  'munich',
  'münchen',
  'hilton cambridge',
  'hilton nottingham',
  'murrayfield',
  'edinburgh',
  'glasgow',
  'cardiff',
  'dublin',
  'san jose',
  'santa clara',
  'las vegas',
  'amsterdam',
  'singapore',
  'tokyo',
]

function isNonLondonVenue(venue: string | null | undefined): boolean {
  if (!venue) return false
  const v = venue.trim().toLowerCase()
  if (NON_LONDON_VENUE_EXACT.includes(v)) return true
  return NON_LONDON_VENUE_TOKENS.some((token) => v.includes(token))
}

function mapCVEvent(e: CVEvent, scrapedAt: string): LondonEvent {
  const platform = detectPlatform(e.url)
  const baseTags = e.type && e.type !== '' ? [e.type] : []
  const cvTag = 'cerebral-valley'
  const tags = baseTags.includes(cvTag) ? baseTags : [...baseTags, cvTag]

  const common = {
    name: e.name,
    startAt: toIso(e.startDateTime),
    endAt: toIso(e.endDateTime),
    timezone: 'Europe/London',
    url: e.url,
    coverUrl: e.imageUrl ?? null,
    locationName: e.venue ?? 'London, UK',
    city: 'London',
    organiserName: '',
    organiserAvatarUrl: null,
    tags,
    scrapedAt,
    curated: false,
  }

  // Remap CV → real platform source so EB/Meetup quality pipeline catches it.
  // Tag 'cerebral-valley' on tags so it's identifiable in the review UI.
  if (platform.source === 'eventbrite' && platform.id) {
    return { ...common, id: `eb-${platform.id}`, source: 'eventbrite' }
  }
  if (platform.source === 'meetup' && platform.id && platform.meetupGroup) {
    return {
      ...common,
      id: `meetup-${platform.id}`,
      source: 'meetup',
      calendarSlug: `meetup:${platform.meetupGroup}`,
    }
  }
  // Unknown platform (hopin, splash, custom domains) — leave as cv-.
  return { ...common, id: `cv-${e.id}`, source: 'cerebral-valley' }
}

function mapLumaEvent(
  luma: LumaEventData,
  scrapedAt: string
): LondonEvent {
  const { event, calendar } = luma
  return {
    id: event.api_id,
    name: event.name,
    startAt: event.start_at,
    endAt: event.end_at,
    timezone: event.timezone,
    url: `https://lu.ma/${event.url}`,
    coverUrl: event.cover_url ?? null,
    locationName: event.geo_address_info?.full_address ?? '',
    city: event.geo_address_info?.city ?? 'London',
    organiserName: calendar?.name ?? '',
    organiserAvatarUrl: calendar?.avatar_url ?? null,
    tags: calendar?.name ? [calendar.name] : [],
    source: 'luma-discovery',
    scrapedAt,
    curated: false,
  }
}

export class CerebralValleyScraper implements EventScraper {
  name = 'cerebral-valley'

  constructor(private knownSlugs: Set<string> = new Set()) {}

  async run(): Promise<LondonEvent[]> {
    const scrapedAt = new Date().toISOString()

    const params = new URLSearchParams({
      approved: 'true',
      startDateTime: new Date().toISOString(),
    })

    const res = await fetch(`${CV_API_URL}?${params}`, {
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      throw new Error(
        `Cerebral Valley API error: ${res.status} ${res.statusText}`
      )
    }

    const data = await res.json()
    const totalCount: number = data.totalCount ?? 0
    const limit: number = data.limit ?? 20
    let allEvents: CVEvent[] = data.events ?? []

    // Paginate if there are more events beyond the first page
    const totalPages = Math.ceil(totalCount / limit)
    for (let page = 1; page < totalPages; page++) {
      const pageParams = new URLSearchParams({
        approved: 'true',
        startDateTime: new Date().toISOString(),
        offset: String(page * limit),
        limit: String(limit),
      })
      const pageRes = await fetch(`${CV_API_URL}?${pageParams}`, {
        signal: AbortSignal.timeout(15000),
      })
      if (!pageRes.ok) break
      const pageData = await pageRes.json()
      allEvents = allEvents.concat(pageData.events ?? [])
    }

    const claimedLondon = allEvents.filter((e) => e.location === 'London, UK')
    const cvEvents = claimedLondon.filter((e) => !isNonLondonVenue(e.venue))
    const droppedByVenue = claimedLondon.length - cvEvents.length
    if (droppedByVenue > 0) {
      console.warn(
        `[cerebral-valley] dropped ${droppedByVenue} event(s) tagged "London, UK" with a non-London venue`
      )
    }

    const ENRICH_DELAY_MS = 500
    const results: LondonEvent[] = []

    for (const e of cvEvents) {
      const slug = extractLumaSlug(e.url)

      if (slug && this.knownSlugs.has(slug)) {
        // Already properly enriched in Redis — emit cv- fallback, slug-dedup will discard it
        results.push(mapCVEvent(e, scrapedAt))
        continue
      }

      if (slug) {
        const luma = await fetchLumaEventDetails(slug)
        // Luma carries the real city, so it overrules CV's self-reported one.
        // Only a city that is present *and* isn't London disqualifies — an
        // absent one just means Luma has no address, not that it's elsewhere.
        const lumaCity = luma?.event.geo_address_info?.city
        if (lumaCity && lumaCity !== 'London') {
          await new Promise((r) => setTimeout(r, ENRICH_DELAY_MS))
          continue
        }
        results.push(luma ? mapLumaEvent(luma, scrapedAt) : mapCVEvent(e, scrapedAt))
        await new Promise((r) => setTimeout(r, ENRICH_DELAY_MS))
      } else {
        results.push(mapCVEvent(e, scrapedAt))
      }
    }

    return results
  }
}
