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

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { parse, stringify } from 'yaml'
import { getEvents } from '../src/lib/kv'
import { supabase } from '../src/lib/supabase'
import type { LondonEvent } from '../src/lib/types'

interface Host {
  name: string
  username?: string
  lumaUserId?: string
  twitter?: string
  linkedin?: string // always a full https://linkedin.com/... URL once resolved
  isOrg?: boolean // a company/community host, not a taggable human
  kbMatch?: 'people' // future: 'companies', 'vcs', etc.
  registryMatch?: boolean // twitter/linkedin came from docs/social-handles.yml
  lumaMatch?: boolean // socials came straight off the Luma host node
  peopleMatch?: boolean // socials came from docs/people-handles.yml
}

const REGISTRY_PATH = 'docs/social-handles.yml'
const PEOPLE_PATH = 'docs/people-handles.yml'

/** Luma exposes linkedin as a path fragment ("/in/foo" | "/company/bar"); make it a URL. */
function linkedinUrl(handle?: string | null): string | undefined {
  if (!handle) return undefined
  const h = handle.trim()
  if (!h) return undefined
  if (h.startsWith('http')) return h
  return `https://www.linkedin.com/${h.replace(/^\/+/, '')}`
}

/** A "/company/" or "/school/" linkedin = org, not a human to tag. */
function looksLikeOrg(linkedinHandle?: string | null): boolean {
  return !!linkedinHandle && (linkedinHandle.includes('/company/') || linkedinHandle.includes('/school/'))
}

/** strip to lowercase alphanumerics for loose name/slug comparison. */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * Mark hosts whose name is really the organiser/calendar account as orgs — even
 * when Luma maps them to an admin's personal "/in/" profile (Fifty Years →
 * /in/drewmoxon). Keeps the org out of the human tagging worksheet.
 */
function markOrgHosts(hosts: Host[], event: LondonEvent): Host[] {
  const orgTokens = [event.organiserName, event.calendarSlug, ...(event.tags ?? [])]
    .filter(Boolean)
    .map((s) => norm(s as string))
    .filter((s) => s.length > 2 && s !== 'personal')
  return hosts.map((h) => {
    if (h.isOrg) return h
    const n = norm(h.name)
    const isOrg = orgTokens.some((t) => t === n || t.includes(n) || n.includes(t))
    return isOrg ? { ...h, isOrg: true } : h
  })
}

/** https://lu.ma/<slug> → <slug> (for the api.lu.ma/url lookup). */
function lumaSlug(url: string): string | undefined {
  const m = url.match(/lu\.ma\/([A-Za-z0-9-]+)/)
  return m ? m[1] : undefined
}

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
      linkedin: linkedinUrl(entry.linkedin) ?? h.linkedin,
      registryMatch: true,
    }
  })
}

// ── People registry (docs/people-handles.yml) ────────────────────────────────
// A compounding cache of name → LinkedIn/X, grown automatically from Luma host
// data on every run. Its job: fill socials for people Luma *doesn't* expose
// (and let you hand-correct ones it gets wrong). LinkedIn @mentions can't be
// pushed by any API, so this is what makes the manual tagging step fast.
interface PersonEntry {
  name: string
  linkedin?: string
  x?: string
  luma?: string[] // luma usernames + usr- ids seen for this person
  seen?: number
  last_seen?: string
}

/** Index people by lowercased name + each luma alias. */
function loadPeopleRegistry(): { list: PersonEntry[]; index: Map<string, PersonEntry> } {
  const list: PersonEntry[] = existsSync(PEOPLE_PATH)
    ? (parse(readFileSync(PEOPLE_PATH, 'utf8')) as { people?: PersonEntry[] } | null)?.people ?? []
    : []
  const index = new Map<string, PersonEntry>()
  for (const p of list) {
    index.set(p.name.toLowerCase(), p)
    for (const alias of p.luma ?? []) index.set(alias.toLowerCase(), p)
  }
  return { list, index }
}

/** Fill twitter/linkedin gaps from the people registry (Luma + KB take priority). */
function enrichHostsFromPeople(hosts: Host[], index: Map<string, PersonEntry>): Host[] {
  if (index.size === 0) return hosts
  return hosts.map((h) => {
    if (h.twitter && h.linkedin) return h
    const p =
      (h.username && index.get(h.username.toLowerCase())) ||
      (h.lumaUserId && index.get(h.lumaUserId.toLowerCase())) ||
      index.get(h.name.toLowerCase())
    if (!p) return h
    const twitter = h.twitter ?? p.x
    const linkedin = h.linkedin ?? linkedinUrl(p.linkedin)
    if (twitter === h.twitter && linkedin === h.linkedin) return h
    return { ...h, twitter, linkedin, peopleMatch: true }
  })
}

/**
 * Non-destructively merge resolved humans back into docs/people-handles.yml so
 * next week they arrive pre-tagged. Hand-edited linkedin/x are preserved; only
 * luma aliases, seen, and last_seen refresh, and brand-new people get appended.
 */
function writePeopleRegistry(list: PersonEntry[], hosts: Host[], week: string): number {
  const byName = new Map(list.map((p) => [p.name.toLowerCase(), p]))
  let added = 0
  for (const h of hosts) {
    if (h.isOrg || !h.name) continue
    if (!h.twitter && !h.linkedin) continue // need a resolved social to be useful
    const aliases = [h.username, h.lumaUserId].filter((x): x is string => !!x)
    const existing = byName.get(h.name.toLowerCase())
    if (existing) {
      existing.linkedin = existing.linkedin ?? h.linkedin // hand edit wins
      existing.x = existing.x ?? h.twitter
      existing.luma = [...new Set([...(existing.luma ?? []), ...aliases])]
      existing.seen = (existing.seen ?? 0) + 1
      existing.last_seen = week
    } else {
      byName.set(h.name.toLowerCase(), {
        name: h.name,
        linkedin: h.linkedin,
        x: h.twitter,
        luma: aliases.length ? aliases : undefined,
        seen: 1,
        last_seen: week,
      })
      added += 1
    }
  }
  const header =
    '# People registry — name → LinkedIn / X, auto-grown by `npm run highlights`.\n' +
    '#\n' +
    '# Fills host socials when Luma doesn\'t expose them, and is the manual-tagging\n' +
    '# cheat sheet for LinkedIn (no API can @mention people there). Hand edits to\n' +
    '# linkedin / x / name are preserved on re-run; luma / seen / last_seen refresh.\n\n'
  const out = { people: [...byName.values()].sort((a, b) => (b.seen ?? 0) - (a.seen ?? 0)) }
  writeFileSync(PEOPLE_PATH, header + stringify(out))
  return added
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

interface LumaHostNode {
  name?: string
  api_id?: string
  username?: string
  twitter_handle?: string | null
  linkedin_handle?: string | null
}

/**
 * Resolve hosts (with socials) off the public Luma API. The `data.hosts` array
 * carries `twitter_handle` + `linkedin_handle` directly — so every host arrives
 * pre-tagged for X *and* LinkedIn, no scraping or per-profile fetch needed.
 * Non-Luma events (Eventbrite/Meetup) have no slug → no hosts.
 */
async function fetchEventHosts(eventUrl: string): Promise<Host[]> {
  const slug = lumaSlug(eventUrl)
  if (!slug) return []
  try {
    const res = await fetch(`https://api.lu.ma/url?url=${encodeURIComponent(slug)}`, {
      headers: PAGE_HEADERS,
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return []
    const body = (await res.json()) as { data?: { hosts?: LumaHostNode[] } }
    const nodes = body.data?.hosts ?? []
    return nodes
      .filter((n): n is LumaHostNode & { name: string } => typeof n.name === 'string')
      .map((n) => {
        const linkedin = linkedinUrl(n.linkedin_handle)
        const twitter = n.twitter_handle?.trim() || undefined
        return {
          name: n.name,
          username: n.username,
          lumaUserId: n.api_id?.startsWith('usr-') ? n.api_id : undefined,
          twitter,
          linkedin,
          isOrg: looksLikeOrg(n.linkedin_handle),
          lumaMatch: !!(twitter || linkedin),
        }
      })
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
    // KB is hand-curated truth → it overrides, but only where it actually has a
    // value. A KB row with no twitter must not wipe a Luma-resolved handle.
    return {
      ...h,
      twitter: m.twitter ?? h.twitter,
      linkedin: linkedinUrl(m.linkedin) ?? h.linkedin,
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

  // Per-day density across the whole range — drives the "is this a big day?"
  // screenshot decision (see the skill's shot-planning step), independent of
  // the top-N picks below.
  const dayMap = new Map<string, { date: string; weekday: string; curated: number; total: number }>()
  for (const e of ranged) {
    const date = e.startAt.slice(0, 10)
    const row = dayMap.get(date) ?? { date, weekday: weekdayLabel(e.startAt), curated: 0, total: 0 }
    row.total += 1
    if (e.curated) row.curated += 1
    dayMap.set(date, row)
  }
  const dayCounts = [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date))

  console.warn(
    `[highlights] ${ranged.length} events in range ${args.from.toISOString().slice(0, 10)}..${args.to.toISOString().slice(0, 10)} (${pool.length} after curated filter)`
  )

  const picks =
    args.match.length > 0
      ? pickByMatch(pool, args.match)
      : pickByAuto(pool, args.top)

  console.warn(`[highlights] picked ${picks.length} events`)

  const registry = loadHandleRegistry()
  const people = loadPeopleRegistry()
  console.warn(
    `[highlights] registries: ${registry.size} org handles, ${people.list.length} people`
  )

  const highlights: Highlight[] = []
  for (const event of picks) {
    let hosts: Host[] = []
    if (!args.noHandles) {
      // Luma host node first (carries twitter + linkedin), then hand-curated
      // overrides/gap-fills from KB, the org registry, and the people registry.
      hosts = await fetchEventHosts(event.url)
      hosts = markOrgHosts(hosts, event)
      hosts = await enrichHostsFromKb(hosts)
      hosts = enrichHostsFromRegistry(hosts, registry)
      hosts = enrichHostsFromPeople(hosts, people.index)
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

  // Tagging worksheet — the manual-tag cheat sheet. Per featured event, the
  // human hosts that have at least one social, in Luma's host order.
  const tagging = highlights
    .map((h) => ({
      event: h.event.name,
      weekday: h.weekday,
      people: h.hosts
        .filter((host) => !host.isOrg && (host.linkedin || host.twitter))
        .map((host) => ({
          name: host.name,
          linkedin: host.linkedin,
          x: host.twitter,
        })),
    }))
    .filter((t) => t.people.length > 0)

  if (!args.noHandles) {
    const week = args.from.toISOString().slice(0, 10)
    const allHosts = highlights.flatMap((h) => h.hosts)
    const added = writePeopleRegistry(people.list, allHosts, week)
    console.warn(`[highlights] people registry: +${added} new → ${PEOPLE_PATH}`)
  }

  console.log(
    JSON.stringify(
      {
        from: args.from.toISOString().slice(0, 10),
        to: args.to.toISOString().slice(0, 10),
        mode: args.match.length > 0 ? 'directed' : 'auto',
        count: highlights.length,
        dayCounts,
        highlights,
        tagging,
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
