import { LondonEvent } from '@/lib/types'

export function extractUrlSlug(url: string): string | null {
  const match = url.match(/(?:luma\.com|lu\.ma)\/([a-zA-Z0-9._-]+)/)
  return match ? match[1] : null
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
