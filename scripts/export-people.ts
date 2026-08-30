import { DatabaseSync } from 'node:sqlite'
import { writeFileSync } from 'node:fs'

// Single export of every classified person, carrying the same fit score the dinner ranking uses,
// so the spreadsheet, the explorer and the shortlist can never disagree with each other.
//
// Writes JSON for the explorer and CSV for a spreadsheet. Nothing here recomputes fit differently
// from dinner-fit.ts — the weights live in one place and are imported by both.

import { fitScore, CORE, ADJACENT } from './lib/fit'

const DB = process.argv.find((a) => a.startsWith('--db='))?.slice(5) ?? 'scripts/.staging/candidates.db'
const OUT_JSON = process.argv.find((a) => a.startsWith('--json='))?.slice(7) ?? 'scripts/.staging/people.json'
const OUT_CSV = process.argv.find((a) => a.startsWith('--csv='))?.slice(6) ?? 'scripts/.staging/people.csv'

const db = new DatabaseSync(`file:${DB}?mode=ro`, { readOnly: true })
db.exec(`attach database 'file:scripts/.staging/linkedin.db?mode=ro' as li`)
db.exec(`attach database 'file:scripts/.staging/scanner.db?mode=ro' as sc`)

const rows = db.prepare(`
  select c.slug, c.profile_url, c.sources, c.is_connection, c.company_norm,
         coalesce(p.name, c.name) name,
         coalesce(p.current_company_name, c.company) company,
         coalesce(p.city, c.location) location,
         p.followers,
         x.rivan_group, x.pillars, x.seniority, x.role_type, x.confidence, x.evidence, x.is_deeptech,
         s.is_physical, s.industrial_score, s.sector scanner_sector, s.stage, s.uk_location, s.website,
         v.last_message_at, v.awaiting_reply_from, v.message_count
  from classified x
  join candidates c on c.slug = x.slug
  left join li.profiles p on p.profile_url = c.profile_url
  left join sc.companies s on s.name_norm = c.company_norm and c.company_norm <> ''
  left join (
    select counterparty_profile_url cp, max(last_message_at) last_message_at,
           min(awaiting_reply_from) awaiting_reply_from, sum(message_count) message_count
    from li.conversations where counterparty_profile_url is not null group by 1
  ) v on v.cp = c.profile_url
  where x.rivan_group != 'none' and x.confidence >= 0.55
`).all() as any[]

// One person can arrive from several sources; keep the best-evidenced row per person.
const byKey = new Map<string, any>()
for (const r of rows) {
  const key = (r.name ?? r.slug).toLowerCase().replace(/[^a-z ]/g, '').trim() || r.slug
  const prev = byKey.get(key)
  if (!prev || (r.company && !prev.company) || (r.last_message_at && !prev.last_message_at)) byKey.set(key, r)
}

const people = [...byKey.values()].map((r) => {
  const pillars: string[] = JSON.parse(r.pillars)
  const { fit, why } = fitScore(r, pillars)
  return {
    n: r.name, co: r.company, g: r.rivan_group, pl: pillars, s: r.seniority, rt: r.role_type,
    fit, cf: Math.round(r.confidence * 100), ev: r.evidence, why,
    loc: r.location, u: r.profile_url, f: r.followers, ic: r.is_connection ? 1 : 0,
    lm: r.last_message_at ? String(r.last_message_at).slice(0, 10) : null,
    aw: r.awaiting_reply_from, mc: r.message_count,
    sec: r.scanner_sector, phys: r.is_physical, ind: r.industrial_score, stg: r.stage, web: r.website,
  }
}).sort((a, b) => b.fit - a.fit)

writeFileSync(OUT_JSON, JSON.stringify(people))

const cols = ['fit', 'n', 'co', 'g', 'pl', 's', 'sec', 'phys', 'ind', 'stg', 'loc', 'route', 'lm', 'aw', 'cf', 'ev', 'u', 'web']
const cell = (v: any) => {
  const s = v == null ? '' : Array.isArray(v) ? v.join(' ') : String(v)
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}
const csv = [cols.join(',')]
for (const p of people) {
  const route = p.lm ? `talked ${p.lm}` : p.ic ? 'connection' : 'not connected'
  csv.push(cols.map((c) => cell(c === 'route' ? route : (p as any)[c])).join(','))
}
writeFileSync(OUT_CSV, csv.join('\n'))

console.log(`exported ${people.length} people`)
console.log(`  ${OUT_JSON}`)
console.log(`  ${OUT_CSV}`)
const g: Record<string, number> = {}
for (const p of people) g[p.g] = (g[p.g] ?? 0) + 1
for (const [k, v] of Object.entries(g).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(19)}${v}`)
