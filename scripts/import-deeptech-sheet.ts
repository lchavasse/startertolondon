import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const SHEET_ID = '1SBbBEiZO0fV7yw5f7w-eSnSkxxtWk8aiLQz0aJBEbWo'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

type Row = Record<string, string>

type OwnerSlug = 'lachlan' | 'barrett'

function slugify(value: string, fallback?: string) {
  const base = value
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (base && base !== 'item') return base
  const fallbackSlug = fallback
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return fallbackSlug ? `item-${fallbackSlug}` : 'item'
}

function compact(...parts: Array<string | null | undefined>) {
  const cleaned = parts.map((part) => part?.trim()).filter(Boolean)
  return cleaned.length ? cleaned.join(' | ') : null
}

function ownerSlug(raw?: string | null): OwnerSlug | null {
  const value = raw?.trim().toLowerCase()
  if (!value) return null
  if (['lc', 'lachlan'].includes(value)) return 'lachlan'
  if (['barrett', 'bh'].includes(value)) return 'barrett'
  return null
}

async function getUsers() {
  const { data, error } = await supabase.from('crm_users').select('id, slug')
  if (error) throw error
  return new Map((data ?? []).map((row) => [row.slug, row.id]))
}

async function getRows(): Promise<Record<string, Row[]>> {
  const output = execFileSync('python3.12', ['scripts/export-deeptech-sheet.py'], { encoding: 'utf8' })
  return JSON.parse(output)
}

async function findEntityId(entityType: string, sourceRef: string) {
  const { data, error } = await supabase
    .from('crm_source_links')
    .select('entity_id')
    .eq('entity_type', entityType)
    .eq('source_system', 'sheet')
    .eq('source_ref', sourceRef)
    .limit(1)
  if (error) throw error
  return data?.[0]?.entity_id ?? null
}

async function resolveUniqueSlug(table: 'crm_organisations' | 'crm_people', value: string, sourceRef: string, existingId: string | null) {
  const baseSlug = slugify(value, sourceRef)
  const { data, error } = await supabase.from(table).select('id').eq('slug', baseSlug).limit(1)
  if (error) throw error
  const collision = data?.[0]?.id ?? null
  if (!collision || collision === existingId) return baseSlug
  return slugify(`${value}-${sourceRef}`, sourceRef)
}

async function upsertSourceLink(entityType: string, entityId: string, sourceRef: string, sourceUrl: string, metadata: Record<string, unknown>) {
  const { data: existing, error: existingError } = await supabase
    .from('crm_source_links')
    .select('id')
    .eq('entity_type', entityType)
    .eq('source_system', 'sheet')
    .eq('source_ref', sourceRef)
    .limit(1)
  if (existingError) throw existingError
  const payload = {
    ...(existing?.[0]?.id ? { id: existing[0].id } : {}),
    entity_type: entityType,
    entity_id: entityId,
    source_system: 'sheet',
    source_ref: sourceRef,
    source_url: sourceUrl,
    metadata,
    last_synced_at: new Date().toISOString(),
  }
  const { error } = await supabase.from('crm_source_links').upsert(payload)
  if (error) throw error
}

async function upsertOrganisation(sourceRef: string, rowUrl: string, payload: { name: string; org_type: string; owner_user_id: string | null; website?: string | null; linkedin_url?: string | null; relationship_summary?: string | null; notes_freeform?: string | null }) {
  const id = await findEntityId('organisation', sourceRef)
  const slug = await resolveUniqueSlug('crm_organisations', payload.name, sourceRef, id)
  const { data, error } = await supabase.from('crm_organisations').upsert({ ...(id ? { id } : {}), slug, ...payload }).select('*').single()
  if (error) throw error
  await upsertSourceLink('organisation', data.id, sourceRef, rowUrl, { name: payload.name })
  return data
}

async function upsertPerson(sourceRef: string, rowUrl: string, payload: { full_name: string; owner_user_id: string | null; title?: string | null; linkedin_url?: string | null; relationship_summary?: string | null; notes_freeform?: string | null }) {
  const id = await findEntityId('person', sourceRef)
  const slug = await resolveUniqueSlug('crm_people', payload.full_name, sourceRef, id)
  const { data, error } = await supabase.from('crm_people').upsert({ ...(id ? { id } : {}), slug, ...payload }).select('*').single()
  if (error) throw error
  await upsertSourceLink('person', data.id, sourceRef, rowUrl, { full_name: payload.full_name })
  return data
}

async function upsertOpportunity(sourceRef: string, rowUrl: string, payload: { title: string; workstream: string; owner_user_id: string | null; summary?: string | null; next_action?: string | null; notes_freeform?: string | null; ask_type?: string | null; priority?: string | null }, organisations: Array<{ id: string; role_label: string }> = [], people: Array<{ id: string; role_label: string }> = []) {
  const id = await findEntityId('opportunity', sourceRef)
  const { data, error } = await supabase.from('crm_opportunities').upsert({ ...(id ? { id } : {}), status: 'active', priority: 'medium', ...payload }).select('*').single()
  if (error) throw error
  await upsertSourceLink('opportunity', data.id, sourceRef, rowUrl, { title: payload.title })
  await supabase.from('crm_opportunity_organisations').delete().eq('opportunity_id', data.id)
  await supabase.from('crm_opportunity_people').delete().eq('opportunity_id', data.id)
  if (organisations.length) {
    const { error: orgError } = await supabase.from('crm_opportunity_organisations').insert(organisations.map((org) => ({ opportunity_id: data.id, organisation_id: org.id, role_label: org.role_label })))
    if (orgError) throw orgError
  }
  if (people.length) {
    const { error: peopleError } = await supabase.from('crm_opportunity_people').insert(people.map((person) => ({ opportunity_id: data.id, person_id: person.id, role_label: person.role_label })))
    if (peopleError) throw peopleError
  }
  return data
}

async function upsertPersonOrganisation(personId: string, organisationId: string, roleLabel?: string | null, isPrimary = true) {
  const { error } = await supabase
    .from('crm_person_organisations')
    .upsert({ person_id: personId, organisation_id: organisationId, role_label: roleLabel ?? null, is_primary: isPrimary })
  if (error) throw error
}

async function upsertTask(sourceRef: string, rowUrl: string, payload: { title: string; owner_user_id: string | null; description?: string | null; priority?: string | null }) {
  const id = await findEntityId('task', sourceRef)
  const { data, error } = await supabase.from('crm_tasks').upsert({ ...(id ? { id } : {}), status: 'todo', priority: 'medium', ...payload }).select('*').single()
  if (error) throw error
  await upsertSourceLink('task', data.id, sourceRef, rowUrl, { title: payload.title })
  return data
}

async function main() {
  const users = await getUsers()
  const rowsByTab = await getRows()
  const counters = { organisations: 0, people: 0, opportunities: 0, tasks: 0 }

  for (const [tab, rows] of Object.entries(rowsByTab)) {
    for (const row of rows) {
      const rowNumber = row._row
      const sourceRef = `${tab}:${rowNumber}`
      const rowUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=0&range=${rowNumber}:${rowNumber}`
      const ownerId = users.get(ownerSlug(row.Owner ?? row.owner ?? row.assignee ?? '') ?? '') ?? null

      if (tab === 'Sponsors') {
        const name = row.Banks || row.Notes
        if (!name) continue
        const organisation = await upsertOrganisation(sourceRef, rowUrl, {
          name,
          org_type: 'sponsor',
          owner_user_id: ownerId,
          relationship_summary: compact(row.Status, row.Lead),
          notes_freeform: row.Notes || null,
        })
        await upsertOpportunity(`${sourceRef}:opp`, rowUrl, {
          title: `Sponsor: ${name}`,
          workstream: 'sponsor',
          owner_user_id: ownerId,
          summary: row.Notes || null,
          next_action: row.Lead || null,
        }, [{ id: organisation.id, role_label: 'target' }])
        counters.organisations += 1; counters.opportunities += 1
      }

      if (tab === 'VCs') {
        const fund = row.Fund
        if (!fund) continue
        const organisation = await upsertOrganisation(sourceRef, rowUrl, {
          name: fund,
          org_type: 'vc',
          owner_user_id: ownerId,
          relationship_summary: compact(row.Lead, row.Opportunities),
          notes_freeform: row.Notes || null,
        })
        const people: Array<{ id: string; role_label: string }> = []
        if (row.Partner) {
          const person = await upsertPerson(`${sourceRef}:partner`, rowUrl, {
            full_name: row.Partner,
            owner_user_id: ownerId,
            linkedin_url: row.LI || null,
            relationship_summary: `Partner at ${fund}`,
          })
          people.push({ id: person.id, role_label: 'partner' })
          await upsertPersonOrganisation(person.id, organisation.id, 'partner')
          counters.people += 1
        }
        await upsertOpportunity(`${sourceRef}:opp`, rowUrl, {
          title: `VC relationship: ${fund}`,
          workstream: 'sponsor',
          owner_user_id: ownerId,
          summary: compact(row.Lead, row.Notes),
          next_action: row.Opportunities || null,
        }, [{ id: organisation.id, role_label: 'fund' }], people)
        counters.organisations += 1; counters.opportunities += 1
      }

      if (tab === 'Speakers') {
        const company = row.Company
        const founder = row.Founder
        if (!company && !founder) continue
        const people: Array<{ id: string; role_label: string }> = []
        let organisation: { id: string } | null = null
        if (company) {
          organisation = await upsertOrganisation(sourceRef, rowUrl, {
            name: company,
            org_type: 'startup',
            owner_user_id: ownerId,
            relationship_summary: compact(row.Pillar, row.Status),
            notes_freeform: row.Notes || null,
          })
          counters.organisations += 1
        }
        if (founder) {
          const person = await upsertPerson(`${sourceRef}:founder`, rowUrl, {
            full_name: founder,
            owner_user_id: ownerId,
            linkedin_url: row.LI || null,
            relationship_summary: compact('Potential speaker', company),
          })
          people.push({ id: person.id, role_label: 'speaker' })
          if (organisation) await upsertPersonOrganisation(person.id, organisation.id, row.Founder ? 'founder' : 'speaker')
          counters.people += 1
        }
        await upsertOpportunity(`${sourceRef}:opp`, rowUrl, {
          title: `Speaker: ${founder || company}`,
          workstream: 'speaker',
          owner_user_id: ownerId,
          summary: compact(row.Pillar, row.Notes),
          next_action: row.Lead || null,
        }, organisation ? [{ id: organisation.id, role_label: 'company' }] : [], people)
        counters.opportunities += 1
      }

      if (tab === 'Expo') {
        const company = row.Company
        const founder = row['Founder / Lead']
        if (!company && !founder) continue
        const people: Array<{ id: string; role_label: string }> = []
        let organisation: { id: string } | null = null
        if (company) {
          organisation = await upsertOrganisation(sourceRef, rowUrl, {
            name: company,
            org_type: 'startup',
            owner_user_id: ownerId,
            relationship_summary: row.Status || null,
            notes_freeform: row.Notes || null,
          })
          counters.organisations += 1
        }
        if (founder) {
          const person = await upsertPerson(`${sourceRef}:lead`, rowUrl, {
            full_name: founder,
            owner_user_id: ownerId,
            linkedin_url: row.LI || null,
            relationship_summary: compact('Expo lead', company),
          })
          people.push({ id: person.id, role_label: 'lead' })
          if (organisation) await upsertPersonOrganisation(person.id, organisation.id, 'lead')
          counters.people += 1
        }
        await upsertOpportunity(`${sourceRef}:opp`, rowUrl, {
          title: `Expo: ${company || founder}`,
          workstream: 'expo',
          owner_user_id: ownerId,
          summary: row.Notes || null,
          next_action: row.Status || null,
        }, organisation ? [{ id: organisation.id, role_label: 'exhibitor' }] : [], people)
        counters.opportunities += 1
      }

      if (tab === 'Community Partners') {
        const name = row.community
        if (!name) continue
        const organisation = await upsertOrganisation(sourceRef, rowUrl, {
          name,
          org_type: 'community',
          owner_user_id: ownerId,
          relationship_summary: compact(row.status, row.ask),
          notes_freeform: compact(row.lead, row['wb 6th July']),
        })
        await upsertOpportunity(`${sourceRef}:opp`, rowUrl, {
          title: `Community partner: ${name}`,
          workstream: 'community_partner',
          owner_user_id: ownerId,
          summary: row.ask || null,
          next_action: row.lead || null,
        }, [{ id: organisation.id, role_label: 'partner' }])
        counters.organisations += 1; counters.opportunities += 1
      }

      if (tab === 'Important People') {
        const name = row.name
        if (!name) continue
        const person = await upsertPerson(sourceRef, rowUrl, {
          full_name: name,
          owner_user_id: ownerId,
          title: row.role || null,
          linkedin_url: row.link || null,
          relationship_summary: row.action || null,
          notes_freeform: row.ideas || null,
        })
        await upsertOpportunity(`${sourceRef}:opp`, rowUrl, {
          title: `Relationship: ${name}`,
          workstream: 'week_ops',
          owner_user_id: ownerId,
          summary: row.ideas || null,
          next_action: row.action || null,
        }, [], [{ id: person.id, role_label: 'contact' }])
        counters.people += 1; counters.opportunities += 1
      }

      if (tab === 'Jobs List') {
        const title = row['Column 1']
        if (!title) continue
        await upsertTask(sourceRef, rowUrl, {
          title,
          owner_user_id: ownerId,
          description: compact(row.type, row.notes, row.links),
          priority: (row.priority || 'medium').toLowerCase(),
        })
        counters.tasks += 1
      }
    }
  }

  console.log(JSON.stringify(counters, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
