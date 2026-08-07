import { DatabaseSync } from 'node:sqlite'
import { createClient } from '@supabase/supabase-js'
import { fitScore } from './lib/fit'

// Loads the classified staging pool into Supabase so the CRM can read and write it.
//
// The operator-owned columns — shortlisted, note, corrected — are the only data here that cannot be
// regenerated from the pipeline, so a re-import must never touch them. Rows already marked
// `corrected` keep their hand-set group and pillars too; that is the whole point of correcting one.
//
// That protection depends on reading EVERY existing row. Supabase truncates a plain select at
// db-max-rows (1000) without erroring, which silently skipped 1,631 rows and would have wiped the
// edits on them. Read it paged, and refuse to write at all if the read looks short.

function requireEnv(name: string) {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env var: ${name}`)
  return v
}

const supabase = createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'))
const DRY = !process.argv.includes('--commit')

const db = new DatabaseSync('file:scripts/.staging/candidates.db?mode=ro', { readOnly: true })
db.exec(`attach database 'file:scripts/.staging/linkedin.db?mode=ro' as li`)
db.exec(`attach database 'file:scripts/.staging/scanner.db?mode=ro' as sc`)

const rows = db.prepare(`
  select c.slug, c.profile_url, c.sources, c.is_connection, c.company_norm,
         coalesce(p.name, c.name) name,
         coalesce(p.current_company_name, c.company) company,
         coalesce(p.city, c.location) location, p.followers,
         x.rivan_group, x.pillars, x.seniority, x.role_type, x.confidence, x.evidence, x.is_deeptech,
         s.is_physical, s.industrial_score, s.sector scanner_sector, s.stage, s.website,
         v.last_message_at, v.awaiting_reply_from, v.message_count,
         cr.doctorate_status, cr.doctorate_field, cr.doctorate_institution, cr.confidence doctorate_confidence
  from classified x
  join candidates c on c.slug = x.slug
  left join li.profiles p on p.profile_url = c.profile_url
  left join sc.companies s on s.name_norm = c.company_norm and c.company_norm <> ''
  left join credentials cr on cr.slug = c.slug
  left join (
    select counterparty_profile_url cp, max(last_message_at) last_message_at,
           min(awaiting_reply_from) awaiting_reply_from, sum(message_count) message_count
    from li.conversations where counterparty_profile_url is not null group by 1
  ) v on v.cp = c.profile_url
  where x.rivan_group != 'none' and x.confidence >= 0.55
`).all() as any[]

// Same de-duplication as the export: one row per human, best-evidenced wins.
const byPerson = new Map<string, any>()
for (const r of rows) {
  const key = (r.name ?? r.slug).toLowerCase().replace(/[^a-z ]/g, '').trim() || r.slug
  const prev = byPerson.get(key)
  if (!prev || (r.company && !prev.company) || (r.last_message_at && !prev.last_message_at)) byPerson.set(key, r)
}

const payload = [...byPerson.values()].map((r) => {
  const pillars: string[] = JSON.parse(r.pillars)
  const { fit } = fitScore(r, pillars)
  return {
    slug: r.slug,
    profile_url: r.profile_url,
    full_name: r.name,
    company: r.company,
    company_norm: r.company_norm || null,
    location: r.location,
    followers: r.followers,
    event_group: r.rivan_group,
    pillars,
    seniority: r.seniority,
    role_type: r.role_type,
    confidence: r.confidence,
    evidence: r.evidence,
    fit,
    is_deeptech: !!r.is_deeptech,
    scanner_sector: r.scanner_sector,
    is_physical: r.is_physical == null ? null : !!r.is_physical,
    industrial_score: r.industrial_score,
    company_stage: r.stage,
    company_website: r.website,
    is_connection: !!r.is_connection,
    last_message_at: r.last_message_at ?? null,
    awaiting_reply_from: r.awaiting_reply_from,
    message_count: r.message_count,
    sources: r.sources,
    doctorate_status: r.doctorate_status ?? null,
    doctorate_field: r.doctorate_field ?? null,
    doctorate_institution: r.doctorate_institution ?? null,
    doctorate_confidence: r.doctorate_confidence ?? null,
  }
})

async function main() {
  const existing: any[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('crm_people_pool')
      .select('slug, shortlisted, note, corrected, event_group, pillars')
      .order('slug')
      .range(from, from + PAGE - 1)
    if (error) throw error
    const batch = data ?? []
    existing.push(...batch)
    if (batch.length < PAGE) break
  }

  const { count: trueCount, error: cErr } = await supabase.from('crm_people_pool').select('*', { head: true, count: 'exact' })
  if (cErr) throw cErr
  if (trueCount != null && existing.length < trueCount) {
    throw new Error(`read ${existing.length} of ${trueCount} existing rows — refusing to write, this would overwrite operator edits`)
  }

  const keep = new Map(existing.map((r: any) => [r.slug, r]))
  const corrected = (existing ?? []).filter((r: any) => r.corrected).length
  const marked = (existing ?? []).filter((r: any) => r.shortlisted || r.note).length

  console.log(`staging rows: ${rows.length} -> ${payload.length} after de-duplication`)
  console.log(`already in Supabase: ${keep.size}  (${corrected} corrected, ${marked} shortlisted/noted)`)

  // Every object in a bulk upsert must carry the same keys: PostgREST fills any it is missing with
  // NULL, and shortlisted is NOT NULL, so a mixed-shape batch fails halfway through.
  const final = payload.map((p) => {
    const prev = keep.get(p.slug)
    if (!prev) return { ...p, shortlisted: false, note: null, corrected: false }
    return {
      ...p,
      // Never clobber what a human set.
      shortlisted: prev.shortlisted,
      note: prev.note,
      corrected: prev.corrected,
      event_group: prev.corrected ? prev.event_group : p.event_group,
      pillars: prev.corrected ? prev.pillars : p.pillars,
    }
  })

  if (DRY) {
    console.log(`\nDRY RUN — would upsert ${final.length} rows. Re-run with --commit.`)
    return
  }

  const CHUNK = 500
  for (let i = 0; i < final.length; i += CHUNK) {
    const { error } = await supabase.from('crm_people_pool').upsert(final.slice(i, i + CHUNK), { onConflict: 'slug' })
    if (error) throw error
    console.log(`  upserted ${Math.min(i + CHUNK, final.length)}/${final.length}`)
  }

  const { count } = await supabase.from('crm_people_pool').select('*', { head: true, count: 'exact' })
  console.log(`\ncrm_people_pool now holds ${count} rows`)
}

main().catch((e) => { console.error(e); process.exit(1) })
