import { DatabaseSync } from 'node:sqlite'
import { writeFileSync } from 'node:fs'

// Ranks dinner candidates on FIT first, reachability second.
//
// The earlier shortlist led on route — who Lachlan could most easily reach — which put people he
// happened to have messaged at the top regardless of whether they belonged in the room. For a Rivan
// dinner that is the wrong axis. Rivan Industries builds modular synthetic fuel plants:
// industrial-process, is_physical=1, industrial_score 76, Series A. The room should be people who
// build physical things.
//
// So fit dominates and route breaks ties. The scanner is the source of truth where it knows the
// company (is_physical, industrial_score, category); pillars are the fallback where it does not.

const DB = process.argv.find((a) => a.startsWith('--db='))?.slice(5) ?? 'scripts/.staging/candidates.db'
const OVERFILL = Number(process.argv.find((a) => a.startsWith('--overfill='))?.slice(11) ?? 3)

const TARGETS: Record<string, number> = {
  rivan: 4, top_founder: 15, early_eng_founder: 15, senior_engineer: 21,
  postdoc: 10, recent_grad: 10, policy_misc: 10, vc: 15,
}

// Rivan's own world: things that are built, powered, machined, launched or flown.
const CORE = new Set(['manufacturing', 'materials', 'energy', 'hardware_other', 'robotics', 'space', 'defence', 'autonomy', 'lab_automation'])
// Real deeptech, different room. A chip person fits better than a drug-discovery person.
const ADJACENT = new Set(['compute', 'science'])

const db = new DatabaseSync(`file:${DB}?mode=ro`, { readOnly: true })
db.exec(`attach database 'file:scripts/.staging/linkedin.db?mode=ro' as li`)
db.exec(`attach database 'file:scripts/.staging/scanner.db?mode=ro' as sc`)

const rows = db.prepare(`
  select c.slug, c.profile_url, c.sources, c.is_connection, c.company_norm,
         coalesce(p.name, c.name) name,
         coalesce(p.current_company_name, c.company) company,
         coalesce(p.city, c.location) location,
         x.rivan_group, x.pillars, x.seniority, x.role_type, x.confidence, x.evidence,
         s.is_physical, s.industrial_score, s.category, s.sector scanner_sector, s.stage, s.uk_location,
         v.last_message_at, v.awaiting_reply_from
  from classified x
  join candidates c on c.slug = x.slug
  left join li.profiles p on p.profile_url = c.profile_url
  left join sc.companies s on s.name_norm = c.company_norm and c.company_norm <> ''
  left join (
    select counterparty_profile_url cp, max(last_message_at) last_message_at,
           min(awaiting_reply_from) awaiting_reply_from
    from li.conversations where counterparty_profile_url is not null group by 1
  ) v on v.cp = c.profile_url
  where x.rivan_group != 'none' and x.confidence >= 0.6
`).all() as any[]

type Scored = (typeof rows)[number] & { fit: number; route: string; why: string[] }

const scored: Scored[] = rows.map((r) => {
  const pillars: string[] = JSON.parse(r.pillars)
  const why: string[] = []
  let fit = 0

  const core = pillars.filter((p) => CORE.has(p)).length
  const adj = pillars.filter((p) => ADJACENT.has(p)).length
  if (core) { fit += 100 + (core - 1) * 25; why.push(`${core} core pillar${core > 1 ? 's' : ''}`) }
  else if (adj) { fit += 45; why.push('adjacent field') }
  else { fit += 10 }

  // The scanner outranks the classifier: it has actually looked at what the company builds.
  if (r.is_physical === 1) { fit += 120; why.push('scanner: physical') }
  else if (r.is_physical === 0) { fit -= 60; why.push('scanner: not physical') }
  if (typeof r.industrial_score === 'number') { fit += Math.round(r.industrial_score * 0.8); why.push(`industrial ${r.industrial_score}`) }
  if (r.company_norm && r.is_physical == null) { fit -= 15 } // unverified company

  if (['exec', 'senior'].includes(r.seniority)) fit += 25
  if (/London/i.test(r.location ?? '')) { fit += 40; why.push('London') }
  else if (/United Kingdom|England|Scotland|Wales/i.test(r.location ?? '')) fit += 15
  else if (r.location) fit -= 30

  fit += Math.round((r.confidence ?? 0) * 20)

  // Reachability breaks ties only — worth far less than it was.
  let route = 'not connected'
  if (r.last_message_at) { fit += 35; route = `talked ${String(r.last_message_at).slice(0, 10)}` }
  else if (r.is_connection) { fit += 20; route = 'connection' }

  return { ...r, fit, route, why }
})

const byGroup = new Map<string, Scored[]>()
for (const r of scored) {
  if (!byGroup.has(r.rivan_group)) byGroup.set(r.rivan_group, [])
  byGroup.get(r.rivan_group)!.push(r)
}
for (const l of byGroup.values()) l.sort((a, b) => b.fit - a.fit)

const out: Record<string, Scored[]> = {}
for (const [group, target] of Object.entries(TARGETS)) {
  const pool = byGroup.get(group) ?? []
  const take = Math.min(pool.length, target * OVERFILL)
  out[group] = pool.slice(0, take)

  console.log(`\n=== ${group.toUpperCase()}  — showing ${take} (target ${target}, pool ${pool.length})`)
  for (const r of pool.slice(0, take)) {
    const owe = r.awaiting_reply_from === 'lachlan' ? ' *OWE REPLY*' : ''
    console.log(
      `  ${String(r.fit).padStart(4)}  ${String(r.name ?? '?').slice(0, 21).padEnd(22)}` +
      `${String(r.company ?? '?').slice(0, 24).padEnd(25)}` +
      `${(r.scanner_sector ?? JSON.parse(r.pillars).join('/')).slice(0, 24).padEnd(25)}` +
      `${r.route.padEnd(17)}${owe}`,
    )
  }
}

writeFileSync('scripts/.staging/dinner-fit.json', JSON.stringify(out, null, 2))
console.log(`\nwritten to scripts/.staging/dinner-fit.json (${OVERFILL}x target per group)`)
