import { DatabaseSync } from 'node:sqlite'
import { writeFileSync } from 'node:fs'

// Produces a ranked shortlist per Rivan dinner group.
//
// Ranking deliberately does not lead on classifier confidence — confidence measures how sure the
// model is about the label, not how much Lachlan wants the person in the room. What matters is
// whether he can actually get hold of them: an existing conversation beats a cold connection,
// which beats someone he has never met. London matters because it is a London dinner.

const DB = 'scripts/.staging/candidates.db'
const TARGETS: Record<string, number> = {
  rivan: 4,
  top_founder: 15,
  early_eng_founder: 15,
  senior_engineer: 21,
  postdoc: 10,
  recent_grad: 10,
  policy_misc: 10,
  vc: 15,
}

const db = new DatabaseSync(`file:${DB}?mode=ro`, { readOnly: true })
db.exec(`attach database 'file:scripts/.staging/linkedin.db?mode=ro' as li`)

const rows = db.prepare(`
  select c.slug, c.profile_url, c.sources, c.is_connection,
         coalesce(p.name, c.name) name,
         coalesce(c.headline, p.position) headline,
         coalesce(p.current_company_name, c.company) company,
         coalesce(p.city, c.location) location,
         p.followers,
         x.rivan_group, x.pillars, x.seniority, x.confidence, x.evidence,
         v.last_message_at, v.awaiting_reply_from, v.message_count
  from classified x
  join candidates c on c.slug = x.slug
  left join li.profiles p on p.profile_url = c.profile_url
  left join li.conversations v on v.counterparty_profile_url = c.profile_url
  where x.rivan_group != 'none' and x.confidence >= 0.6
`).all() as any[]

type Row = (typeof rows)[number] & { score: number; route: string }

const scored: Row[] = rows.map((r) => {
  const london = /London/i.test(r.location ?? '')
  const uk = /United Kingdom|England|Scotland|Wales/i.test(r.location ?? '')
  let score = 0
  let route = 'no route'

  if (r.last_message_at) { score += 1000; route = `talked ${String(r.last_message_at).slice(0, 10)}` }
  else if (r.is_connection) { score += 500; route = 'connection' }
  else if (String(r.sources).includes('guest_list')) { score += 300; route = 'guest list' }
  else { score += 100; route = 'cold' }

  if (london) score += 200
  else if (uk) score += 80

  score += Math.round((r.confidence ?? 0) * 50)
  if (r.followers) score += Math.min(Math.round(Math.log10(r.followers) * 10), 40)

  return { ...r, score, route }
})

const byGroup = new Map<string, Row[]>()
for (const r of scored) {
  if (!byGroup.has(r.rivan_group)) byGroup.set(r.rivan_group, [])
  byGroup.get(r.rivan_group)!.push(r)
}
for (const list of byGroup.values()) list.sort((a, b) => b.score - a.score)

const out: Record<string, Row[]> = {}
let total = 0

for (const [group, target] of Object.entries(TARGETS)) {
  const pool = byGroup.get(group) ?? []
  // Take 2x the target so there is room to drop people on review without re-running anything.
  const picked = pool.slice(0, target * 2)
  out[group] = picked
  total += Math.min(pool.length, target)

  console.log(`\n=== ${group.toUpperCase()}  — pool ${pool.length}, target ${target} ${pool.length >= target ? '' : `  SHORT by ${target - pool.length}`}`)
  for (const r of picked.slice(0, target)) {
    const conv = r.awaiting_reply_from === 'lachlan' ? ' [you owe a reply]' : r.awaiting_reply_from === 'counterparty' ? ' [awaiting them]' : ''
    console.log(
      `  ${String(r.name ?? '?').slice(0, 22).padEnd(23)}` +
      `${String(r.company ?? '?').slice(0, 26).padEnd(27)}` +
      `${JSON.parse(r.pillars).join('/').slice(0, 20).padEnd(21)}` +
      `${r.route.padEnd(18)}${conv}`,
    )
  }
}

console.log(`\n\ntotal fillable against targets: ${total}/100`)
for (const [g, t] of Object.entries(TARGETS)) {
  const n = (byGroup.get(g) ?? []).length
  if (n < t) console.log(`  SHORT: ${g} has ${n}, needs ${t}`)
}

writeFileSync('scripts/.staging/dinner-shortlist.json', JSON.stringify(out, null, 2))
console.log('\nwritten to scripts/.staging/dinner-shortlist.json (2x target per group, for review)')
