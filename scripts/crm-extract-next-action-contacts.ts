import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'node:fs'
import { classifyContacts, type ClassifiedContact } from '../src/lib/llm/contact-classifier'

const DRY_RUN = !process.argv.includes('--commit')
const MIN_CONFIDENCE = 0.6

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing env var: ${name}`)
  return value
}

const supabase = createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'))

// The 10 July sheet import mapped a "who" column into crm_opportunities.next_action. None of the
// values is an action. Pull out the people and LinkedIn URLs, preserve every original verbatim in
// notes_freeform, then clear the field so the chase queue stops reporting a next action that isn't.

function normaliseName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

async function main() {
  const [{ data: opportunities, error: oppError }, { data: people, error: peopleError }, { data: oppPeople, error: oppPeopleError }, { data: contactPoints, error: contactError }, { data: oppOrgs, error: oppOrgsError }] = await Promise.all([
    supabase.from('crm_opportunities').select('id, title, next_action, notes_freeform').not('next_action', 'is', null),
    supabase.from('crm_people').select('id, full_name, slug, linkedin_url'),
    supabase.from('crm_opportunity_people').select('opportunity_id, person_id'),
    supabase.from('crm_contact_points').select('entity_type, entity_id, channel, value'),
    supabase.from('crm_opportunity_organisations').select('opportunity_id, organisation_id'),
  ])
  if (oppError) throw oppError
  if (peopleError) throw peopleError
  if (oppPeopleError) throw oppPeopleError
  if (contactError) throw contactError
  if (oppOrgsError) throw oppOrgsError

  const orgByOpportunity = new Map(((oppOrgs ?? []) as Array<{ opportunity_id: string; organisation_id: string }>).map((l) => [l.opportunity_id, l.organisation_id]))

  const rows = (opportunities ?? []) as Array<{ id: string; title: string; next_action: string; notes_freeform: string | null }>
  const distinct = [...new Set(rows.map((row) => row.next_action))]
  console.log(`opportunities with a next_action value: ${rows.length} (${distinct.length} distinct)`)
  console.log('classifying with Haiku...\n')

  const classified = await classifyContacts(distinct)
  const byRaw = new Map(classified.map((row) => [row.raw, row]))

  const counts: Record<string, number> = {}
  for (const row of classified) counts[row.kind] = (counts[row.kind] ?? 0) + 1
  for (const [kind, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) console.log(`  ${kind.padEnd(15)} ${n}`)

  for (const kind of ['person', 'linkedin_url', 'organisation', 'not_a_contact', 'unclear']) {
    const group = classified.filter((row) => row.kind === kind)
    if (!group.length) continue
    console.log(`\n--- ${kind} (${group.length}) ---`)
    for (const row of group) {
      const bits = [
        row.personName ? `person=${row.personName}` : '',
        row.organisationName ? `org=${row.organisationName}` : '',
        row.routeVia ? `via=${row.routeVia}` : '',
        row.linkedinUrl ? `li=${row.linkedinUrl.replace('https://www.linkedin.com/in/', '')}` : '',
      ].filter(Boolean).join(' ')
      console.log(`  ${JSON.stringify(row.raw).padEnd(30)} ${bits.padEnd(46)} ${row.confidence.toFixed(2)} ${row.reason}`)
    }
  }

  writeFileSync('scripts/.crm-next-action-decisions.json', JSON.stringify(classified, null, 2))
  console.log('\ndecisions written to scripts/.crm-next-action-decisions.json')

  const willCreate = classified.filter(
    (row) =>
      row.personName &&
      ((row.kind === 'person' && row.confidence >= MIN_CONFIDENCE) || (row.kind === 'linkedin_url' && row.confidence >= 0.9)),
  )
  const singleToken = willCreate.filter((row) => row.personName!.trim().split(/\s+/).length === 1)
  console.log(`\nwould create/link people for ${willCreate.length} distinct values`)
  console.log(`  of which single-token names (scoped per opportunity, never merged): ${singleToken.length}`)
  const urlOnly = classified.filter((row) => row.linkedinUrl && !willCreate.includes(row))
  console.log(`would record ${willCreate.filter((row) => row.linkedinUrl).length} LinkedIn contact points on people`)
  console.log(`would record ${urlOnly.length} LinkedIn URLs on the linked organisation (identity deferred to enrichment)`)
  console.log(`all ${rows.length} original values preserved to notes_freeform regardless of verdict`)

  if (DRY_RUN) {
    console.log('\nDRY RUN — nothing written. Re-run with --commit to apply.')
    return
  }

  const peopleByName = new Map(((people ?? []) as Array<{ id: string; full_name: string; slug: string }>).map((p) => [normaliseName(p.full_name), p]))
  const existingLinks = new Set(((oppPeople ?? []) as Array<{ opportunity_id: string; person_id: string }>).map((l) => `${l.opportunity_id}:${l.person_id}`))
  const existingContacts = new Set(((contactPoints ?? []) as Array<{ entity_type: string; entity_id: string; channel: string; value: string }>).map((c) => `${c.entity_type}:${c.entity_id}:${c.channel}:${c.value}`))
  const usedSlugs = new Set(((people ?? []) as Array<{ slug: string }>).map((p) => p.slug))

  let createdPeople = 0
  let linkedPeople = 0
  let createdContacts = 0

  for (const row of rows) {
    const verdict = byRaw.get(row.next_action) as ClassifiedContact | undefined

    // A LinkedIn URL is the strongest signal in this data, but names guessed from a handle are
    // unreliable ("donnchafenton" -> "Donn Chafe Nton"), so demand near-certainty for those.
    const isPerson =
      verdict &&
      verdict.personName &&
      ((verdict.kind === 'person' && verdict.confidence >= MIN_CONFIDENCE) ||
        (verdict.kind === 'linkedin_url' && verdict.confidence >= 0.9))

    if (verdict && isPerson && verdict.personName) {
      // Only a full name is safe to reuse across opportunities. Two sponsors both listing "Tom"
      // are not evidence of one person, so single-token names stay scoped to their opportunity.
      const isFullName = verdict.personName.trim().split(/\s+/).length > 1
      const key = isFullName ? normaliseName(verdict.personName) : `${row.id}:${normaliseName(verdict.personName)}`
      let person = peopleByName.get(key)
      if (!person) {
        let slug = slugify(verdict.personName)
        let n = 2
        while (usedSlugs.has(slug)) slug = `${slugify(verdict.personName)}-${n++}`
        usedSlugs.add(slug)
        const notes = [
          verdict.organisationName ? `Sheet says: ${verdict.organisationName}` : '',
          verdict.routeVia ? `Warm route via ${verdict.routeVia}` : '',
          `Recovered from the sheet "who" column: ${verdict.raw}`,
        ].filter(Boolean).join('\n')
        const { data, error } = await supabase
          .from('crm_people')
          .insert({ full_name: verdict.personName, slug, notes_freeform: notes, linkedin_url: verdict.linkedinUrl })
          .select('id, full_name, slug')
          .single()
        if (error) throw error
        person = data as { id: string; full_name: string; slug: string }
        peopleByName.set(key, person)
        createdPeople += 1
      }

      if (!existingLinks.has(`${row.id}:${person.id}`)) {
        const { error } = await supabase.from('crm_opportunity_people').insert({ opportunity_id: row.id, person_id: person.id, role_label: 'sheet contact' })
        if (error) throw error
        existingLinks.add(`${row.id}:${person.id}`)
        linkedPeople += 1
      }

      if (verdict.linkedinUrl) {
        const key2 = `person:${person.id}:linkedin:${verdict.linkedinUrl}`
        if (!existingContacts.has(key2)) {
          const { error } = await supabase.from('crm_contact_points').insert({
            entity_type: 'person',
            entity_id: person.id,
            channel: 'linkedin',
            value: verdict.linkedinUrl,
            label: 'from sheet',
            is_primary: true,
          })
          if (error) throw error
          existingContacts.add(key2)
          createdContacts += 1
        }
      }
    }

    // A bare LinkedIn URL with no confident name: the URL and the opportunity it was filed against
    // are both certain, only the identity is not. Hang it off the organisation and let a later
    // enrichment pass resolve who it is, rather than inventing a name from the handle.
    if (verdict && verdict.linkedinUrl && !isPerson) {
      const organisationId = orgByOpportunity.get(row.id)
      if (organisationId) {
        const key = `organisation:${organisationId}:linkedin:${verdict.linkedinUrl}`
        if (!existingContacts.has(key)) {
          const { error } = await supabase.from('crm_contact_points').insert({
            entity_type: 'organisation',
            entity_id: organisationId,
            channel: 'linkedin',
            value: verdict.linkedinUrl,
            label: 'from sheet — person not yet identified',
            notes: `Filed against "${row.title}" in the sheet "who" column`,
          })
          if (error) throw error
          existingContacts.add(key)
          createdContacts += 1
        }
      }
    }

    // Preserved for every row regardless of verdict, so nothing is lost to a misclassification.
    const preserved = [row.notes_freeform, `Sheet contact column: ${row.next_action}`].filter(Boolean).join('\n')
    const { error } = await supabase.from('crm_opportunities').update({ notes_freeform: preserved, next_action: null }).eq('id', row.id)
    if (error) throw error
  }

  console.log(`\ncreated ${createdPeople} people, ${linkedPeople} opportunity links, ${createdContacts} contact points`)
  console.log(`preserved ${rows.length} original values into notes_freeform and cleared next_action`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
