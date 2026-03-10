/**
 * Starter London API client + deduplication helper.
 *
 * Drop this into a consumer codebase to fetch community events from
 * the Starter London API and merge them with Google Calendar events.
 *
 * Usage:
 *   const apiEvents = await fetchStarterEvents('your-api-key')
 *   const merged = deduplicateEvents(googleCalendarEvents, apiEvents)
 */

interface CalendarEvent {
  id: string
  summary: string
  description?: string
  location?: string
  start: { dateTime?: string; date?: string; timeZone?: string }
  end: { dateTime?: string; date?: string; timeZone?: string }
  htmlLink: string
  externalUrl?: string
  imageUrl?: string
  hostedByUM: boolean
}

const DEFAULT_API_URL = 'https://starter-london.vercel.app/api/events'

export async function fetchStarterEvents(
  apiKey: string,
  options?: { baseUrl?: string; curated?: boolean }
): Promise<CalendarEvent[]> {
  const base = options?.baseUrl ?? DEFAULT_API_URL
  const params = new URLSearchParams({ key: apiKey })
  if (options?.curated) params.set('curated', 'true')

  const res = await fetch(`${base}?${params}`, {
    next: { revalidate: 300 },
  })

  if (!res.ok) {
    console.error(`Starter London API error: ${res.status} ${res.statusText}`)
    return []
  }

  const data = await res.json()
  return data.events ?? []
}

/**
 * Strips protocol, www prefix, and trailing slashes so that
 * "https://lu.ma/foo" and "http://www.lu.ma/foo/" match.
 */
function normalizeUrl(url: string): string {
  return url
    .replace(/\/+$/, '')
    .replace(/^https?:\/\/(www\.)?/, '')
    .toLowerCase()
}

const URL_REGEX = /https?:\/\/[^\s<>"')\]]+/g

/**
 * Merge API events with Google Calendar events, removing duplicates.
 *
 * Builds a set of all URLs found in Google Calendar events (from
 * externalUrl, htmlLink, and URLs parsed from description text),
 * then filters out any API events whose URL is already known.
 *
 * Google Calendar events always win — if an event exists in both
 * sources, the Google Calendar version is kept (it may have
 * custom edits from the calendar owner).
 */
export function deduplicateEvents(
  googleEvents: CalendarEvent[],
  apiEvents: CalendarEvent[]
): CalendarEvent[] {
  const knownUrls = new Set<string>()

  for (const e of googleEvents) {
    if (e.externalUrl) knownUrls.add(normalizeUrl(e.externalUrl))
    if (e.htmlLink) knownUrls.add(normalizeUrl(e.htmlLink))
    if (e.description) {
      for (const match of e.description.matchAll(URL_REGEX)) {
        knownUrls.add(normalizeUrl(match[0]))
      }
    }
  }

  const unique = apiEvents.filter((e) => {
    const url = e.externalUrl ?? e.htmlLink ?? ''
    return url !== '' && !knownUrls.has(normalizeUrl(url))
  })

  return [...googleEvents, ...unique]
}
