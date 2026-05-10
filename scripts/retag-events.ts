/**
 * Re-applies sector tagging over events stored in Redis.
 *
 * Covers BOTH `events:london` (cron output) and `events:manual` (events
 * promoted via `/review-events` or added via `/add-events`).
 *
 *   npm run retag-events            # KB-only refresh, no LLM spend
 *   npm run retag-events -- --reset # blank existing tags + clear LLM cache,
 *                                   # then run KB → LLM → candidates pipeline
 *
 * Use the default form after editing KB rows (`event_series.sectors`,
 * `communities.sectors`) or after promoting candidates via the
 * `/promote-organisers` skill — KB-known events flip to deterministic tags
 * without re-spending tokens.
 *
 * Use `--reset` after editing the tagger prompt or sector taxonomy — wipes
 * all per-event LLM caches and re-runs the full pipeline. Costs Haiku tokens.
 */
import { Redis } from '@upstash/redis'
import { getRawEvents, getManualEvents, saveEvents } from '../src/lib/kv'
import { loadInheritanceMap } from '../src/lib/scrapers/sector-inheritance'
import { applyWithMap } from '../src/lib/scrapers/sector-pipeline'
import { clearCachedSectorTags } from '../src/lib/kv-candidates'
import type { LondonEvent } from '../src/lib/types'

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

async function saveManualEvents(events: LondonEvent[]) {
  await redis.set('events:manual', JSON.stringify(events))
}

async function main() {
  const reset = process.argv.includes('--reset')

  console.log('Loading events from KV...')
  const [autoEvents, manualEvents] = await Promise.all([getRawEvents(), getManualEvents()])
  console.log(`Loaded ${autoEvents.length} cron events, ${manualEvents.length} manual events`)

  console.log('Loading KB inheritance map...')
  const map = await loadInheritanceMap()
  console.log(`KB: ${map.stats.eventSeries} event_series, ${map.stats.communities} communities`)

  if (reset) {
    console.log('--reset: clearing per-event LLM cache + sectorTags...')
    const all = [...autoEvents, ...manualEvents]
    for (const e of all) {
      if (e.curated) await clearCachedSectorTags(e.id)
    }
  }

  // Process each set; with --reset we run the full pipeline (KB + LLM); without,
  // KB-only and preserve existing LLM tags on misses.
  async function processSet(events: LondonEvent[], label: string) {
    if (events.length === 0) {
      console.log(`[${label}] no events to process`)
      return events
    }
    const prepared: LondonEvent[] = reset
      ? events.map((e) => ({ ...e, sectorTags: undefined }))
      : events
    const result = await applyWithMap(prepared, map, { skipLLM: !reset })

    // Without --reset: where KB missed but original had LLM tags, keep them.
    const merged: LondonEvent[] = result.events.map((tagged, i) => {
      if (!tagged.curated || reset) return tagged
      const original = events[i]
      const taggedSectors = tagged.sectorTags ?? []
      if (taggedSectors.length === 0 && original.sectorTags && original.sectorTags.length > 0) {
        return { ...tagged, sectorTags: original.sectorTags }
      }
      return tagged
    })

    const s = result.stats
    console.log(
      `[${label}] ${s.inherited}/${s.total} from KB; ` +
      `${s.cachedFromLLM} cached, ${s.taggedByLLM} freshly LLM-tagged, ${s.orphansAfterLLM} orphan`
    )
    return merged
  }

  const newAuto = await processSet(autoEvents, 'cron')
  const newManual = await processSet(manualEvents, 'manual')

  console.log('Saving back to KV...')
  await Promise.all([saveEvents(newAuto), saveManualEvents(newManual)])
  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
