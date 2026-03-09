import { Redis } from '@upstash/redis'
import { LondonEvent } from '@/lib/types'

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

const KEY = 'events:london'

export async function saveEvents(events: LondonEvent[]): Promise<void> {
  const sorted = [...events].sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  )
  await redis.set(KEY, JSON.stringify(sorted))
}

export async function getEvents(): Promise<LondonEvent[]> {
  const raw = await redis.get<string>(KEY)
  if (!raw) return []

  const events: LondonEvent[] = typeof raw === 'string' ? JSON.parse(raw) : raw
  const cutoff = new Date(Date.now() - 60 * 60 * 1000)

  return events.filter((e) => new Date(e.startAt) >= cutoff)
}
