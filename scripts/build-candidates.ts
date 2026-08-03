import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { normaliseName } from './lib/normalise'

// Pools every people source into one candidates table keyed on the LinkedIn /in/<slug>.
//
// Written to a separate staging DB so it never contends with the enrichment run writing to
// linkedin.db. Re-runnable: the table is rebuilt each time, and a person appearing in several
// sources keeps one row with the sources concatenated, since which sources agree on someone is
// itself a ranking signal.
//
// Sources are harvested at different maturities — `also_viewed` only yields as profiles land, so
// re-run this after the enrichment finishes to pick up the full adjacent pool.

const OUT = 'scripts/.staging/candidates.db'
const LINKEDIN = 'file:scripts/.staging/linkedin.db?mode=ro'
const SCANNER = 'file:scripts/.staging/scanner.db?mode=ro'
const GUEST_LIST = `${process.env.HOME}/Downloads/rivan_guest_list.csv`

function slug(url: string | null | undefined) {
  const m = String(url ?? '').match(/\/in\/([^/?#]+)/)
  return m ? decodeURIComponent(m[1]).toLowerCase().replace(/\/$/, '') : null
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i += 1 }
      else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (c !== '\r') field += c
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows.filter((r) => r.some((v) => v.trim()))
}

const db = new DatabaseSync(OUT)
db.exec(`
  drop table if exists candidates;
  create table candidates (
    slug            text primary key,
    profile_url     text not null,
    name            text,
    headline        text,
    company         text,
    company_norm    text,
    location        text,
    sources         text not null,
    scanner_company text,
    scanner_sector  text,
    scanner_uk      text,
    is_connection   integer not null default 0,
    notes           text
  );
`)

type Cand = {
  slug: string
  profile_url: string
  name?: string | null
  headline?: string | null
  company?: string | null
  location?: string | null
  source: string
  notes?: string | null
  is_connection?: boolean
}

const pool = new Map<string, Cand & { sources: Set<string> }>()

function add(c: Cand) {
  if (!c.slug) return
  const existing = pool.get(c.slug)
  if (existing) {
    existing.sources.add(c.source)
    existing.name ||= c.name
    existing.headline ||= c.headline
    existing.company ||= c.company
    existing.location ||= c.location
    existing.notes = [existing.notes, c.notes].filter(Boolean).join(' | ') || null
    if (c.is_connection) existing.is_connection = true
    return
  }
  pool.set(c.slug, { ...c, sources: new Set([c.source]) })
}

// 1. the curated Rivan guest list
const guestRows = parseCsv(readFileSync(GUEST_LIST, 'utf8'))
const guestHeader = guestRows[0].map((h) => h.trim())
for (const row of guestRows.slice(1)) {
  const rec = Object.fromEntries(guestHeader.map((h, i) => [h, (row[i] ?? '').trim()]))
  const s = slug(rec['LinkedIn / profile'])
  if (!s) continue
  add({ slug: s, profile_url: rec['LinkedIn / profile'], name: rec['Name'], headline: rec['Relevant info'], source: 'guest_list', notes: rec['Relevant info'] })
}

// 2. Lachlan's own connections, plus everything already enriched
const li = new DatabaseSync(LINKEDIN, { readOnly: true })
for (const r of li.prepare(`select full_name, profile_url, position, company from connections where profile_url <> ''`).all() as any[]) {
  const s = slug(r.profile_url)
  if (!s) continue
  add({ slug: s, profile_url: r.profile_url, name: r.full_name, headline: r.position, company: r.company, source: 'connection', is_connection: true })
}

// 3. adjacent profiles surfaced by enrichment — the discovery engine
let alsoViewed = 0
for (const r of li.prepare(`select people_also_viewed_json from profiles where people_also_viewed_json is not null`).all() as any[]) {
  for (const p of JSON.parse(r.people_also_viewed_json) ?? []) {
    const s = slug(p.profile_link)
    if (!s || pool.get(s)?.is_connection) continue
    add({ slug: s, profile_url: p.profile_link, name: p.name, company: p.about, location: p.location, source: 'also_viewed' })
    alsoViewed += 1
  }
}

// 4. named founders of scanner companies. Most have no LinkedIn URL yet, so they are held here
//    without one and resolved separately; a candidate with no URL cannot be enriched.
const sc = new DatabaseSync(SCANNER, { readOnly: true })
let founderNoUrl = 0
for (const r of sc.prepare(`select f.name, f.linkedin_url, f.claimed_role, c.name company, c.sector, c.uk_location from founders f join companies c on c.id = f.company_id`).all() as any[]) {
  const s = slug(r.linkedin_url)
  if (!s) { founderNoUrl += 1; continue }
  add({ slug: s, profile_url: r.linkedin_url, name: r.name, headline: r.claimed_role, company: r.company, location: r.uk_location, source: 'scanner_founder' })
}

const insert = db.prepare(`insert or replace into candidates
  (slug, profile_url, name, headline, company, company_norm, location, sources, scanner_company, scanner_sector, scanner_uk, is_connection, notes)
  values (?,?,?,?,?,?,?,?,?,?,?,?,?)`)

const scannerByNorm = new Map<string, any>()
for (const c of sc.prepare(`select name, name_norm, sector, uk_location from companies where name_norm <> ''`).all() as any[]) scannerByNorm.set(c.name_norm, c)

db.exec('begin')
for (const c of pool.values()) {
  const cn = c.company ? normaliseName(c.company) : ''
  const m = cn ? scannerByNorm.get(cn) : undefined
  insert.run(c.slug, c.profile_url, c.name ?? null, c.headline ?? null, c.company ?? null, cn || null, c.location ?? null,
    [...c.sources].sort().join(','), m?.name ?? null, m?.sector ?? null, m?.uk_location ?? null, c.is_connection ? 1 : 0, c.notes ?? null)
}
db.exec('commit')

const n = (s: string) => (db.prepare(s).get() as any).n
console.log(`candidates: ${n('select count(*) n from candidates')}`)
for (const r of db.prepare(`select sources, count(*) n from candidates group by sources order by n desc limit 10`).all() as any[]) {
  console.log(`  ${String(r.sources).padEnd(30)} ${r.n}`)
}
console.log(`\n  at a deeptech-scanner company: ${n('select count(*) n from candidates where scanner_company is not null')}`)
console.log(`  ...and NOT already a connection: ${n('select count(*) n from candidates where scanner_company is not null and is_connection = 0')}`)
console.log(`  scanner founders with no LinkedIn URL (need resolving): ${founderNoUrl}`)
console.log(`\nwritten to ${OUT}`)
