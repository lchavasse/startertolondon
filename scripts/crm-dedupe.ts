import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'node:fs'

const DRY_RUN = !process.argv.includes('--commit')

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing env var: ${name}`)
  return value
}

const supabase = createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'))

function norm(value: string | null | undefined) {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

// The 10 July sheet import ran twice. The second pass minted slugs suffixed with the sheet tab and
// row number, e.g. physicsx-sponsors-47 next to a clean physicsx. Prefer the clean one.
const IMPORT_SUFFIX = /-(sponsors|speakers|expo|partners|people|orgs)-\d+$/

type Row = Record<string, any>

// Rows whose name normalises to nothing ("?", "-") must never be merged with each other — they
// collide on an empty key while being entirely unrelated records. Report them instead.
function groupDuplicates(rows: Row[], key: (row: Row) => string) {
  const groups = new Map<string, Row[]>()
  const unkeyed: Row[] = []
  for (const row of rows) {
    const k = key(row)
    if (!k) {
      unkeyed.push(row)
      continue
    }
    groups.set(k, [...(groups.get(k) ?? []), row])
  }
  return { duplicates: [...groups.values()].filter((group) => group.length > 1), unkeyed }
}

async function fetchAll(table: string, select: string) {
  const { data, error } = await supabase.from(table).select(select).limit(5000)
  if (error) throw error
  return (data ?? []) as unknown as Row[]
}

async function main() {
  const [organisations, opportunities, oppOrgs, oppPeople, personOrgs, tasks, interactions, outreach, sourceLinks] = await Promise.all([
    fetchAll('crm_organisations', '*'),
    fetchAll('crm_opportunities', '*'),
    fetchAll('crm_opportunity_organisations', '*'),
    fetchAll('crm_opportunity_people', '*'),
    fetchAll('crm_person_organisations', '*'),
    fetchAll('crm_tasks', '*'),
    fetchAll('crm_interactions', '*'),
    fetchAll('crm_outreach_entries', '*'),
    fetchAll('crm_source_links', '*'),
  ])

  const { duplicates: orgGroups, unkeyed: unkeyedOrgs } = groupDuplicates(organisations, (row) => norm(row.name))
  const { duplicates: oppGroups, unkeyed: unkeyedOpps } = groupDuplicates(opportunities, (row) => norm(row.title))

  // organisation survivor: the slug without the import suffix, else the oldest
  const orgMerge = new Map<string, string>() // loser id -> survivor id
  const orgPlan: Array<{ name: string; keep: string; keepSlug: string; drop: Array<{ id: string; slug: string }> }> = []
  for (const group of orgGroups) {
    const clean = group.filter((row) => !IMPORT_SUFFIX.test(row.slug ?? ''))
    const sorted = [...group].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
    const keep = (clean.length ? clean : sorted)[0]
    const drop = group.filter((row) => row.id !== keep.id)
    for (const row of drop) orgMerge.set(row.id, keep.id)
    orgPlan.push({ name: keep.name, keep: keep.id, keepSlug: keep.slug, drop: drop.map((row) => ({ id: row.id, slug: row.slug })) })
  }

  // opportunity survivor: whichever is attached to a surviving organisation, else the oldest
  const orgIdByOpportunity = new Map<string, string>()
  for (const link of oppOrgs) orgIdByOpportunity.set(link.opportunity_id, link.organisation_id)

  const oppMerge = new Map<string, string>()
  const oppPlan: Array<{ title: string; keep: string; drop: string[] }> = []
  for (const group of oppGroups) {
    const sorted = [...group].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
    const attachedToSurvivor = sorted.filter((row) => {
      const orgId = orgIdByOpportunity.get(row.id)
      return orgId && !orgMerge.has(orgId)
    })
    const keep = (attachedToSurvivor.length ? attachedToSurvivor : sorted)[0]
    const drop = group.filter((row) => row.id !== keep.id)
    for (const row of drop) oppMerge.set(row.id, keep.id)
    oppPlan.push({ title: keep.title, keep: keep.id, drop: drop.map((row) => row.id) })
  }

  console.log('=== ORGANISATIONS ===')
  console.log(`  duplicate groups: ${orgPlan.length}, rows to delete: ${orgMerge.size}`)
  for (const plan of orgPlan.slice(0, 8)) {
    console.log(`    keep ${plan.keepSlug.padEnd(30)} drop ${plan.drop.map((d) => d.slug).join(', ')}`)
  }
  console.log('\n=== OPPORTUNITIES ===')
  console.log(`  duplicate groups: ${oppPlan.length}, rows to delete: ${oppMerge.size}`)
  for (const plan of oppPlan.slice(0, 8)) console.log(`    keep "${plan.title}"`)

  if (unkeyedOrgs.length || unkeyedOpps.length) {
    console.log('\n=== NOT MERGED — name normalises to nothing, needs a human ===')
    for (const row of unkeyedOrgs) {
      const opportunityIds = oppOrgs.filter((link) => link.organisation_id === row.id).map((link) => link.opportunity_id)
      const titles = opportunities.filter((opp) => opportunityIds.includes(opp.id)).map((opp) => opp.title)
      console.log(`  organisation ${row.slug} name=${JSON.stringify(row.name)} -> ${titles.join(', ') || 'no opportunity'}`)
    }
    for (const row of unkeyedOpps) console.log(`  opportunity ${row.id} title=${JSON.stringify(row.title)}`)
  }

  const snapshot = {
    generated_at: new Date().toISOString(),
    organisations: organisations.filter((row) => orgMerge.has(row.id)),
    opportunities: opportunities.filter((row) => oppMerge.has(row.id)),
    opportunity_organisations: oppOrgs.filter((row) => oppMerge.has(row.opportunity_id) || orgMerge.has(row.organisation_id)),
    opportunity_people: oppPeople.filter((row) => oppMerge.has(row.opportunity_id)),
    person_organisations: personOrgs.filter((row) => orgMerge.has(row.organisation_id)),
    source_links: sourceLinks.filter((row) => oppMerge.has(row.entity_id) || orgMerge.has(row.entity_id)),
    tasks: tasks.filter((row) => oppMerge.has(row.linked_opportunity_id) || orgMerge.has(row.linked_organisation_id)),
    interactions: interactions.filter((row) => oppMerge.has(row.opportunity_id) || orgMerge.has(row.organisation_id)),
    outreach_entries: outreach.filter((row) => oppMerge.has(row.opportunity_id) || orgMerge.has(row.organisation_id)),
  }
  const path = `scripts/.crm-dedupe-snapshot.json`
  writeFileSync(path, JSON.stringify(snapshot, null, 2))
  console.log(`\nsnapshot written to ${path}`)
  for (const [k, v] of Object.entries(snapshot)) {
    if (Array.isArray(v) && v.length) console.log(`  ${k}: ${v.length}`)
  }

  if (DRY_RUN) {
    console.log('\nDRY RUN — nothing written. Re-run with --commit to apply.')
    return
  }

  // Repoint dependants onto survivors, dropping rows that would violate a uniqueness constraint.
  const survivingOppOrgPairs = new Set(
    oppOrgs.map((row) => `${oppMerge.get(row.opportunity_id) ?? row.opportunity_id}:${orgMerge.get(row.organisation_id) ?? row.organisation_id}`),
  )
  void survivingOppOrgPairs

  const seenOppOrg = new Set<string>()
  for (const row of oppOrgs) {
    const opportunityId = oppMerge.get(row.opportunity_id) ?? row.opportunity_id
    const organisationId = orgMerge.get(row.organisation_id) ?? row.organisation_id
    const pair = `${opportunityId}:${organisationId}`
    if (seenOppOrg.has(pair)) {
      await supabase.from('crm_opportunity_organisations').delete().eq('id', row.id)
      continue
    }
    seenOppOrg.add(pair)
    if (opportunityId !== row.opportunity_id || organisationId !== row.organisation_id) {
      await supabase.from('crm_opportunity_organisations').update({ opportunity_id: opportunityId, organisation_id: organisationId }).eq('id', row.id)
    }
  }

  const seenOppPerson = new Set<string>()
  for (const row of oppPeople) {
    const opportunityId = oppMerge.get(row.opportunity_id) ?? row.opportunity_id
    const pair = `${opportunityId}:${row.person_id}`
    if (seenOppPerson.has(pair)) {
      await supabase.from('crm_opportunity_people').delete().eq('id', row.id)
      continue
    }
    seenOppPerson.add(pair)
    if (opportunityId !== row.opportunity_id) {
      await supabase.from('crm_opportunity_people').update({ opportunity_id: opportunityId }).eq('id', row.id)
    }
  }

  const seenPersonOrg = new Set<string>()
  for (const row of personOrgs) {
    const organisationId = orgMerge.get(row.organisation_id) ?? row.organisation_id
    const pair = `${row.person_id}:${organisationId}:${row.role_label ?? ''}`
    if (seenPersonOrg.has(pair)) {
      await supabase.from('crm_person_organisations').delete().eq('id', row.id)
      continue
    }
    seenPersonOrg.add(pair)
    if (organisationId !== row.organisation_id) {
      await supabase.from('crm_person_organisations').update({ organisation_id: organisationId }).eq('id', row.id)
    }
  }

  for (const row of tasks) {
    const patch: Record<string, string> = {}
    if (row.linked_opportunity_id && oppMerge.has(row.linked_opportunity_id)) patch.linked_opportunity_id = oppMerge.get(row.linked_opportunity_id)!
    if (row.linked_organisation_id && orgMerge.has(row.linked_organisation_id)) patch.linked_organisation_id = orgMerge.get(row.linked_organisation_id)!
    if (Object.keys(patch).length) await supabase.from('crm_tasks').update(patch).eq('id', row.id)
  }

  for (const table of ['crm_interactions', 'crm_outreach_entries'] as const) {
    const rows = table === 'crm_interactions' ? interactions : outreach
    for (const row of rows) {
      const patch: Record<string, string> = {}
      if (row.opportunity_id && oppMerge.has(row.opportunity_id)) patch.opportunity_id = oppMerge.get(row.opportunity_id)!
      if (row.organisation_id && orgMerge.has(row.organisation_id)) patch.organisation_id = orgMerge.get(row.organisation_id)!
      if (Object.keys(patch).length) await supabase.from(table).update(patch).eq('id', row.id)
    }
  }

  // source_links is uniquely indexed; repoint where free, delete where the survivor already has it
  const seenSourceLink = new Set(
    sourceLinks
      .filter((row) => !oppMerge.has(row.entity_id) && !orgMerge.has(row.entity_id))
      .map((row) => `${row.entity_type}:${row.entity_id}:${row.source_system}:${row.source_ref ?? ''}`),
  )
  for (const row of sourceLinks) {
    const target = oppMerge.get(row.entity_id) ?? orgMerge.get(row.entity_id)
    if (!target) continue
    const key = `${row.entity_type}:${target}:${row.source_system}:${row.source_ref ?? ''}`
    if (seenSourceLink.has(key)) {
      await supabase.from('crm_source_links').delete().eq('id', row.id)
      continue
    }
    seenSourceLink.add(key)
    await supabase.from('crm_source_links').update({ entity_id: target }).eq('id', row.id)
  }

  for (const id of oppMerge.keys()) {
    const { error } = await supabase.from('crm_opportunities').delete().eq('id', id)
    if (error) throw error
  }
  for (const id of orgMerge.keys()) {
    const { error } = await supabase.from('crm_organisations').delete().eq('id', id)
    if (error) throw error
  }

  console.log(`\ndeleted ${oppMerge.size} opportunities and ${orgMerge.size} organisations`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
