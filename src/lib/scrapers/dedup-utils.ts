import { LondonEvent } from '@/lib/types'

export function extractUrlSlug(url: string): string | null {
  const match = url.match(/(?:luma\.com|lu\.ma)\/([a-zA-Z0-9._-]+)/)
  return match ? match[1] : null
}

const LUMA_SOURCES = new Set(['luma-discovery', 'luma-calendar', 'luma-profile', 'cerebral-valley'])

function crossPlatformKey(event: LondonEvent): string {
  const name = event.name.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
  const date = event.startAt.slice(0, 10)
  const venue = event.locationName.toLowerCase().trim().slice(0, 20)
  return `${name}|${date}|${venue}`
}

// Drop EB/Meetup events that match a Luma event by normalised name + same day +
// venue prefix. Luma always wins because Luma sources are curated. Best-effort
// match — admin can manually blocklist remaining duplicates.
export function dedupeAcrossPlatforms(events: LondonEvent[]): LondonEvent[] {
  const lumaKeys = new Set<string>()
  for (const event of events) {
    if (LUMA_SOURCES.has(event.source)) lumaKeys.add(crossPlatformKey(event))
  }
  return events.filter((event) => {
    if (LUMA_SOURCES.has(event.source)) return true
    if (event.source !== 'eventbrite' && event.source !== 'meetup') return true
    const key = crossPlatformKey(event)
    if (lumaKeys.has(key)) {
      console.log(`[dedup] dropped ${event.source} '${event.name}' as cross-platform dup of Luma`)
      return false
    }
    return true
  })
}

export function dedupeBySlug(events: LondonEvent[]): LondonEvent[] {
  const slugMap = new Map<string, LondonEvent>()
  const nonLuma: LondonEvent[] = []

  for (const event of events) {
    const slug = extractUrlSlug(event.url)
    if (!slug) { nonLuma.push(event); continue }

    const existing = slugMap.get(slug)
    if (!existing) { slugMap.set(slug, event); continue }

    // Prefer: curated > real Luma ID (evt-) over cv- > has coverUrl
    if (event.curated && !existing.curated) { slugMap.set(slug, event); continue }
    if (!event.curated && existing.curated) { continue }
    const incomingReal = !event.id.startsWith('cv-')
    const existingReal = !existing.id.startsWith('cv-')
    if (incomingReal && !existingReal) { slugMap.set(slug, event); continue }
    if (!incomingReal && existingReal) { continue }
    if (event.coverUrl && !existing.coverUrl) { slugMap.set(slug, event) }
  }

  return [...slugMap.values(), ...nonLuma]
}
