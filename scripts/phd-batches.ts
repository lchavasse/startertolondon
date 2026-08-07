import { DatabaseSync } from 'node:sqlite'
import { writeFileSync, readFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs'

// Finds engineering PhDs: people holding a doctorate who now work in industry rather than academia.
//
// LinkedIn's `degree` and `field` come back empty from the Bright Data people dataset (58 and 44
// populated across thousands of education entries), so a doctorate cannot be read off a field. It
// has to be inferred from institution, the length and dates of the stint, the current title and the
// bio — which is a judgement, hence agents rather than a regex.
//
// Only 85 of 3,914 connections advertise it in their name. This finds the rest.

const DIR = 'scripts/.staging/phd'
const DB = 'scripts/.staging/candidates.db'
const mode = process.argv[2]

// Opened read-write in both modes: export needs to create the credentials table so it can skip
// people already checked, which is what makes a re-run cheap.
const db = new DatabaseSync(DB)
db.exec(`attach database 'file:scripts/.staging/linkedin.db?mode=ro' as li`)

db.exec(`create table if not exists credentials (
  slug text primary key,
  has_doctorate integer not null,
  doctorate_field text,
  doctorate_institution text,
  in_industry_role integer not null,
  confidence real not null,
  evidence text,
  checked_at text not null
)`)

if (mode === 'export') {
  const size = Number(process.argv[3] ?? 250)
  const rows = db.prepare(`
    select c.slug, coalesce(p.name, c.name) name,
           coalesce(c.headline, p.position) headline,
           coalesce(p.current_company_name, c.company) company,
           p.about, p.education_json, x.role_type, x.rivan_group
    from candidates c
    join li.profiles p on p.profile_url = c.profile_url
    join classified x on x.slug = c.slug
    left join credentials cr on cr.slug = c.slug
    where c.is_connection = 1
      and p.education_json is not null
      and x.role_type in ('engineer', 'founder', 'operator')
      and cr.slug is null
    order by c.slug
  `).all() as any[]

  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true })
  let n = 0
  for (let i = 0; i < rows.length; i += size) {
    n += 1
    const batch = rows.slice(i, i + size).map((r) => ({
      slug: r.slug,
      name: r.name,
      headline: r.headline,
      company: r.company,
      about: r.about,
      currentRole: r.role_type,
      education: (() => {
        try {
          return (JSON.parse(r.education_json) as any[]).slice(0, 4).map((e) => ({
            institution: e.title ?? null,
            degree: e.degree ?? null,
            field: e.field ?? null,
            from: e.start_year ?? null,
            to: e.end_year ?? null,
          }))
        } catch { return [] }
      })(),
    }))
    writeFileSync(`${DIR}/phd-${String(n).padStart(2, '0')}.json`, JSON.stringify(batch, null, 1))
  }
  console.log(`${rows.length} connections in industry roles with education history -> ${n} batches of ${size} in ${DIR}/`)
}

if (mode === 'merge') {
  const files = readdirSync(DIR).filter((f) => f.startsWith('result-') && f.endsWith('.json'))
  if (!files.length) { console.log(`no result-*.json in ${DIR}/`); process.exit(0) }

  const up = db.prepare(`insert into credentials
    (slug, has_doctorate, doctorate_field, doctorate_institution, in_industry_role, confidence, evidence, checked_at)
    values (?,?,?,?,?,?,?,?)
    on conflict(slug) do update set has_doctorate=excluded.has_doctorate, doctorate_field=excluded.doctorate_field,
      doctorate_institution=excluded.doctorate_institution, in_industry_role=excluded.in_industry_role,
      confidence=excluded.confidence, evidence=excluded.evidence, checked_at=excluded.checked_at`)

  let ok = 0, bad = 0
  db.exec('begin')
  for (const f of files) {
    let rows: any[]
    try { rows = JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8')) } catch { console.log(`  ${f}: unparseable`); continue }
    if (!Array.isArray(rows)) continue
    for (const r of rows) {
      if (!r || typeof r.slug !== 'string' || typeof r.hasDoctorate !== 'boolean') { bad += 1; continue }
      up.run(r.slug, r.hasDoctorate ? 1 : 0, r.doctorateField ?? null, r.doctorateInstitution ?? null,
        r.inIndustryRole ? 1 : 0, typeof r.confidence === 'number' ? r.confidence : 0.5,
        typeof r.evidence === 'string' ? r.evidence : '', new Date().toISOString())
      ok += 1
    }
  }
  db.exec('commit')
  const n = (s: string) => (db.prepare(s).get() as any).n
  console.log(`merged ${ok} (${bad} malformed)`)
  console.log(`  doctorate holders found: ${n('select count(*) n from credentials where has_doctorate=1')}`)
  console.log(`  ...in an industry role:  ${n('select count(*) n from credentials where has_doctorate=1 and in_industry_role=1')}`)
}

if (!['export', 'merge'].includes(mode ?? '')) console.log('usage: phd-batches.ts export [size] | merge')
