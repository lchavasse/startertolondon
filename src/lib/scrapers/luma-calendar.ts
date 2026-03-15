import { LondonEvent, EventScraper, FailedSource } from '@/lib/types'

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

async function extractCalId(
  source: string,
  calIdCache: Record<string, string> = {},
  newCalIds?: Record<string, string>
): Promise<string | null> {
  // Direct cal-id path e.g. 'calendar/cal-ACd43Ggy4n6LhK6'
  const direct = source.match(/^(?:calendar\/)(cal-[A-Za-z0-9]+)$/)
  if (direct) return direct[1]

  // Check cache first
  if (calIdCache[source]) return calIdCache[source]

  // Fetch page and extract from __NEXT_DATA__
  try {
    const res = await fetch(`https://luma.com/${source}`, {
      headers: PAGE_HEADERS,
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const html = await res.text()
    const dataMatch = html.match(
      /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/
    )
    if (!dataMatch) return null
    const calMatch = dataMatch[1].match(/"api_id"\s*:\s*"(cal-[A-Za-z0-9]+)"/)
    const calId = calMatch ? calMatch[1] : null
    if (calId && newCalIds) newCalIds[source] = calId
    return calId
  } catch {
    return null
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function fetchCalendarEvents(calId: string): Promise<LumaEntry[]> {
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
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`) as Error & { statusCode: number }
      err.statusCode = res.status
      throw err
    }

    const data = await res.json()
    entries.push(...(data.entries ?? []))
    if (!data.has_more || !data.next_cursor) break
    cursor = data.next_cursor
  }

  return entries
}

function mapEntry(
  entry: LumaEntry,
  scrapedAt: string,
  curated: boolean,
  calendarSlug: string
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
    source: 'luma-calendar',
    calendarSlug,
    scrapedAt,
    curated,
  }
}

export class LumaCalendarScraper implements EventScraper {
  name = 'luma-calendar'
  _failed: FailedSource[] = []
  _newCalIds: Record<string, string> = {}

  constructor(
    private sources: string[],
    private curated: boolean = false,
    private calIdCache: Record<string, string> = {}
  ) {}

  async run(): Promise<LondonEvent[]> {
    const scrapedAt = new Date().toISOString()
    const events: LondonEvent[] = []
    const failed: FailedSource[] = []
    const BATCH = 3

    // Phase 1: resolve cal-ids (all should be in cache from orchestrator pre-flight)
    const calIdMap = new Map<string, string>()
    for (const source of this.sources) {
      const calId = await extractCalId(source, this.calIdCache, this._newCalIds)
      if (calId) {
        calIdMap.set(source, calId)
      } else {
        console.warn(`[luma-calendar] Could not extract cal-id for: ${source}`)
        failed.push({ slug: source, error: 'Could not extract cal-id', isRateLimit: false, timestamp: scrapedAt })
      }
    }

    // Phase 2: batch-fetch events for resolved sources
    const resolvedSources = this.sources.filter((s) => calIdMap.has(s))
    for (let i = 0; i < resolvedSources.length; i += BATCH) {
      if (i > 0) await sleep(400)
      const batch = resolvedSources.slice(i, i + BATCH)

      await Promise.all(
        batch.map(async (source) => {
          const calId = calIdMap.get(source)!
          try {
            const entries = await fetchCalendarEvents(calId)
            for (const entry of entries) {
              const event = mapEntry(entry, scrapedAt, this.curated, source)
              if (event) events.push(event)
            }
          } catch (err) {
            const statusCode = (err as { statusCode?: number }).statusCode
            const isRateLimit = statusCode === 429
            console.warn(`[luma-calendar] Failed fetching ${calId} (${statusCode ?? 'err'}):`, err)
            failed.push({
              slug: source,
              error: err instanceof Error ? err.message : String(err),
              statusCode,
              isRateLimit,
              timestamp: scrapedAt,
            })
          }
        })
      )
    }

    this._failed = failed
    return events
  }
}
