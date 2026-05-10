/**
 * Stamps `sectorTags` on curated events.
 *
 * Two-stage pipeline:
 *   1. KB inheritance — deterministic match against `event_series` /
 *      `communities` rows. Free, instant.
 *   2. LLM fallback — for orphan events (no KB match), fetch the event
 *      description from luma.com and ask Haiku for 1–3 sectors. Result
 *      cached in Redis (`event:sectors:<id>`) so cron re-runs don't
 *      re-spend tokens. Each orphan organiser is upserted into
 *      `kb:event-series-candidates` for promotion via the skill.
 *
 * Idempotent — re-running on the same events with the same KB state is a
 * no-op (cached LLM tags are reused).
 */
import type { Sector } from '@/lib/sectors'
import type { LondonEvent } from '@/lib/types'
import { tagEvents } from '@/lib/llm/sector-tagger'
import {
  getCachedSectorTags,
  setCachedSectorTags,
  upsertCandidate,
  type CandidateUpsert,
} from '@/lib/kv-candidates'
import { fetchEventDescriptions } from './luma-event-fetch'
import { loadInheritanceMap, type InheritanceMap } from './sector-inheritance'

export interface SectorPipelineStats {
  total: number
  inherited: number
  cachedFromLLM: number
  taggedByLLM: number
  orphansAfterLLM: number
  kbStats: { eventSeries: number; communities: number }
}

export interface SectorPipelineResult {
  events: LondonEvent[]
  stats: SectorPipelineStats
}

export interface SectorPipelineOptions {
  /** Skip LLM + description fetch + candidate upsert. Used by `retag-events` for KB-only refreshes. */
  skipLLM?: boolean
}

/**
 * Apply inheritance + LLM fallback to every curated event in `events`.
 * Non-curated events pass through untouched. Returns a new array — does
 * not mutate inputs.
 */
export async function applySectorTagging(
  events: LondonEvent[],
  options: SectorPipelineOptions = {}
): Promise<SectorPipelineResult> {
  const map = await loadInheritanceMap()
  return applyWithMap(events, map, options)
}

export async function applyWithMap(
  events: LondonEvent[],
  map: InheritanceMap,
  options: SectorPipelineOptions = {}
): Promise<SectorPipelineResult> {
  // Phase 1: split into inherited vs orphans.
  let inherited = 0
  const orphanIndices: number[] = []
  const out: LondonEvent[] = events.map((event, i) => {
    if (!event.curated) return event
    const sectors = map.match(event)
    if (sectors) {
      inherited++
      return { ...event, sectorTags: sectors }
    }
    orphanIndices.push(i)
    return { ...event, sectorTags: [] }
  })

  if (options.skipLLM || orphanIndices.length === 0) {
    return {
      events: out,
      stats: {
        total: events.filter((e) => e.curated).length,
        inherited,
        cachedFromLLM: 0,
        taggedByLLM: 0,
        orphansAfterLLM: orphanIndices.length,
        kbStats: map.stats,
      },
    }
  }

  // Phase 2: cached LLM results (no API call needed).
  const orphans = orphanIndices.map((i) => events[i])
  const stillOrphan: LondonEvent[] = []
  let cachedFromLLM = 0

  for (let k = 0; k < orphans.length; k++) {
    const event = orphans[k]
    const cached = await getCachedSectorTags(event.id)
    if (cached !== null) {
      out[orphanIndices[k]] = { ...out[orphanIndices[k]], sectorTags: cached }
      cachedFromLLM++
    } else {
      stillOrphan.push(event)
    }
  }

  let taggedByLLM = 0
  let orphansAfterLLM = stillOrphan.length

  if (stillOrphan.length > 0) {
    // Phase 3: fetch descriptions (bounded concurrency) + run LLM tagger.
    const descriptions = await fetchEventDescriptions(
      stillOrphan.map((e) => ({ id: e.id, url: e.url }))
    )
    const tagged = await tagEvents(stillOrphan, descriptions)
    const taggedById = new Map(tagged.map((t) => [t.eventId, t]))

    for (let k = 0; k < stillOrphan.length; k++) {
      const event = stillOrphan[k]
      const result = taggedById.get(event.id)
      const sectors: Sector[] = result?.sectors ?? []
      const idxInOut = orphanIndices.find((i) => events[i].id === event.id)
      if (idxInOut !== undefined) {
        out[idxInOut] = { ...out[idxInOut], sectorTags: sectors }
      }
      // Cache regardless of confidence — empty array is a valid stable answer.
      await setCachedSectorTags(event.id, sectors)
      if (sectors.length > 0) taggedByLLM++

      // Upsert candidate — even if sectors=[] we still want to surface the
      // organiser for promotion (a low-confidence orphan is still a KB gap).
      await upsertCandidate(buildCandidateUpsert(event, sectors))
    }

    orphansAfterLLM = stillOrphan.length - taggedByLLM
  }

  return {
    events: out,
    stats: {
      total: events.filter((e) => e.curated).length,
      inherited,
      cachedFromLLM,
      taggedByLLM,
      orphansAfterLLM,
      kbStats: map.stats,
    },
  }
}

function buildCandidateUpsert(event: LondonEvent, sectors: readonly Sector[]): CandidateUpsert {
  const slug = event.calendarSlug?.toLowerCase().trim() ?? ''
  const calId = slug.match(/cal-[a-z0-9]+/i)?.[0] ?? null
  const sourceKind = sourceKindFor(event)
  // Key prefers a stable platform identifier; falls back to organiser name.
  const fallbackKey = slug || event.organiserName.toLowerCase().replace(/\s+/g, '-') || event.id
  const key = calId ?? fallbackKey

  return {
    key,
    organiserName: event.organiserName || slug || '(unknown)',
    organiserAvatarUrl: event.organiserAvatarUrl,
    lumaCalId: calId,
    sourceKind,
    eventId: event.id,
    eventName: event.name,
    suggestedSectors: sectors,
    observedAt: new Date().toISOString(),
  }
}

function sourceKindFor(event: LondonEvent): string {
  switch (event.source) {
    case 'luma-calendar':
    case 'luma-discovery':
      return 'luma-cal'
    case 'luma-profile':
      return 'luma-user'
    case 'eventbrite':
      return 'eventbrite'
    case 'meetup':
      return 'meetup'
    case 'cerebral-valley':
      return 'cerebral-valley'
    default:
      return 'other'
  }
}
