/**
 * Add manual events to the events:manual KV path.
 *
 * Reads a JSON array of event input objects (file path or stdin), shapes each
 * into a LondonEvent, and upserts via existing addManualEvent / updateManualEvent
 * helpers. IDs are deterministic (`manual-<sha1(url|startAt)>`) so re-runs are
 * idempotent. Updates preserve the existing `pending` flag so admin approvals
 * aren't trampled. IDs in events:blocklist are skipped.
 *
 * Usage:
 *   npm run add-event -- path/to/events.json
 *   echo '[{...}]' | npm run add-event -- -
 *   npm run add-event -- path/to/events.json --dry-run
 */
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import {
  getManualEvents,
  getBlocklist,
  addManualEvent,
  updateManualEvent,
} from '../src/lib/kv'
import type { LondonEvent } from '../src/lib/types'

interface EventInput {
  name: string
  startAt: string
  url: string
  locationName: string
  endAt?: string
  coverUrl?: string | null
  organiserName?: string
  organiserAvatarUrl?: string | null
  tags?: string[]
  timezone?: string
  calendarSlug?: string
  pending?: boolean
  curated?: boolean
}

function mintId(url: string, startAt: string): string {
  const hash = createHash('sha1').update(`${url}|${startAt}`).digest('hex').slice(0, 12)
  return `manual-${hash}`
}

function shape(input: EventInput): LondonEvent {
  if (!input.name) throw new Error(`event missing 'name'`)
  if (!input.startAt) throw new Error(`event '${input.name}' missing 'startAt'`)
  if (!input.url) throw new Error(`event '${input.name}' missing 'url'`)
  if (!input.locationName) throw new Error(`event '${input.name}' missing 'locationName'`)

  const startMs = new Date(input.startAt).getTime()
  if (isNaN(startMs)) throw new Error(`event '${input.name}' has invalid startAt: ${input.startAt}`)
  const endAt = input.endAt ?? new Date(startMs + 2 * 60 * 60 * 1000).toISOString()

  return {
    id: mintId(input.url, input.startAt),
    name: input.name,
    startAt: input.startAt,
    endAt,
    timezone: input.timezone ?? 'Europe/London',
    url: input.url,
    coverUrl: input.coverUrl ?? null,
    locationName: input.locationName,
    city: 'London',
    organiserName: input.organiserName ?? '',
    organiserAvatarUrl: input.organiserAvatarUrl ?? null,
    tags: input.tags ?? [],
    source: 'other',
    calendarSlug: input.calendarSlug,
    scrapedAt: new Date().toISOString(),
    curated: input.curated ?? true,
    pending: input.pending ?? false,
  }
}

async function readInput(arg: string | undefined): Promise<EventInput[]> {
  let raw: string
  if (arg && arg !== '-') {
    raw = readFileSync(arg, 'utf8')
  } else {
    const chunks: Buffer[] = []
    for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
    raw = Buffer.concat(chunks).toString('utf8')
  }
  const parsed = JSON.parse(raw)
  if (!Array.isArray(parsed)) throw new Error('Input must be a JSON array of events')
  return parsed as EventInput[]
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const inputArg = args.find((a) => !a.startsWith('--'))
  const inputs = await readInput(inputArg)

  console.log(`Parsed ${inputs.length} event(s)`)

  const [existing, blocklist] = await Promise.all([getManualEvents(), getBlocklist()])
  const existingById = new Map(existing.map((e) => [e.id, e]))
  const blockSet = new Set(blocklist)

  let added = 0
  let updated = 0
  let blocked = 0

  for (const input of inputs) {
    const event = shape(input)
    if (blockSet.has(event.id)) {
      console.log(`  [skip blocked] ${event.name}`)
      blocked++
      continue
    }
    const prior = existingById.get(event.id)
    if (prior) {
      const next: LondonEvent = { ...event, pending: prior.pending }
      if (!dryRun) await updateManualEvent(event.id, next)
      console.log(`  [update] ${event.name}`)
      updated++
    } else {
      if (!dryRun) await addManualEvent(event)
      console.log(`  [add]    ${event.name}`)
      added++
    }
  }

  console.log(`\n${dryRun ? '[dry-run] would: ' : ''}${added} added · ${updated} updated · ${blocked} blocked`)
}

main().catch((err) => {
  console.error(err.message ?? err)
  process.exit(1)
})
