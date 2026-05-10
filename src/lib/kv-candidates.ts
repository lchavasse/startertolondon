/**
 * Redis-backed candidate queue for KB ingestion.
 *
 * Every time the LLM tags an orphan event (an event whose source has no
 * matching `event_series` or `community` in Supabase), we upsert the
 * organiser into `kb:event-series-candidates`. The `/promote-organisers`
 * skill reads this queue, ranks by `eventCount`, and walks the user
 * through accept/skip/reject.
 *
 * On promotion, the user writes the organiser into `docs/kb-seeds/*.md`,
 * runs `npm run seed:kb`, then `npm run retag-events` flips all past
 * events from this source to deterministic KB inheritance.
 */
import { Redis } from '@upstash/redis'
import { isSector, type Sector } from './sectors'

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

const CANDIDATES_KEY = 'kb:event-series-candidates'
const REJECTED_KEY = 'kb:event-series-rejected'
const SECTOR_CACHE_PREFIX = 'event:sectors:'
const SAMPLE_LIMIT = 5

export interface Candidate {
  /** Stable key — calendarSlug if present, else organiserName-normalised. */
  key: string
  organiserName: string
  organiserAvatarUrl: string | null
  /** Resolved Luma cal-id if we have one (lets the user paste it straight into kb-seeds). */
  lumaCalId: string | null
  /** Source-platform key prefix: 'luma-cal', 'luma-user', 'eventbrite', 'meetup', etc. */
  sourceKind: string
  firstSeenAt: string
  lastSeenAt: string
  eventCount: number
  sampleEventIds: string[]
  sampleEventNames: string[]
  /** Tally of LLM-suggested sectors across observed events; majority wins on display. */
  suggestedSectors: Partial<Record<Sector, number>>
}

export interface CandidateUpsert {
  key: string
  organiserName: string
  organiserAvatarUrl: string | null
  lumaCalId: string | null
  sourceKind: string
  eventId: string
  eventName: string
  suggestedSectors: readonly Sector[]
  observedAt: string
}

function isCandidate(value: unknown): value is Candidate {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v.key === 'string' && typeof v.eventCount === 'number'
}

export async function getRejectedKeys(): Promise<Set<string>> {
  const raw = await redis.get<string | string[]>(REJECTED_KEY)
  if (!raw) return new Set()
  const list = typeof raw === 'string' ? (JSON.parse(raw) as string[]) : raw
  return new Set(list)
}

export async function rejectCandidate(key: string): Promise<void> {
  const rejected = await getRejectedKeys()
  rejected.add(key)
  await redis.set(REJECTED_KEY, JSON.stringify([...rejected]))
  await removeCandidate(key)
}

export async function listCandidates(): Promise<Candidate[]> {
  const raw = await redis.hgetall<Record<string, string | Candidate>>(CANDIDATES_KEY)
  if (!raw) return []
  const out: Candidate[] = []
  for (const value of Object.values(raw)) {
    const parsed = typeof value === 'string' ? (JSON.parse(value) as unknown) : (value as unknown)
    if (isCandidate(parsed)) out.push(parsed)
  }
  return out.sort((a, b) => b.eventCount - a.eventCount)
}

export async function removeCandidate(key: string): Promise<void> {
  await redis.hdel(CANDIDATES_KEY, key)
}

/**
 * Upsert a single candidate. Idempotent: re-observing the same eventId is
 * a no-op (eventCount only increments on first sighting).
 */
export async function upsertCandidate(input: CandidateUpsert): Promise<void> {
  const rejected = await getRejectedKeys()
  if (rejected.has(input.key)) return

  const existingRaw = await redis.hget<string | Candidate>(CANDIDATES_KEY, input.key)
  const existing: Candidate | null = existingRaw
    ? typeof existingRaw === 'string'
      ? (JSON.parse(existingRaw) as Candidate)
      : (existingRaw as Candidate)
    : null

  let next: Candidate
  if (existing) {
    const alreadySeen = existing.sampleEventIds.includes(input.eventId)
    const sampleEventIds = alreadySeen
      ? existing.sampleEventIds
      : [input.eventId, ...existing.sampleEventIds].slice(0, SAMPLE_LIMIT)
    const sampleEventNames = alreadySeen
      ? existing.sampleEventNames
      : [input.eventName, ...existing.sampleEventNames].slice(0, SAMPLE_LIMIT)
    const suggestedSectors = { ...existing.suggestedSectors }
    for (const s of input.suggestedSectors) {
      if (!isSector(s)) continue
      suggestedSectors[s] = (suggestedSectors[s] ?? 0) + 1
    }
    next = {
      ...existing,
      organiserName: input.organiserName || existing.organiserName,
      organiserAvatarUrl: input.organiserAvatarUrl ?? existing.organiserAvatarUrl,
      lumaCalId: input.lumaCalId ?? existing.lumaCalId,
      sourceKind: input.sourceKind || existing.sourceKind,
      lastSeenAt: input.observedAt,
      eventCount: alreadySeen ? existing.eventCount : existing.eventCount + 1,
      sampleEventIds,
      sampleEventNames,
      suggestedSectors,
    }
  } else {
    const suggestedSectors: Partial<Record<Sector, number>> = {}
    for (const s of input.suggestedSectors) {
      if (!isSector(s)) continue
      suggestedSectors[s] = (suggestedSectors[s] ?? 0) + 1
    }
    next = {
      key: input.key,
      organiserName: input.organiserName,
      organiserAvatarUrl: input.organiserAvatarUrl,
      lumaCalId: input.lumaCalId,
      sourceKind: input.sourceKind,
      firstSeenAt: input.observedAt,
      lastSeenAt: input.observedAt,
      eventCount: 1,
      sampleEventIds: [input.eventId],
      sampleEventNames: [input.eventName],
      suggestedSectors,
    }
  }

  await redis.hset(CANDIDATES_KEY, { [input.key]: JSON.stringify(next) })
}

// ─── Per-event sector-tag cache (idempotency for cron re-runs) ───────────────

export async function getCachedSectorTags(eventId: string): Promise<Sector[] | null> {
  const raw = await redis.get<string | string[]>(`${SECTOR_CACHE_PREFIX}${eventId}`)
  if (!raw) return null
  const list = typeof raw === 'string' ? (JSON.parse(raw) as string[]) : raw
  return list.filter(isSector)
}

export async function setCachedSectorTags(eventId: string, sectors: readonly Sector[]): Promise<void> {
  // Cache for 90 days — covers a re-run after a long break, refreshed on subsequent runs.
  await redis
    .set(`${SECTOR_CACHE_PREFIX}${eventId}`, JSON.stringify(sectors), { ex: 60 * 60 * 24 * 90 })
    .catch(() => {})
}

export async function clearCachedSectorTags(eventId: string): Promise<void> {
  await redis.del(`${SECTOR_CACHE_PREFIX}${eventId}`).catch(() => {})
}
