import { DatabaseSync } from 'node:sqlite'
import { sanitiseForModel } from '../src/lib/llm/sanitise'
import { writeFileSync, readFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs'

// Splits unclassified people into JSON batches for Claude Code subagents, and merges their answers
// back. This exists because the Anthropic API credit balance ran out mid-run: subagents bill to the
// Claude Code allowance instead, and run a larger model than the Haiku the API path used.
//
//   export  — write batches of people needing classification
//   merge   — read the answer files back into the classified table
//
// Rows already carrying a real classification are never re-exported, and a merge will not downgrade
// a hand-correction (confidence 1.0) back to a model guess.

const DIR = 'scripts/.staging/batches'
const CANDIDATES = 'scripts/.staging/candidates.db'
const mode = process.argv[2]

function educationSummary(json: string | null): string | null {
  if (!json) return null
  try {
    return (JSON.parse(json) as any[]).slice(0, 2)
      .map((e) => [e.title, [e.start_year, e.end_year].filter(Boolean).join('-')].filter(Boolean).join(' '))
      .filter(Boolean).join('; ') || null
  } catch { return null }
}

if (mode === 'export') {
  const size = Number(process.argv[3] ?? 200)
  const max = Number(process.argv[4] ?? 20)
  const db = new DatabaseSync(`file:${CANDIDATES}?mode=ro`, { readOnly: true })
  db.exec(`attach database 'file:scripts/.staging/linkedin.db?mode=ro' as li`)

  const rows = db.prepare(`
    select c.slug, coalesce(p.name, c.name) name, coalesce(c.headline, p.position) headline,
           coalesce(p.current_company_name, c.company) company, c.scanner_sector,
           coalesce(p.city, c.location) location, p.about, p.education_json, p.followers,
           case when c.sources like '%guest_list%' then 0 when p.profile_url is not null then 1
                when c.sources like '%scanner_founder%' then 2 when c.scanner_company is not null then 3
                when c.company is not null and (c.location like '%London%' or c.location like '%United Kingdom%') then 4
                else 5 end pr
    from candidates c
    left join li.profiles p on p.profile_url = c.profile_url
    left join classified x on x.slug = c.slug
    where c.name is not null and (x.slug is null or x.confidence = 0)
    order by pr, c.slug
  `).all() as any[]

  const pool = rows.filter((r) => r.pr <= 4).slice(0, size * max)
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true })

  let n = 0
  for (let i = 0; i < pool.length; i += size) {
    const batch = pool.slice(i, i + size).map((r) => ({
      slug: r.slug, name: r.name, headline: sanitiseForModel(r.headline), company: r.company,
      sector: r.scanner_sector, location: r.location, about: sanitiseForModel(r.about),
      education: educationSummary(r.education_json), followers: r.followers,
    }))
    n += 1
    writeFileSync(`${DIR}/batch-${String(n).padStart(2, '0')}.json`, JSON.stringify(batch, null, 1))
  }
  console.log(`${pool.length} people needing classification -> ${n} batches of ${size} in ${DIR}/`)
  console.log(`still queued beyond this run: ${Math.max(0, rows.filter((r) => r.pr <= 4).length - pool.length)}`)
}

if (mode === 'merge') {
  const db = new DatabaseSync(CANDIDATES)
  const files = readdirSync(DIR).filter((f) => f.startsWith('result-') && f.endsWith('.json'))
  if (!files.length) { console.log(`no result-*.json files in ${DIR}/`); process.exit(0) }

  const PILLARS = new Set(['energy','compute','manufacturing','biotech','lab_automation','space','defence','robotics','autonomy','materials','hardware_other','science'])
  const GROUPS = new Set(['rivan','top_founder','early_eng_founder','senior_engineer','postdoc','recent_grad','policy_misc','vc','deeptech_operator','deeptech_ic','none'])

  const protectedSlugs = new Set(
    (db.prepare('select slug from classified where confidence >= 1.0').all() as any[]).map((r) => r.slug),
  )

  const up = db.prepare(`insert into classified (slug, pillars, role_type, seniority, rivan_group, is_deeptech, confidence, evidence, classified_at)
    values (?,?,?,?,?,?,?,?,?)
    on conflict(slug) do update set pillars=excluded.pillars, role_type=excluded.role_type,
      seniority=excluded.seniority, rivan_group=excluded.rivan_group, is_deeptech=excluded.is_deeptech,
      confidence=excluded.confidence, evidence=excluded.evidence, classified_at=excluded.classified_at`)

  let ok = 0, bad = 0, skipped = 0
  db.exec('begin')
  for (const f of files) {
    let rows: any[]
    try { rows = JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8')) } catch { console.log(`  ${f}: unparseable, skipped`); continue }
    if (!Array.isArray(rows)) { console.log(`  ${f}: not an array, skipped`); continue }
    for (const r of rows) {
      if (!r || typeof r.slug !== 'string' || !GROUPS.has(r.rivanGroup)) { bad += 1; continue }
      if (protectedSlugs.has(r.slug)) { skipped += 1; continue }
      const pillars = (Array.isArray(r.pillars) ? r.pillars : []).filter((p: string) => PILLARS.has(p)).slice(0, 3)
      up.run(r.slug, JSON.stringify(pillars), typeof r.roleType === 'string' ? r.roleType : 'other',
        typeof r.seniority === 'string' ? r.seniority : 'mid', r.rivanGroup, r.isDeeptech ? 1 : 0,
        typeof r.confidence === 'number' ? Math.min(r.confidence, 0.99) : 0.7,
        typeof r.evidence === 'string' ? r.evidence : '', new Date().toISOString())
      ok += 1
    }
  }
  db.exec('commit')
  console.log(`merged ${ok} from ${files.length} files (${bad} malformed, ${skipped} protected hand-corrections left alone)`)
  console.log(`classified total: ${(db.prepare('select count(*) n from classified where confidence > 0').get() as any).n}`)
}

if (!['export', 'merge'].includes(mode ?? '')) {
  console.log('usage: classify-batches.ts export [size] [maxBatches] | merge')
}
