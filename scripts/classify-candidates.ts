import { DatabaseSync } from 'node:sqlite'
import { classifyPeople, type CandidateInput } from '../src/lib/llm/people-classifier'

// Runs the two-axis classifier over pooled candidates and stores the result alongside them.
//
// Prioritises candidates we actually have evidence on — a guest-list entry carries a written
// description, an enriched connection carries about/education/location, a scanner founder carries a
// role and a sector. A bare also_viewed row with only a name is not worth a token until it has been
// enriched, so it is classified last or not at all.
//
// Resumable: anything already in `classified` is skipped, so a re-run after more profiles land
// only classifies the new arrivals.

const CANDIDATES = 'scripts/.staging/candidates.db'
const LINKEDIN = 'file:scripts/.staging/linkedin.db?mode=ro'
const SCANNER = 'file:scripts/.staging/scanner.db?mode=ro'

const args = process.argv.slice(2)
const flag = (n: string, d: number) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? Number(args[i + 1]) : d }
const BATCH = flag('--batch', 25)
const LIMIT = flag('--limit', Infinity)
const MAX_PRIORITY = flag('--max-priority', 3)
const MIN_PRIORITY = flag('--min-priority', 0)

const db = new DatabaseSync(CANDIDATES)
db.exec(`attach database '${LINKEDIN}' as li`)
db.exec(`attach database '${SCANNER}' as sc`)

db.exec(`
  create table if not exists classified (
    slug        text primary key,
    pillars     text not null,
    role_type   text not null,
    seniority   text not null,
    rivan_group text not null,
    is_deeptech integer not null,
    confidence  real not null,
    evidence    text,
    classified_at text not null
  )
`)

function educationSummary(json: string | null): string | null {
  if (!json) return null
  try {
    const rows = JSON.parse(json) as Array<Record<string, any>>
    return rows
      .slice(0, 3)
      .map((e) => [e.title, e.degree, e.field, [e.start_year, e.end_year].filter(Boolean).join('-')].filter(Boolean).join(' '))
      .filter(Boolean)
      .join('; ') || null
  } catch {
    return null
  }
}

// Evidence-rich sources first; a bare name earns nothing.
const rows = db.prepare(`
  select c.slug, c.profile_url, c.sources, c.is_connection,
         coalesce(p.name, c.name) name,
         coalesce(c.headline, p.position) headline,
         coalesce(p.current_company_name, c.company) company,
         c.scanner_sector, coalesce(p.city, c.location) location,
         p.about, p.education_json, p.followers,
         case
           when c.sources like '%guest_list%' then 0
           when p.profile_url is not null then 1
           when c.sources like '%scanner_founder%' then 2
           when c.scanner_company is not null then 3
           -- Adjacent profiles at companies the scanner has never seen. Classifying these on
           -- company name alone is the cheap way to find people at companies we don't track;
           -- rejects are simply never enriched, so the noise costs one Haiku call and stops there.
           when c.company is not null and (c.location like '%London%' or c.location like '%United Kingdom%') then 4
           else 5
         end priority
  from candidates c
  left join li.profiles p on p.profile_url = c.profile_url
  where c.slug not in (select slug from classified)
    and (c.name is not null or p.name is not null)
  order by priority, c.slug
`).all() as any[]

const pool = rows.filter((r) => r.priority >= MIN_PRIORITY && r.priority <= MAX_PRIORITY).slice(0, LIMIT)

console.log(`unclassified candidates with a name: ${rows.length}`)
console.log(`within priority <= ${MAX_PRIORITY}:                  ${rows.filter((r) => r.priority <= MAX_PRIORITY).length}`)
console.log(`classifying this run:                ${pool.length}  (batches of ${BATCH})\n`)

if (!pool.length) {
  console.log('nothing to do.')
  process.exit(0)
}

const insert = db.prepare(`insert or replace into classified
  (slug, pillars, role_type, seniority, rivan_group, is_deeptech, confidence, evidence, classified_at)
  values (?,?,?,?,?,?,?,?,?)`)

async function run() {
let done = 0
for (let i = 0; i < pool.length; i += BATCH) {
  const batch = pool.slice(i, i + BATCH)
  const input: CandidateInput[] = batch.map((r) => ({
    slug: r.slug,
    name: r.name,
    headline: r.headline,
    company: r.company,
    scannerSector: r.scanner_sector,
    location: r.location,
    about: r.about,
    education: educationSummary(r.education_json),
    followers: r.followers,
  }))

  const out = await classifyPeople(input)
  db.exec('begin')
  for (const r of out) {
    insert.run(r.slug, JSON.stringify(r.pillars), r.roleType, r.seniority, r.rivanGroup, r.isDeeptech ? 1 : 0, r.confidence, r.evidence, new Date().toISOString())
  }
  db.exec('commit')
  done += out.length
  if ((i / BATCH) % 8 === 0 || i + BATCH >= pool.length) {
    console.log(`[${new Date().toISOString().slice(11, 19)}] ${done}/${pool.length}`)
  }
}

console.log(`\nclassified ${done}`)
}

run().catch((e) => { console.error(e); process.exit(1) })
