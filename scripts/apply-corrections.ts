import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'

// Applies human corrections made in the explorer back onto the classified table.
//
// The explorer is a static page and cannot reach this database, so edits are exported as JSON and
// replayed here. A human correction outranks the classifier permanently: confidence is set to 1 and
// the evidence records who overruled it, so a later re-classification pass can be told to leave
// these rows alone rather than silently reverting them.

const FILE = process.argv[2] ?? `${process.env.HOME}/Downloads/classifier-corrections.json`
const DB = 'scripts/.staging/candidates.db'
const COMMIT = process.argv.includes('--commit')

type Edit = { g?: string; pl?: string[]; n?: string; co?: string }
const edits = JSON.parse(readFileSync(FILE, 'utf8')) as Record<string, Edit>
const urls = Object.keys(edits)

const db = new DatabaseSync(DB)
const slugOf = (u: string) => (u.match(/\/in\/([^/?#]+)/)?.[1] ?? '').toLowerCase()

const bySlug = new Map<string, any>()
for (const r of db.prepare('select slug, rivan_group, pillars, confidence from classified').all() as any[]) {
  bySlug.set(r.slug, r)
}

console.log(`corrections in file: ${urls.length}`)

let matched = 0
let missing = 0
const plan: Array<{ slug: string; g: string | null; pl: string[] | null; from: any; who: string }> = []

for (const url of urls) {
  const slug = slugOf(url)
  const cur = bySlug.get(slug)
  if (!cur) { missing += 1; continue }
  matched += 1
  const e = edits[url]
  const changedG = e.g && e.g !== cur.rivan_group ? e.g : null
  const curPl = JSON.parse(cur.pillars) as string[]
  const changedPl = e.pl && JSON.stringify([...e.pl].sort()) !== JSON.stringify([...curPl].sort()) ? e.pl : null
  if (!changedG && !changedPl) continue
  plan.push({ slug, g: changedG, pl: changedPl, from: { g: cur.rivan_group, pl: curPl }, who: e.n ?? slug })
}

console.log(`  matched a classified row: ${matched}`)
console.log(`  not found (stale export):  ${missing}`)
console.log(`  actual changes to apply:   ${plan.length}\n`)

for (const p of plan.slice(0, 40)) {
  const bits: string[] = []
  if (p.g) bits.push(`group ${p.from.g} -> ${p.g}`)
  if (p.pl) bits.push(`pillars [${p.from.pl.join(',')}] -> [${p.pl.join(',')}]`)
  console.log(`  ${p.who.slice(0, 26).padEnd(27)}${bits.join('   ')}`)
}
if (plan.length > 40) console.log(`  ... and ${plan.length - 40} more`)

if (!COMMIT) {
  console.log('\nDRY RUN — nothing written. Re-run with --commit.')
  process.exit(0)
}

const upd = db.prepare(`update classified
  set rivan_group = ?, pillars = ?, confidence = 1.0,
      evidence = 'corrected by hand in the explorer (was: ' || rivan_group || ')',
      classified_at = ?
  where slug = ?`)

db.exec('begin')
for (const p of plan) {
  const cur = bySlug.get(p.slug)
  upd.run(p.g ?? cur.rivan_group, JSON.stringify(p.pl ?? JSON.parse(cur.pillars)), new Date().toISOString(), p.slug)
}
db.exec('commit')

console.log(`\napplied ${plan.length} corrections; confidence set to 1.0 so a re-run does not overwrite them`)
