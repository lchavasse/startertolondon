import { LondonEvent } from '@/lib/types'
import { LumaDiscoveryScraper } from './luma-discovery'

const scrapers = [new LumaDiscoveryScraper()]

export async function runAllScrapers(): Promise<LondonEvent[]> {
  const results = await Promise.allSettled(scrapers.map((s) => s.run()))

  const seen = new Set<string>()
  const events: LondonEvent[] = []

  for (const [i, result] of results.entries()) {
    if (result.status === 'fulfilled') {
      for (const event of result.value) {
        if (!seen.has(event.id)) {
          seen.add(event.id)
          events.push(event)
        }
      }
    } else {
      console.error(`Scraper "${scrapers[i].name}" failed:`, result.reason)
    }
  }

  return events
}
