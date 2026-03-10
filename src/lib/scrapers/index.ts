import { LondonEvent } from '@/lib/types'
import { getCommunitySources, getBlocklist, logFailedSources, getSystemSourceOverrides } from '@/lib/kv'
import { CALENDAR_SOURCES, USER_SOURCES } from './sources'
import { LumaDiscoveryScraper } from './luma-discovery'
import { LumaCalendarScraper } from './luma-calendar'
import { LumaUserScraper } from './luma-user'
import { LumaChannelScraper } from './luma-channel'
import { CerebralValleyScraper } from './cerebral-valley'
import { EventbriteScraper } from './eventbrite'
import { MeetupScraper } from './meetup'

export async function runAllScrapers(): Promise<LondonEvent[]> {
  const [community, blocklist, systemOverrides] = await Promise.all([
    getCommunitySources(),
    getBlocklist(),
    getSystemSourceOverrides(),
  ])
  const blockSet = new Set(blocklist)

  const curatedCommCals   = community.filter((s) => s.type === 'calendar' && s.curated).map((s) => s.slug)
  const uncuratedCommCals = community.filter((s) => s.type === 'calendar' && !s.curated).map((s) => s.slug)
  const curatedCommUsers  = community.filter((s) => s.type === 'user' && s.curated).map((s) => s.slug)
  const uncuratedCommUsers= community.filter((s) => s.type === 'user' && !s.curated).map((s) => s.slug)

  // Split system sources by effective curated flag (overrides take precedence)
  const curatedSysCals   = CALENDAR_SOURCES.filter((s) => (s.slug in systemOverrides ? systemOverrides[s.slug] : s.curated)).map((s) => s.slug)
  const uncuratedSysCals = CALENDAR_SOURCES.filter((s) => !(s.slug in systemOverrides ? systemOverrides[s.slug] : s.curated)).map((s) => s.slug)
  const curatedSysUsers  = USER_SOURCES.filter((s) => (s.slug in systemOverrides ? systemOverrides[s.slug] : s.curated)).map((s) => s.slug)
  const uncuratedSysUsers= USER_SOURCES.filter((s) => !(s.slug in systemOverrides ? systemOverrides[s.slug] : s.curated)).map((s) => s.slug)

  const calendarScraper = new LumaCalendarScraper(
    [...curatedSysCals, ...curatedCommCals],
    true
  )

  const scrapers = [
    new LumaDiscoveryScraper(),
    calendarScraper,
    ...([...uncuratedSysCals, ...uncuratedCommCals].length
      ? [new LumaCalendarScraper([...uncuratedSysCals, ...uncuratedCommCals], false)]
      : []),
    new LumaUserScraper([...curatedSysUsers, ...curatedCommUsers], true),
    ...([...uncuratedSysUsers, ...uncuratedCommUsers].length
      ? [new LumaUserScraper([...uncuratedSysUsers, ...uncuratedCommUsers], false)]
      : []),
    new LumaChannelScraper(),
    new CerebralValleyScraper(),
    new EventbriteScraper(),
    new MeetupScraper(),
  ]

  const results = await Promise.allSettled(scrapers.map((s) => s.run()))

  // Dedup: curated:true wins over curated:false for same event id
  const seen = new Map<string, LondonEvent>()

  for (const [i, result] of results.entries()) {
    if (result.status === 'fulfilled') {
      for (const event of result.value) {
        const existing = seen.get(event.id)
        if (!existing || (!existing.curated && event.curated)) {
          seen.set(event.id, event)
        }
      }
    } else {
      console.error(`Scraper "${scrapers[i].name}" failed:`, result.reason)
    }
  }

  // Log failed sources from calendar scraper
  const failed = calendarScraper._failed
  if (failed.length > 0) {
    await logFailedSources(failed).catch(() => {})
  }

  // Filter out blocklisted events
  return [...seen.values()].filter((e) => !blockSet.has(e.id))
}
