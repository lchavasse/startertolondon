import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'

const DRY_RUN = !process.argv.includes('--commit')

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing env var: ${name}`)
  return value
}

const supabase = createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'))

// The Notion importer walked one planning page and wrote every block as a separate
// crm_interaction — 55 rows, all direction='internal', all from the same source_url, none linked to
// an opportunity, person or organisation. They are not interactions; an interaction is a
// conversation with someone. They are one document.
//
// So: rebuild them as a single crm_source_documents note (which is what the enrichment substrate is
// for), lift the LinkedIn URLs out as real contact points, and drop the interaction rows. Nothing is
// lost — the full text of every block is preserved in the document, in order.

const LINKEDIN = /https?:\/\/(?:www\.)?linkedin\.com\/in\/[A-Za-z0-9\-_%]+/

function normalise(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

async function main() {
  const [{ data: interactions, error: intError }, { data: organisations, error: orgError }, { data: contactPoints, error: cpError }, { data: sourceLinks, error: slError }] = await Promise.all([
    supabase.from('crm_interactions').select('*').order('happened_at', { ascending: true }),
    supabase.from('crm_organisations').select('id, name'),
    supabase.from('crm_contact_points').select('entity_type, entity_id, channel, value'),
    supabase.from('crm_source_links').select('id, entity_type, entity_id'),
  ])
  if (intError) throw intError
  if (orgError) throw orgError
  if (cpError) throw cpError
  if (slError) throw slError

  const rows = (interactions ?? []) as Array<Record<string, any>>
  const notionBlocks = rows.filter((row) => row.source_system === 'notion' && !row.opportunity_id && !row.person_id && !row.organisation_id)

  if (!notionBlocks.length) {
    console.log('no orphaned Notion interaction rows found — nothing to do')
    return
  }

  const pages = [...new Set(notionBlocks.map((row) => row.source_url))]
  console.log(`orphaned Notion interaction rows: ${notionBlocks.length} across ${pages.length} page(s)`)

  const orgByName = new Map(((organisations ?? []) as Array<{ id: string; name: string }>).map((org) => [normalise(org.name), org]))
  const existingContacts = new Set(((contactPoints ?? []) as Array<Record<string, any>>).map((c) => `${c.entity_type}:${c.entity_id}:${c.channel}:${c.value}`))

  type Extraction = { url: string; firm: string | null; organisationId: string | null; block: string }
  const extractions: Extraction[] = []
  for (const block of notionBlocks) {
    const text: string = block.summary ?? ''
    const match = text.match(LINKEDIN)
    if (!match) continue
    // "Balderton - https://linkedin.com/in/..." — the firm, when present, precedes the URL
    const before = text.slice(0, match.index).replace(/[-–—:]\s*$/, '').replace(/\(\?\)/g, '').trim()
    const org = before ? orgByName.get(normalise(before)) : undefined
    extractions.push({ url: match[0], firm: before || null, organisationId: org?.id ?? null, block: text })
  }

  console.log(`\nLinkedIn URLs found: ${extractions.length}`)
  for (const e of extractions) {
    const target = e.organisationId ? `-> organisation "${e.firm}"` : e.firm ? `firm "${e.firm}" has no crm_organisations row` : 'no firm named'
    console.log(`  ${e.url.padEnd(58)} ${target}`)
  }

  const attributable = extractions.filter((e) => e.organisationId)
  const unattributed = extractions.filter((e) => !e.organisationId)
  console.log(`\n  attachable to an organisation: ${attributable.length}`)
  console.log(`  unattributed (kept in document metadata): ${unattributed.length}`)

  const documentText = notionBlocks
    .map((row, index) => `${index + 1}. ${row.summary ?? ''}${row.raw_excerpt && row.raw_excerpt !== row.summary ? `\n   ${row.raw_excerpt}` : ''}`)
    .join('\n')

  const contentHash = createHash('sha256').update(`notion:${pages[0]}:${documentText}`).digest('hex')

  console.log(`\ndocument to create: ${documentText.length} chars, ${notionBlocks.length} blocks, hash ${contentHash.slice(0, 12)}`)
  writeFileSync('scripts/.crm-notion-document.txt', documentText)
  console.log('full text written to scripts/.crm-notion-document.txt for review')

  const linksToDrop = ((sourceLinks ?? []) as Array<Record<string, any>>).filter(
    (link) => link.entity_type === 'interaction' && notionBlocks.some((row) => row.id === link.entity_id),
  )
  console.log(`source_links pointing at these interactions, to delete: ${linksToDrop.length}`)

  if (DRY_RUN) {
    console.log('\nDRY RUN — nothing written. Re-run with --commit to apply.')
    return
  }

  const { data: existingDoc } = await supabase.from('crm_source_documents').select('id').eq('content_hash', contentHash).maybeSingle()

  let documentId = existingDoc?.id as string | undefined
  if (!documentId) {
    const { data, error } = await supabase
      .from('crm_source_documents')
      .insert({
        source_system: 'notion',
        document_type: 'note',
        url: pages[0],
        title: 'DeepTech London planning page (recovered from mis-imported interactions)',
        raw_text: documentText,
        content_hash: contentHash,
        fetched_at: new Date().toISOString(),
        metadata: {
          recovered_from: 'crm_interactions',
          original_row_count: notionBlocks.length,
          notion_pages: pages,
          unattributed_linkedin_urls: unattributed.map((e) => e.url),
        },
      })
      .select('id')
      .single()
    if (error) throw error
    documentId = data.id
  }

  let created = 0
  for (const e of attributable) {
    const key = `organisation:${e.organisationId}:linkedin:${e.url}`
    if (existingContacts.has(key)) continue
    const { error } = await supabase.from('crm_contact_points').insert({
      entity_type: 'organisation',
      entity_id: e.organisationId,
      channel: 'linkedin',
      value: e.url,
      label: 'from Notion planning page',
      notes: `Recovered from: ${e.block}`,
    })
    if (error) throw error
    existingContacts.add(key)
    created += 1
  }

  for (const link of linksToDrop) {
    const { error } = await supabase.from('crm_source_links').delete().eq('id', link.id)
    if (error) throw error
  }

  for (const row of notionBlocks) {
    const { error } = await supabase.from('crm_interactions').delete().eq('id', row.id)
    if (error) throw error
  }

  console.log(`\ncreated source document ${documentId}`)
  console.log(`created ${created} organisation contact points`)
  console.log(`deleted ${linksToDrop.length} source links and ${notionBlocks.length} interaction rows`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
