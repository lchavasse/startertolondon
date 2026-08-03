import { DatabaseSync } from 'node:sqlite'
import { execFileSync } from 'node:child_process'
import { readFileSync, unlinkSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'

// Enriches LinkedIn connections via Bright Data's people dataset into scripts/.staging/linkedin.db.
//
// Bright Data bills per record, so this is written to be resumable above all else: every batch is
// committed before the next one starts, and any URL already in `profiles` is skipped. Re-running
// after a crash costs nothing for work already done.
//
// Measured on an 8-profile probe before committing to the full run — `experience` and `position`
// come back null on every profile, so this does NOT give work history. What it does give:
// city (the connections CSV has no location at all), education with start/end years, follower
// counts, and a LinkedIn URL for the current employer.

const DB = 'scripts/.staging/linkedin.db'
const BD = `${homedir()}/.claude/skills/brightdata/bin/bd`
const TMP = 'scripts/.staging/.bd-batch.json'

const args = process.argv.slice(2)
const flag = (name: string, fallback: number) => {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : fallback
}
const BATCH = flag('--batch', 100)
const LIMIT = flag('--limit', Infinity)
const DRY_RUN = args.includes('--dry-run')

const db = new DatabaseSync(DB)

db.exec(`
  create table if not exists profiles (
    profile_url          text primary key,
    fetched_at           text not null,
    name                 text,
    first_name           text,
    last_name            text,
    city                 text,
    country_code         text,
    about                text,
    followers            integer,
    connections_count    integer,
    current_company_name text,
    current_company_url  text,
    position             text,
    experience_json      text,
    education_json       text,
    people_also_viewed_json text,
    raw_json             text not null
  )
`)

function slug(url: string) {
  const m = url.match(/\/in\/([^/?#]+)/)
  return m ? m[1].toLowerCase() : url.toLowerCase()
}

const pending = db
  .prepare(`select profile_url from connections where profile_url <> '' order by profile_url`)
  .all() as Array<{ profile_url: string }>
const done = new Set(
  (db.prepare(`select profile_url from profiles`).all() as Array<{ profile_url: string }>).map((r) => slug(r.profile_url)),
)
const todo = pending.map((r) => r.profile_url).filter((u) => !done.has(slug(u))).slice(0, LIMIT)

console.log(`connections with a URL: ${pending.length}`)
console.log(`already fetched:        ${done.size}`)
console.log(`to fetch this run:      ${todo.length}  (batches of ${BATCH})`)

if (DRY_RUN || !todo.length) {
  console.log(DRY_RUN ? '\nDRY RUN — no API calls made.' : '\nnothing to do.')
  process.exit(0)
}

const insert = db.prepare(`
  insert or replace into profiles (profile_url, fetched_at, name, first_name, last_name, city, country_code,
    about, followers, connections_count, current_company_name, current_company_url, position,
    experience_json, education_json, people_also_viewed_json, raw_json)
  values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
`)

let fetched = 0
let failed = 0
const startedAt = Date.now()

for (let i = 0; i < todo.length; i += BATCH) {
  const batch = todo.slice(i, i + BATCH)
  const label = `batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(todo.length / BATCH)}`

  try {
    if (existsSync(TMP)) unlinkSync(TMP)
    execFileSync(BD, ['people', '--out', TMP, '--urls', ...batch], { stdio: ['ignore', 'ignore', 'inherit'], timeout: 30 * 60_000 })
    const rows = JSON.parse(readFileSync(TMP, 'utf8')) as Array<Record<string, any>>

    // Match the response back to the URL we asked for: the API echoes a canonical www. form, so
    // join on the /in/<slug> segment rather than the literal string.
    const bySlug = new Map<string, Record<string, any>>()
    for (const row of rows) {
      const key = slug(row.input_url ?? row.url ?? row.input?.url ?? '')
      if (key) bySlug.set(key, row)
    }

    for (const url of batch) {
      const row = bySlug.get(slug(url))
      if (!row) {
        failed += 1
        continue
      }
      insert.run(
        url,
        new Date().toISOString(),
        row.name ?? null,
        row.first_name ?? null,
        row.last_name ?? null,
        row.city ?? null,
        row.country_code ?? null,
        row.about ?? null,
        typeof row.followers === 'number' ? row.followers : null,
        typeof row.connections === 'number' ? row.connections : null,
        row.current_company_name ?? row.current_company?.name ?? null,
        row.current_company?.link ?? null,
        row.position ?? null,
        row.experience ? JSON.stringify(row.experience) : null,
        row.education ? JSON.stringify(row.education) : null,
        row.people_also_viewed ? JSON.stringify(row.people_also_viewed) : null,
        JSON.stringify(row),
      )
      fetched += 1
    }

    const rate = fetched / ((Date.now() - startedAt) / 60_000)
    const left = todo.length - (i + batch.length)
    console.log(`${label}: +${rows.length} rows | total ${fetched} ok, ${failed} missing | ~${Math.round(left / Math.max(rate, 1))}min left`)
  } catch (error) {
    console.error(`${label} FAILED — ${error instanceof Error ? error.message.split('\n')[0] : error}`)
    console.error('  stopping. re-run to resume; everything already stored is kept.')
    break
  }
}

console.log(`\nfetched ${fetched}, missing ${failed}`)
console.log(`profiles table now holds ${(db.prepare('select count(*) n from profiles').get() as any).n} rows`)
