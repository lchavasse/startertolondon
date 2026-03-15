import { Redis } from '@upstash/redis'
import { LondonEvent, CommunitySource, FailedSource } from '@/lib/types'

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

// Raw events (no filtering — for scraper fallback use)
export async function getRawEvents(): Promise<LondonEvent[]> {
  const raw = await redis.get<string>('events:london')
  if (!raw) return []
  return typeof raw === 'string' ? JSON.parse(raw) : raw
}

// Scraped events
export async function saveEvents(events: LondonEvent[]): Promise<void> {
  const sorted = [...events].sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  )
  await redis.set('events:london', JSON.stringify(sorted))
}

export async function getEvents(): Promise<LondonEvent[]> {
  const [rawAuto, rawManual, rawOverrides] = await Promise.all([
    redis.get<string>('events:london'),
    redis.get<string>('events:manual'),
    redis.get<string>('events:curated-overrides'),
  ])

  const autoEvents: LondonEvent[] = rawAuto
    ? typeof rawAuto === 'string' ? JSON.parse(rawAuto) : rawAuto
    : []
  const manualEvents: LondonEvent[] = rawManual
    ? typeof rawManual === 'string' ? JSON.parse(rawManual) : rawManual
    : []
  const overrides: Record<string, boolean> = rawOverrides
    ? typeof rawOverrides === 'string' ? JSON.parse(rawOverrides) : rawOverrides
    : {}

  // Merge: manual wins over auto for same id
  // Manual events default to pending:true unless explicitly set to false
  const seen = new Map<string, LondonEvent>()
  for (const e of autoEvents) seen.set(e.id, e)
  for (const e of manualEvents) seen.set(e.id, { ...e, pending: e.pending !== false })

  const rawBlocklist = await redis.get<string>('events:blocklist')
  const blocklist: string[] = rawBlocklist
    ? typeof rawBlocklist === 'string' ? JSON.parse(rawBlocklist) : rawBlocklist
    : []
  const blockSet = new Set(blocklist)

  const cutoff = new Date(Date.now() - 60 * 60 * 1000)

  return [...seen.values()]
    .filter((e) => new Date(e.startAt) >= cutoff && !blockSet.has(e.id))
    .map((e) => (e.id in overrides ? { ...e, curated: overrides[e.id] } : e))
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
}

// Community sources
export async function getCommunitySources(): Promise<CommunitySource[]> {
  const raw = await redis.get<string>('sources:community')
  if (!raw) return []
  return typeof raw === 'string' ? JSON.parse(raw) : raw
}

export async function addCommunitySource(source: CommunitySource): Promise<void> {
  const current = await getCommunitySources()
  const exists = current.find((s) => s.slug === source.slug && s.type === source.type)
  if (!exists) {
    current.push(source)
    await redis.set('sources:community', JSON.stringify(current))
  }
}

export async function removeCommunitySource(slug: string): Promise<void> {
  const current = await getCommunitySources()
  await redis.set('sources:community', JSON.stringify(current.filter((s) => s.slug !== slug)))
}

export async function updateCommunitySource(slug: string, patch: Partial<CommunitySource>): Promise<void> {
  const current = await getCommunitySources()
  const idx = current.findIndex((s) => s.slug === slug)
  if (idx !== -1) {
    current[idx] = { ...current[idx], ...patch }
    await redis.set('sources:community', JSON.stringify(current))
  }
}

// Manual events
export async function getManualEvents(): Promise<LondonEvent[]> {
  const raw = await redis.get<string>('events:manual')
  if (!raw) return []
  return typeof raw === 'string' ? JSON.parse(raw) : raw
}

export async function addManualEvent(event: LondonEvent): Promise<void> {
  const current = await getManualEvents()
  const exists = current.find((e) => e.id === event.id)
  if (!exists) {
    current.push(event)
    await redis.set('events:manual', JSON.stringify(current))
  }
}

export async function removeManualEvent(id: string): Promise<void> {
  const current = await getManualEvents()
  await redis.set('events:manual', JSON.stringify(current.filter((e) => e.id !== id)))
}

export async function updateManualEvent(id: string, patch: Partial<LondonEvent>): Promise<void> {
  const current = await getManualEvents()
  const idx = current.findIndex((e) => e.id === id)
  if (idx !== -1) {
    current[idx] = { ...current[idx], ...patch }
    await redis.set('events:manual', JSON.stringify(current))
  }
}

// Curated overrides (survive scrapes)
export async function getCuratedOverrides(): Promise<Record<string, boolean>> {
  const raw = await redis.get<string>('events:curated-overrides')
  if (!raw) return {}
  return typeof raw === 'string' ? JSON.parse(raw) : raw
}

export async function setCuratedOverride(id: string, curated: boolean): Promise<void> {
  const current = await getCuratedOverrides()
  current[id] = curated
  await redis.set('events:curated-overrides', JSON.stringify(current))
}

// System source curated overrides
export async function getSystemSourceOverrides(): Promise<Record<string, boolean>> {
  const raw = await redis.get<string>('sources:system-overrides')
  if (!raw) return {}
  return typeof raw === 'string' ? JSON.parse(raw) : raw
}

export async function setSystemSourceOverride(slug: string, curated: boolean): Promise<void> {
  const current = await getSystemSourceOverrides()
  current[slug] = curated
  await redis.set('sources:system-overrides', JSON.stringify(current))
}

// Blocklist
export async function getBlocklist(): Promise<string[]> {
  const raw = await redis.get<string>('events:blocklist')
  if (!raw) return []
  return typeof raw === 'string' ? JSON.parse(raw) : raw
}

export async function addToBlocklist(id: string): Promise<void> {
  const current = await getBlocklist()
  if (!current.includes(id)) {
    current.push(id)
    await redis.set('events:blocklist', JSON.stringify(current))
  }
}

export async function removeFromBlocklist(id: string): Promise<void> {
  const current = await getBlocklist()
  await redis.set('events:blocklist', JSON.stringify(current.filter((i) => i !== id)))
}

// Failed sources
export async function getFailedSources(): Promise<FailedSource[]> {
  const raw = await redis.get<string>('sources:failed')
  if (!raw) return []
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw
  // Backwards compat: old format was string[]
  if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'string') {
    return (data as string[]).map((slug) => ({ slug, error: 'unknown', isRateLimit: false, timestamp: '' }))
  }
  return data as FailedSource[]
}

export async function logFailedSources(failures: FailedSource[]): Promise<void> {
  await redis.set('sources:failed', JSON.stringify(failures))
}

// Channel-id cache (slug → { type, id }) to avoid re-fetching luma.com channel pages
export type ChannelCacheEntry = { type: 'discovery'; id: string } | { type: 'calendar'; id: string }

export async function getChannelIdCache(): Promise<Record<string, ChannelCacheEntry>> {
  const raw = await redis.get<string>('sources:channel-ids')
  if (!raw) return {}
  return typeof raw === 'string' ? JSON.parse(raw) : raw
}

export async function saveChannelIdCache(updates: Record<string, ChannelCacheEntry>): Promise<void> {
  const current = await getChannelIdCache()
  await redis.set('sources:channel-ids', JSON.stringify({ ...current, ...updates }))
}

// Cal-id cache (slug → cal-id) to avoid re-fetching luma.com pages
export async function getCalIdCache(): Promise<Record<string, string>> {
  const raw = await redis.get<string>('sources:cal-ids')
  if (!raw) return {}
  return typeof raw === 'string' ? JSON.parse(raw) : raw
}

export async function saveCalIdCache(updates: Record<string, string>): Promise<void> {
  const current = await getCalIdCache()
  await redis.set('sources:cal-ids', JSON.stringify({ ...current, ...updates }))
}

// Per-source scrape timestamps (used to skip re-fetching fresh sources)
export async function getSourceScrapedAt(): Promise<Record<string, string>> {
  const raw = await redis.get<string>('sources:scraped-at')
  if (!raw) return {}
  return typeof raw === 'string' ? JSON.parse(raw) : raw
}

export async function saveSourceScrapedAt(updates: Record<string, string>): Promise<void> {
  const current = await getSourceScrapedAt()
  await redis.set('sources:scraped-at', JSON.stringify({ ...current, ...updates }))
}
