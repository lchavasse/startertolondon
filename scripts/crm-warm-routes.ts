import { DatabaseSync } from 'node:sqlite'
import { writeFileSync } from 'node:fs'

// Scores routes from Lachlan into deeptech-scanner companies, using only the two staging DBs.
//
// True second-degree ("who can introduce me to X") is NOT derivable here and no scraping product
// provides it — LinkedIn's mutual-connection data is viewer-specific and only exists relative to an
// authenticated session. What IS derivable, and is the useful substitute:
//
//   direct    — a connection currently works at the company
//   messaged  — a direct route where a real conversation already exists
//   investor  — a connection works at a firm that backs the company
//
// Output is a review file. Nothing here writes to Supabase; promotion is a separate, gated step.

const LINKEDIN_DB = 'scripts/.staging/linkedin.db'
const SCANNER_DB = 'scripts/.staging/scanner.db'
const OUT = 'scripts/.staging/warm-routes.json'

type Route = {
  companyId: number
  companyName: string
  ukLocation: string | null
  sector: string | null
  stage: string | null
  companyLinkedin: string | null
  kind: 'direct' | 'investor'
  personName: string
  personProfileUrl: string | null
  personPosition: string | null
  viaInvestor: string | null
  hasConversation: boolean
  lastMessageAt: string | null
  awaitingReplyFrom: string | null
}

function main() {
  const db = new DatabaseSync(LINKEDIN_DB, { readOnly: true })
  db.exec(`attach database '${SCANNER_DB}' as sc`)
  const q = <T>(sql: string) => db.prepare(sql).all() as T[]

  const direct = q<Route & { company_id: number }>(`
    select c.id companyId, c.name companyName, c.uk_location ukLocation, c.sector, c.stage,
           c.linkedin_company_url companyLinkedin,
           k.full_name personName, k.profile_url personProfileUrl, k.position personPosition,
           v.last_message_at lastMessageAt, v.awaiting_reply_from awaitingReplyFrom
    from sc.companies c
    join connections k on k.company_norm = c.name_norm and c.name_norm <> ''
    left join conversations v on v.counterparty_profile_url = k.profile_url
  `).map((r: any) => ({ ...r, kind: 'direct' as const, viaInvestor: null, hasConversation: Boolean(r.lastMessageAt) }))

  const directCompanies = new Set(direct.map((r) => r.companyId))

  const investor = q<any>(`
    select c.id companyId, c.name companyName, c.uk_location ukLocation, c.sector, c.stage,
           c.linkedin_company_url companyLinkedin,
           k.full_name personName, k.profile_url personProfileUrl, k.position personPosition,
           i.investor_name viaInvestor,
           v.last_message_at lastMessageAt, v.awaiting_reply_from awaitingReplyFrom
    from sc.companies c
    join sc.investors i on i.company_id = c.id
    join connections k on k.company_norm = i.investor_norm and k.company_norm <> ''
    left join conversations v on v.counterparty_profile_url = k.profile_url
  `)
    .filter((r) => !directCompanies.has(r.companyId))
    .map((r) => ({ ...r, kind: 'investor' as const, hasConversation: Boolean(r.lastMessageAt) }))

  const all = [...direct, ...investor]

  const byCompany = new Map<number, { company: Omit<Route, 'kind' | 'personName' | 'personProfileUrl' | 'personPosition' | 'viaInvestor' | 'hasConversation' | 'lastMessageAt' | 'awaitingReplyFrom'>; routes: Route[] }>()
  for (const route of all) {
    if (!byCompany.has(route.companyId)) {
      byCompany.set(route.companyId, {
        company: {
          companyId: route.companyId,
          companyName: route.companyName,
          ukLocation: route.ukLocation,
          sector: route.sector,
          stage: route.stage,
          companyLinkedin: route.companyLinkedin,
        },
        routes: [],
      })
    }
    byCompany.get(route.companyId)!.routes.push(route)
  }

  // A live conversation beats a cold direct connection; a direct connection beats an investor hop.
  // Extra distinct routes help but with diminishing returns, so they are worth less than the kind.
  const scored = [...byCompany.values()].map((entry) => {
    const hasDirect = entry.routes.some((r) => r.kind === 'direct')
    const conversations = entry.routes.filter((r) => r.hasConversation)
    const distinctPeople = new Set(entry.routes.map((r) => r.personProfileUrl ?? r.personName)).size
    let score = 0
    if (conversations.length) score += 1000
    if (hasDirect) score += 500
    score += Math.min(distinctPeople, 10) * 10
    if (entry.company.ukLocation) score += 50
    return { ...entry, score, hasDirect, conversationCount: conversations.length, distinctPeople }
  }).sort((a, b) => b.score - a.score || a.company.companyName.localeCompare(b.company.companyName))

  const ukOnly = scored.filter((s) => s.company.ukLocation)

  console.log(`companies with at least one route: ${scored.length}`)
  console.log(`  direct connection:        ${scored.filter((s) => s.hasDirect).length}`)
  console.log(`  investor hop only:        ${scored.filter((s) => !s.hasDirect).length}`)
  console.log(`  existing conversation:    ${scored.filter((s) => s.conversationCount > 0).length}`)
  console.log(`  UK-based:                 ${ukOnly.length}`)
  console.log(`total route edges: ${all.length}`)

  console.log(`\ntop 20 UK targets:`)
  for (const s of ukOnly.slice(0, 20)) {
    const tag = s.conversationCount ? 'IN CONVERSATION' : s.hasDirect ? 'direct' : 'via investor'
    console.log(`  [${String(s.score).padStart(4)}] ${s.company.companyName.slice(0, 34).padEnd(34)} ${tag.padEnd(16)} ${s.distinctPeople} route(s)`)
    for (const r of s.routes.slice(0, 2)) {
      const via = r.viaInvestor ? ` via ${r.viaInvestor}` : ''
      const conv = r.hasConversation ? ` — last msg ${String(r.lastMessageAt).slice(0, 10)}, awaiting ${r.awaitingReplyFrom}` : ''
      console.log(`          ${r.personName}${r.personPosition ? ` (${r.personPosition.slice(0, 40)})` : ''}${via}${conv}`)
    }
  }

  writeFileSync(OUT, JSON.stringify({ generated_at: new Date().toISOString(), companies: scored }, null, 2))
  console.log(`\nwritten to ${OUT} — review before any promotion to Supabase`)
}

main()
