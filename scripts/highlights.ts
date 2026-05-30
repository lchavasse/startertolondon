/**
 * Highlights data fetcher for the event-highlights skill.
 *
 * Pulls curated events for a date range, optionally filters by user-supplied
 * names, fetches Luma event pages for host info, looks up KB matches, and
 * prints a structured JSON bundle to stdout. The skill (driven by Claude)
 * does the voice-matched drafting on top of this output.
 *
 * Usage:
 *   npm run highlights -- [--from YYYY-MM-DD] [--to YYYY-MM-DD]
 *                          [--match "name1, name2, ..."] [--top N]
 *                          [--curated-only] [--no-handles]
 */

import { readFileSync, existsSync } from 'node:fs'
import { parse } from 'yaml'
import { getEvents } from '../src/lib/kv'
import { supabase } from '../src/lib/supabase'
import type { LondonEvent } from '../src/lib/types'

interface Host {
  name: string
  username?: string
  lumaUserId?: string
  twitter?: string
  linkedin?: string
  kbMatch?: 'people' // future: 'companies', 'vcs', etc.
  registryMatch?: boolean // twitter/linkedin came from docs/social-handles.yml
}

const REGISTRY_PATH = 'docs/social-handles.yml'

interface RegistryEntry {
  x: string
  match: string[]
  linkedin?: string
  credit?: string
}

/** alias (lowercased) → handle entry, from the harvested registry. */
function loadHandleRegistry(): Map<string, RegistryEntry> {
  const index = new Map<string, RegistryEntry>()
  if (!existsSync(REGISTRY_PATH)) return index
  const parsed = parse(readFileSync(REGISTRY_PATH, 'utf8')) as
    | { handles?: RegistryEntry[] }
    | null
  for (const entry of parsed?.handles ?? []) {
    for (const alias of entry.match ?? []) {
      index.set(alias.toLowerCase(), entry)
    }
  }
  return index
}

/** Fill twitter/linkedin from the registry when KB didn't already. */
function enrichHostsFromRegistry(
  hosts: Host[],
  registry: Map<string, RegistryEntry>
): Host[] {
  if (registry.size === 0) return hosts
  return hosts.map((h) => {
    if (h.twitter) return h // KB / people-table wins
    const entry =
      (h.username && registry.get(h.username.toLowerCase())) ||
      registry.get(h.name.toLowerCase())
    if (!entry) return h
    return {
      ...h,
      twitter: entry.x,
      linkedin: entry.linkedin ?? h.linkedin,
      registryMatch: true,
    }
  })
}

interface KbHint {
  table: 'communities' | 'vcs' | 'companies'
  slug: string
  name: string
  twitter?: string
  linkedin?: string
}

interface Highlight {
  event: LondonEvent
  hosts: Host[]
  kbHints: KbHint[]
  weekday: string // e.g. "Mon 5"
}

interface Args {
  from: Date
  to: Date
  match: string[]
  top: number
  curatedOnly: boolean
  noHandles: boolean
}

const PAGE_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string) => {
    const idx = argv.indexOf(flag)
    return idx >= 0 ? argv[idx + 1] : undefined
  }

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const fromStr = get('--from')
  const toStr = get('--to')
  const from = fromStr ? new Date(fromStr) : today
  const to = toStr
    ? new Date(toStr)
    : new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000)

  const matchStr = get('--match') ?? ''
  const match = matchStr
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)

  return {
    from,
    to,
    match,
    top: parseInt(get('--top') ?? '12', 10),
    curatedOnly: argv.includes('--curated-only'),
    noHandles: argv.includes('--no-handles'),
  }
}

function inRange(e: LondonEvent, from: Date, to: Date): boolean {
  const t = new Date(e.startAt).getTime()
  return t >= from.getTime() && t < to.getTime()
}

function fuzzyScore(event: LondonEvent, term: string): number {
  const haystack = [event.name, event.organiserName, event.calendarSlug ?? '']
    .join(' ')
    .toLowerCase()
  return haystack.includes(term) ? 1 : 0
}

function pickByMatch(events: LondonEvent[], match: string[]): LondonEvent[] {
  const picks: LondonEvent[] = []
  const seen = new Set<string>()
  for (const term of match) {
    const scored = events
      .map((e) => ({ e, s: fuzzyScore(e, term) }))
      .filter((x) => x.s > 0 && !seen.has(x.e.id))
      .sort((a, b) => new Date(a.e.startAt).getTime() - new Date(b.e.startAt).getTime())
    if (scored.length === 0) {
      console.warn(`[highlights] no match for: "${term}"`)
      continue
    }
    const top = scored[0].e
    picks.push(top)
    seen.add(top.id)
  }
  return picks
}

function pickByAuto(events: LondonEvent[], top: number): LondonEvent[] {
  // v1 ranking: curated wins, otherwise chronological
  const sorted = [...events].sort((a, b) => {
    if (a.curated !== b.curated) return a.curated ? -1 : 1
    return new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  })
  return sorted.slice(0, top)
}

function weekdayLabel(iso: string): string {
  const d = new Date(iso)
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return `${days[d.getUTCDay()]} ${d.getUTCDate()}`
}

/** Walk a JSON object and collect anything that looks like a Luma user host. */
function findHostsInJson(json: unknown): Host[] {
  const found = new Map<string, Host>() // dedupe by username or name
  const visit = (node: unknown, parentKey?: string) => {
    if (!node) return
    if (Array.isArray(node)) {
      for (const item of node) visit(item, parentKey)
      return
    }
    if (typeof node !== 'object') return
    const obj = node as Record<string, unknown>

    // Heuristic: a host node has a name + (api_id starting usr- OR a username)
    const apiId = typeof obj.api_id === 'string' ? obj.api_id : undefined
    const username = typeof obj.username === 'string' ? obj.username : undefined
    const name = typeof obj.name === 'string' ? obj.name : undefined
    const isHostContext =
      parentKey === 'hosts' ||
      parentKey === 'host_info' ||
      parentKey === 'admins' ||
      parentKey === 'calendar_admins' ||
      obj.is_host === true ||
      obj.is_admin === true

    if (
      isHostContext &&
      name &&
      (apiId?.startsWith('usr-') || username)
    ) {
      const key = username ?? apiId ?? name
      if (!found.has(key)) {
        found.set(key, { name, username, lumaUserId: apiId })
      }
    }

    for (const [k, v] of Object.entries(obj)) visit(v, k)
  }
  visit(json)
  return [...found.values()]
}

async function fetchEventHosts(eventUrl: string): Promise<Host[]> {
  // eventUrl is https://lu.ma/<slug>
  try {
    const res = await fetch(eventUrl, {
      headers: PAGE_HEADERS,
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return []
    const html = await res.text()
    const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
    if (!match) return []
    let data: unknown
    try {
      data = JSON.parse(match[1])
    } catch {
      return []
    }
    return findHostsInJson(data)
  } catch (err) {
    console.warn(`[highlights] host fetch failed for ${eventUrl}:`, err)
    return []
  }
}

async function enrichHostsFromKb(hosts: Host[]): Promise<Host[]> {
  if (hosts.length === 0) return hosts

  const lumaIds = hosts.map((h) => h.lumaUserId).filter((x): x is string => !!x)
  const names = hosts.map((h) => h.name).filter(Boolean)

  // Two queries: by luma_user_ids overlap, then by name ilike for the rest.
  const byId = lumaIds.length
    ? await supabase
        .from('people')
        .select('name, twitter, linkedin, luma_user_ids')
        .overlaps('luma_user_ids', lumaIds)
    : { data: [] as Array<{ name: string; twitter: string | null; linkedin: string | null; luma_user_ids: string[] | null }> }

  const byName = names.length
    ? await supabase
        .from('people')
        .select('name, twitter, linkedin, luma_user_ids')
        .in('name', names)
    : { data: [] }

  const matches = [...(byId.data ?? []), ...(byName.data ?? [])]

  return hosts.map((h) => {
    const m = matches.find(
      (p) =>
        (h.lumaUserId && (p.luma_user_ids ?? []).includes(h.lumaUserId)) ||
        (h.name && p.name.toLowerCase() === h.name.toLowerCase())
    )
    if (!m) return h
    return {
      ...h,
      twitter: m.twitter ?? undefined,
      linkedin: m.linkedin ?? undefined,
      kbMatch: 'people' as const,
    }
  })
}

async function lookupOrganiserKb(organiserName: string): Promise<KbHint[]> {
  if (!organiserName) return []
  const hints: KbHint[] = []
  const tables: Array<KbHint['table']> = ['communities', 'vcs', 'companies']
  for (const table of tables) {
    // communities/vcs have no twitter/linkedin cols; companies has only linkedin.
    // Hints don't carry social handles — those come from lookupHostsInPeople.
    const { data } = await supabase
      .from(table)
      .select('slug, name')
      .ilike('name', organiserName)
      .limit(1)
    if (data && data[0]) {
      hints.push({
        table,
        slug: data[0].slug,
        name: data[0].name,
      })
    }
  }
  return hints
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  const all = await getEvents()
  const ranged = all.filter((e) => inRange(e, args.from, args.to))
  const pool = args.curatedOnly ? ranged.filter((e) => e.curated) : ranged

  console.warn(
    `[highlights] ${ranged.length} events in range ${args.from.toISOString().slice(0, 10)}..${args.to.toISOString().slice(0, 10)} (${pool.length} after curated filter)`
  )

  const picks =
    args.match.length > 0
      ? pickByMatch(pool, args.match)
      : pickByAuto(pool, args.top)

  console.warn(`[highlights] picked ${picks.length} events`)

  const registry = loadHandleRegistry()
  console.warn(`[highlights] handle registry: ${registry.size} aliases`)

  const highlights: Highlight[] = []
  for (const event of picks) {
    let hosts: Host[] = []
    if (!args.noHandles) {
      hosts = await fetchEventHosts(event.url)
      hosts = await enrichHostsFromKb(hosts)
      hosts = enrichHostsFromRegistry(hosts, registry)
      // Be polite to Luma
      await new Promise((r) => setTimeout(r, 300))
    }
    const kbHints = await lookupOrganiserKb(event.organiserName)
    highlights.push({
      event,
      hosts,
      kbHints,
      weekday: weekdayLabel(event.startAt),
    })
  }

  console.log(
    JSON.stringify(
      {
        from: args.from.toISOString().slice(0, 10),
        to: args.to.toISOString().slice(0, 10),
        mode: args.match.length > 0 ? 'directed' : 'auto',
        count: highlights.length,
        highlights,
      },
      null,
      2
    )
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
