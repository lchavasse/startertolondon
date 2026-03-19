import { LondonEvent, FailedSource } from '@/lib/types'
import {
  getCommunitySources,
  getBlocklist,
  logFailedSources,
  getSystemSourceOverrides,
  getRawEvents,
  getSourceScrapedAt,
  saveSourceScrapedAt,
  getCalIdCache,
  saveCalIdCache,
  getChannelIdCache,
  saveChannelIdCache,
  ChannelCacheEntry,
} from '@/lib/kv'
import { CALENDAR_SOURCES, USER_SOURCES, CHANNEL_SOURCES } from './sources'
import { LumaDiscoveryScraper } from './luma-discovery'
import { LumaCalendarScraper } from './luma-calendar'
import { LumaUserScraper } from './luma-user'
import { LumaChannelScraper } from './luma-channel'
import { CerebralValleyScraper } from './cerebral-valley'
import { EventbriteScraper } from './eventbrite'
import { MeetupScraper } from './meetup'
import { fetchPageId } from './luma-page-fetch'
import { dedupeBySlug, extractUrlSlug } from './dedup-utils'

// Sources scraped within this window are skipped to avoid rate limiting.
const CACHE_TTL_HOURS = 20

// Max stale sources to process per hourly run (caps concurrent HTTP requests)
const SOURCES_PER_RUN = 8

export interface ScraperResult {
  events: LondonEvent[]
  failed: FailedSource[]
  stats: { total: number; fresh: number; cached: number; failedCount: number }
}

export async function runAllScrapers(): Promise<ScraperResult> {
  const [community, blocklist, systemOverrides, existingEvents, scrapedAtMap, calIdCache] = await Promise.all([
    getCommunitySources(),
    getBlocklist(),
    getSystemSourceOverrides(),
    getRawEvents(),
    getSourceScrapedAt(),
    getCalIdCache(),
  ])
  const blockSet = new Set(blocklist)

  // Build set of slugs from properly-enriched events (not cv- fallbacks)
  // so CV scraper can skip re-fetching events already in Redis
  const knownLumaSlugs = new Set<string>()
  for (const event of existingEvents) {
    if (!event.id.startsWith('cv-')) {
      const slug = extractUrlSlug(event.url)
      if (slug) knownLumaSlugs.add(slug)
    }
  }

  // Group existing events by calendarSlug for fallback on failure
  const existingBySlug = new Map<string, LondonEvent[]>()
  for (const event of existingEvents) {
    if (event.calendarSlug) {
      const arr = existingBySlug.get(event.calendarSlug) ?? []
      arr.push(event)
      existingBySlug.set(event.calendarSlug, arr)
    }
  }

  const now = Date.now()
  const isFresh = (slug: string) => {
    const ts = scrapedAtMap[slug]
    if (!ts) return false
    return now - new Date(ts).getTime() < CACHE_TTL_HOURS * 60 * 60 * 1000
  }

  // Split community/system sources by curated flag
  const curatedCommCals   = community.filter((s) => s.type === 'calendar' && s.curated).map((s) => s.slug)
  const uncuratedCommCals = community.filter((s) => s.type === 'calendar' && !s.curated).map((s) => s.slug)
  const curatedCommUsers  = community.filter((s) => s.type === 'user' && s.curated).map((s) => s.slug)
  const uncuratedCommUsers= community.filter((s) => s.type === 'user' && !s.curated).map((s) => s.slug)

  const curatedSysCals   = CALENDAR_SOURCES.filter((s) => (s.slug in systemOverrides ? systemOverrides[s.slug] : s.curated)).map((s) => s.slug)
  const uncuratedSysCals = CALENDAR_SOURCES.filter((s) => !(s.slug in systemOverrides ? systemOverrides[s.slug] : s.curated)).map((s) => s.slug)
  const curatedSysUsers  = USER_SOURCES.filter((s) => (s.slug in systemOverrides ? systemOverrides[s.slug] : s.curated)).map((s) => s.slug)
  const uncuratedSysUsers= USER_SOURCES.filter((s) => !(s.slug in systemOverrides ? systemOverrides[s.slug] : s.curated)).map((s) => s.slug)

  const allCalSources  = [...curatedSysCals, ...curatedCommCals, ...uncuratedSysCals, ...uncuratedCommCals]
  const allUserSources = [...curatedSysUsers, ...curatedCommUsers, ...uncuratedSysUsers, ...uncuratedCommUsers]

  // Separate stale (needs re-fetch) from fresh (use cached events)
  // Sort by oldest scrapedAt first (undefined = never scraped = oldest)
  const sortByAge = (slugs: string[]) =>
    [...slugs].sort((a, b) => {
      const ta = scrapedAtMap[a] ? new Date(scrapedAtMap[a]).getTime() : 0
      const tb = scrapedAtMap[b] ? new Date(scrapedAtMap[b]).getTime() : 0
      return ta - tb
    })

  const staleCalSources = sortByAge(
    [...curatedSysCals, ...curatedCommCals, ...uncuratedSysCals, ...uncuratedCommCals].filter((s) => !isFresh(s))
  ).slice(0, SOURCES_PER_RUN)

  const staleUserSources = sortByAge(
    [...curatedSysUsers, ...curatedCommUsers, ...uncuratedSysUsers, ...uncuratedCommUsers].filter((s) => !isFresh(s))
  ).slice(0, SOURCES_PER_RUN)

  // Split selected stale cal sources back into curated/uncurated for scraper construction
  const curatedCalSet = new Set([...curatedSysCals, ...curatedCommCals])
  const staleCuratedCals   = staleCalSources.filter((s) => curatedCalSet.has(s))
  const staleUncuratedCals = staleCalSources.filter((s) => !curatedCalSet.has(s))
  const curatedUserSet = new Set([...curatedSysUsers, ...curatedCommUsers])
  const staleCuratedUsers   = staleUserSources.filter((s) => curatedUserSet.has(s))
  const staleUncuratedUsers = staleUserSources.filter((s) => !curatedUserSet.has(s))

  const freshCount = allCalSources.length + allUserSources.length
    - staleCalSources.length - staleUserSources.length

  if (freshCount > 0) {
    console.log(`[scrapers] Skipping ${freshCount} fresh sources (scraped within ${CACHE_TTL_HOURS}h)`)
  }

  // Pre-flight: resolve all luma.com page IDs sequentially before launching scrapers.
  // This prevents concurrent page fetches across scrapers from triggering rate limits.
  const [channelIdCache] = await Promise.all([getChannelIdCache()])
  const preflightCalIds: Record<string, string> = {}
  const preflightChannelIds: Record<string, ChannelCacheEntry> = {}
  const PAGE_FETCH_DELAY = 2500 // ms between luma.com page requests

  for (const slug of staleCalSources) {
    const isDirect = /^calendar\/cal-[A-Za-z0-9]+$/.test(slug)
    if (isDirect || calIdCache[slug]) continue
    const result = await fetchPageId(slug)
    if (result?.kind === 'cal') {
      calIdCache[slug] = result.id
      preflightCalIds[slug] = result.id
    } else {
      console.warn(`[pre-flight] Could not resolve cal-id for: ${slug}`)
    }
    await new Promise((r) => setTimeout(r, PAGE_FETCH_DELAY))
  }

  for (const slug of CHANNEL_SOURCES) {
    if (channelIdCache[slug]) continue
    const result = await fetchPageId(slug)
    if (result) {
      const entry: ChannelCacheEntry = result.kind === 'discplace'
        ? { type: 'discovery', id: result.id }
        : { type: 'calendar', id: result.id }
      channelIdCache[slug] = entry
      preflightChannelIds[slug] = entry
    } else {
      console.warn(`[pre-flight] Could not identify channel: ${slug}`)
    }
    await new Promise((r) => setTimeout(r, PAGE_FETCH_DELAY))
  }

  if (Object.keys(preflightCalIds).length > 0) {
    await saveCalIdCache(preflightCalIds).catch(() => {})
  }
  if (Object.keys(preflightChannelIds).length > 0) {
    await saveChannelIdCache(preflightChannelIds).catch(() => {})
  }

  const calendarScraper    = new LumaCalendarScraper(staleCuratedCals, true, calIdCache)
  const uncuratedCalScraper = staleUncuratedCals.length
    ? new LumaCalendarScraper(staleUncuratedCals, false, calIdCache)
    : null
  const userScraper     = new LumaUserScraper(staleCuratedUsers, true)

  const scrapers = [
    new LumaDiscoveryScraper(),
    calendarScraper,
    ...(uncuratedCalScraper ? [uncuratedCalScraper] : []),
    userScraper,
    ...(staleUncuratedUsers.length ? [new LumaUserScraper(staleUncuratedUsers, false)] : []),
    new LumaChannelScraper(channelIdCache),
    new CerebralValleyScraper(knownLumaSlugs),
    new EventbriteScraper(),
    new MeetupScraper(),
  ]

  const results = await Promise.allSettled(scrapers.map((s) => s.run()))

  // Collect fresh events + track top-level scraper failures
  const freshEvents: LondonEvent[] = []
  for (const [i, result] of results.entries()) {
    if (result.status === 'fulfilled') {
      freshEvents.push(...result.value)
    } else {
      console.error(`Scraper "${scrapers[i].name}" failed:`, result.reason)
    }
  }

  // Collect per-source failures from calendar and user scrapers
  const allScraperFailed = scrapers.flatMap((s) =>
    '_failed' in s ? (s as { _failed: FailedSource[] })._failed : []
  )
  const failedSlugs = new Set(allScraperFailed.map((f) => f.slug))

  // For stale sources that failed, fall back to their existing cached events
  const fallbackEvents: LondonEvent[] = []
  for (const slug of [...staleCalSources, ...staleUserSources]) {
    if (failedSlugs.has(slug)) {
      const existing = existingBySlug.get(slug) ?? []
      if (existing.length > 0) {
        console.log(`[scrapers] Falling back to ${existing.length} cached events for ${slug}`)
        fallbackEvents.push(...existing)
      }
    }
  }

  // Persist newly resolved cal-ids to cache
  const newCalIds = {
    ...calendarScraper._newCalIds,
    ...(uncuratedCalScraper?._newCalIds ?? {}),
  }
  if (Object.keys(newCalIds).length > 0) {
    console.log(`[scrapers] Caching ${Object.keys(newCalIds).length} new cal-id(s)`)
    await saveCalIdCache(newCalIds).catch(() => {})
  }

  // Update scraped-at timestamps for successfully scraped stale sources
  const scrapedNow = new Date().toISOString()
  const updates: Record<string, string> = {}
  for (const slug of [...staleCalSources, ...staleUserSources]) {
    if (!failedSlugs.has(slug)) {
      updates[slug] = scrapedNow
    }
  }
  if (Object.keys(updates).length > 0) {
    await saveSourceScrapedAt(updates).catch(() => {})
  }

  // Log all failures
  if (allScraperFailed.length > 0) {
    const rateLimitCount = allScraperFailed.filter((f) => f.isRateLimit).length
    console.warn(
      `[scrapers] ${allScraperFailed.length} source(s) failed (${rateLimitCount} rate-limited):`,
      allScraperFailed.map((f) => `${f.slug}${f.isRateLimit ? ' [429]' : ''}`).join(', ')
    )
    await logFailedSources(allScraperFailed).catch(() => {})
  } else {
    await logFailedSources([]).catch(() => {})
  }

  // Merge fresh events with cached events + fallback events
  // "cached" = either (a) fresh sources not re-scraped this run, or
  //             (b) stale sources that weren't in the current batch (SOURCES_PER_RUN cap)
  const batchedSlugs = new Set([...staleCalSources, ...staleUserSources])
  const cachedSourceEvents: LondonEvent[] = []
  for (const slug of [...allCalSources, ...allUserSources]) {
    const useCached = isFresh(slug)
      ? !failedSlugs.has(slug)           // fresh: use unless just failed
      : !batchedSlugs.has(slug)          // stale: use if not in this run's batch
    if (useCached) {
      cachedSourceEvents.push(...(existingBySlug.get(slug) ?? []))
    }
  }

  // Pass 1: ID-based dedup (curated:true wins)
  const seen = new Map<string, LondonEvent>()
  for (const event of [...freshEvents, ...fallbackEvents, ...cachedSourceEvents]) {
    const existing = seen.get(event.id)
    if (!existing || (!existing.curated && event.curated)) {
      seen.set(event.id, event)
    }
  }

  // Pass 2: slug-based dedup — catches cv- vs evt- duplicates
  const deduped = dedupeBySlug([...seen.values()])
  const events = deduped.filter((e) => !blockSet.has(e.id))

  return {
    events,
    failed: allScraperFailed,
    stats: {
      total: events.length,
      fresh: freshEvents.length,
      cached: fallbackEvents.length + cachedSourceEvents.length,
      failedCount: allScraperFailed.length,
    },
  }
}
