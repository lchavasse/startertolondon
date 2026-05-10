/**
 * Fetches an event description from a luma.com event page.
 *
 * Used by the sector tagger for orphan events (events whose source isn't in
 * the KB yet). We extract the description from `__NEXT_DATA__` — the same
 * pattern as `luma-page-fetch.ts`.
 *
 * Cached in Redis under `event:desc:<eventId>` with a 60-day TTL so we
 * fetch each event at most once.
 */
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

const CACHE_TTL_SECONDS = 60 * 24 * 60 * 60 // 60 days

const PAGE_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

const MAX_CHARS = 4000

// Luma's site-wide boilerplate — appears on every event page in metadata, must
// be filtered out so we don't tag every event with a generic "AI/hackathon" prior.
const LUMA_BOILERPLATE = [
  'Join a hackathon, learn about LLMs',
  'Delightful events start here',
  'Discover popular events',
]

function descCacheKey(eventId: string): string {
  return `event:desc:${eventId}`
}

function isBoilerplate(text: string): boolean {
  return LUMA_BOILERPLATE.some((b) => text.startsWith(b))
}

/**
 * Pull every `"<key>":"<value>"` match from the whole HTML for the given key
 * and return the longest non-boilerplate decoded string.
 *
 * Why scan the entire HTML rather than just __NEXT_DATA__: Luma renders the
 * actual event description in a separate JSON island outside the Next.js
 * payload. The first `"description"` inside __NEXT_DATA__ is usually an empty
 * placeholder, the next is Luma's generic site tagline, and the third is the
 * real one. Picking the longest non-boilerplate match is robust to the order.
 */
function collectByKey(html: string, key: string): string[] {
  const re = new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, 'g')
  const out: string[] = []
  for (const match of html.matchAll(re)) {
    try {
      const decoded = JSON.parse(`"${match[1]}"`) as string
      const trimmed = decoded.trim()
      if (trimmed.length > 0 && !isBoilerplate(trimmed)) out.push(trimmed)
    } catch {
      // Malformed escape — skip this match.
    }
  }
  return out
}

function parseDescription(html: string): string | null {
  // Try richer fields first (markdown / mirror), fall back to plain `description`.
  const tryKeys = ['description_md', 'description_mirror', 'description', 'description_text']
  let best: string | null = null
  for (const key of tryKeys) {
    const candidates = collectByKey(html, key)
    for (const candidate of candidates) {
      if (best === null || candidate.length > best.length) best = candidate
    }
    // Once a richer key has produced something substantive, stop — preferring
    // markdown formatting over plain text when both are present.
    if (best !== null && key !== 'description' && best.length >= 80) break
  }
  return best ? best.slice(0, MAX_CHARS) : null
}

async function fetchDescriptionLive(eventUrl: string): Promise<string | null> {
  try {
    const res = await fetch(eventUrl, {
      headers: PAGE_HEADERS,
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const html = await res.text()
    if (/"status"\s*:\s*429/.test(html)) return null
    return parseDescription(html)
  } catch {
    return null
  }
}

export async function getCachedDescription(eventId: string): Promise<string | null> {
  const raw = await redis.get<string>(descCacheKey(eventId))
  if (raw === null || raw === undefined) return null
  if (raw === '') return '' // explicit "we tried, found nothing" marker
  return raw
}

/**
 * Fetch + cache an event description. Returns `null` on failure (caller
 * decides whether to skip the event or tag from name only).
 *
 * Idempotent: cached for 60 days. A failed fetch is *not* cached, so retries
 * happen on subsequent runs.
 */
export async function fetchEventDescription(
  eventId: string,
  eventUrl: string
): Promise<string | null> {
  const cached = await getCachedDescription(eventId)
  if (cached !== null) return cached

  const description = await fetchDescriptionLive(eventUrl)
  if (description === null) return null

  await redis.set(descCacheKey(eventId), description, { ex: CACHE_TTL_SECONDS }).catch(() => {})
  return description
}

/**
 * Fetch descriptions for many events with bounded concurrency. Returns a
 * map keyed by eventId — events that failed are simply absent.
 */
export async function fetchEventDescriptions(
  events: readonly { id: string; url: string }[],
  concurrency = 3
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const queue = [...events]

  async function worker() {
    while (queue.length > 0) {
      const event = queue.shift()
      if (!event) return
      const desc = await fetchEventDescription(event.id, event.url)
      if (desc !== null && desc.length > 0) out.set(event.id, desc)
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker))
  return out
}
