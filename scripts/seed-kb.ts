/**
 * KB seed script.
 *
 * Reads a batch file (markdown with per-entity YAML blocks) and upserts entities
 * + joins into Supabase. Uses the service role key so it bypasses RLS.
 *
 * Usage:
 *   npm run seed:kb -- docs/kb-seeds/<batch>.md [--dry-run]
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse as parseYaml } from 'yaml'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/lib/database.types'

type Kind = 'space' | 'community' | 'person' | 'event_series' | 'vc' | 'programme' | 'company'
type Entity = { kind: Kind; slug: string; fields: Record<string, unknown> }

const REF_FIELDS: Record<Kind, Record<string, { table: Kind; joinTable: string; leftKey: string; rightKey: string; role?: string }>> = {
  space: {},
  person: {},
  community: {
    lives_at: { table: 'space', joinTable: 'community_spaces', leftKey: 'community_id', rightKey: 'space_id' },
    led_by:   { table: 'person', joinTable: 'community_people', leftKey: 'community_id', rightKey: 'person_id', role: 'lead' },
  },
  event_series: {
    hosted_at: { table: 'space', joinTable: 'event_series_spaces', leftKey: 'event_series_id', rightKey: 'space_id' },
    hosted_by: { table: 'person', joinTable: 'event_series_people', leftKey: 'event_series_id', rightKey: 'person_id', role: 'host' },
    under:     { table: 'community', joinTable: 'community_event_series', leftKey: 'community_id', rightKey: 'event_series_id' },
  },
  vc: {},
  programme: {},
  company: {
    based_at:    { table: 'space',  joinTable: 'company_spaces', leftKey: 'company_id', rightKey: 'space_id' },
    founded_by:  { table: 'person', joinTable: 'company_people', leftKey: 'company_id', rightKey: 'person_id', role: 'founder' },
  },
}

const TABLE_NAME: Record<Kind, keyof Database['public']['Tables']> = {
  space: 'spaces',
  community: 'communities',
  person: 'people',
  event_series: 'event_series',
  vc: 'vcs',
  programme: 'programmes',
  company: 'companies',
}

// ─── Parse the batch file ────────────────────────────────────────────────────

function parseBatch(path: string): Entity[] {
  const src = readFileSync(path, 'utf8')
  const entities: Entity[] = []

  // Split on headings like `## kind: slug`, grab the following ```yaml block.
  // Kinds are derived from TABLE_NAME so adding a new entity table only requires
  // updating TABLE_NAME + REF_FIELDS — the parser auto-picks it up.
  const kindAlternation = Object.keys(TABLE_NAME).join('|')
  const headingRe = new RegExp(`^##\\s+(${kindAlternation}):\\s+([a-z0-9-]+)\\s*$`, 'gm')
  const matches = [...src.matchAll(headingRe)]

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]
    const kind = m[1] as Kind
    const slug = m[2]
    const start = m.index! + m[0].length
    const end = i + 1 < matches.length ? matches[i + 1].index! : src.length
    const section = src.slice(start, end)
    const yamlMatch = section.match(/```yaml\n([\s\S]*?)```/)
    if (!yamlMatch) throw new Error(`Missing \`\`\`yaml block for ${kind}: ${slug}`)
    const fields = parseYaml(yamlMatch[1]) as Record<string, unknown>
    entities.push({ kind, slug, fields })
  }

  return entities
}

// ─── Upsert leaf entities ────────────────────────────────────────────────────

async function upsertEntities(
  supabase: ReturnType<typeof createClient<Database>>,
  entities: Entity[],
  dryRun: boolean
): Promise<Map<string, string>> {
  // Returns map: `${kind}:${slug}` → id
  const ids = new Map<string, string>()

  for (const ent of entities) {
    const { kind, slug, fields } = ent
    const refFields = REF_FIELDS[kind]
    const row: Record<string, unknown> = { slug }
    for (const [key, value] of Object.entries(fields)) {
      if (key in refFields) continue // slug-refs handled in join pass
      row[key] = value
    }

    const table = TABLE_NAME[kind]
    console.log(`  ${dryRun ? '[dry]' : '[upsert]'} ${kind}:${slug} → ${table}`)

    if (dryRun) {
      ids.set(`${kind}:${slug}`, '<new-id>')
      continue
    }

    const { data, error } = await supabase
      // @ts-expect-error dynamic table name
      .from(table)
      .upsert(row, { onConflict: 'slug' })
      .select('id, slug')
      .single()
    if (error) throw new Error(`Upsert failed for ${kind}:${slug} — ${error.message}`)
    ids.set(`${kind}:${slug}`, (data as { id: string }).id)
  }

  return ids
}

// ─── Write join rows ─────────────────────────────────────────────────────────

async function writeJoins(
  supabase: ReturnType<typeof createClient<Database>>,
  entities: Entity[],
  ids: Map<string, string>,
  dryRun: boolean
): Promise<void> {
  for (const ent of entities) {
    const { kind, slug, fields } = ent
    const refs = REF_FIELDS[kind]
    const leftKey = `${kind}:${slug}`
    const leftId = ids.get(leftKey)
    if (!leftId) throw new Error(`Missing id for ${leftKey}`)

    for (const [fieldName, spec] of Object.entries(refs)) {
      const targets = (fields[fieldName] as string[] | undefined) ?? []
      if (!targets.length) continue

      // Build rows. For community_event_series the left side is community (under: [community]).
      const rows = targets.map((targetSlug) => {
        const targetKey = `${spec.table}:${targetSlug}`
        const targetId = ids.get(targetKey)
        if (!targetId) throw new Error(`Unknown slug ref: ${targetKey} (from ${leftKey}.${fieldName})`)

        // Special-case: `under` on event_series means community is the LEFT of community_event_series
        if (kind === 'event_series' && fieldName === 'under') {
          return { community_id: targetId, event_series_id: leftId }
        }

        const row: Record<string, unknown> = { [spec.leftKey]: leftId, [spec.rightKey]: targetId }
        if (spec.role) row.role = spec.role
        return row
      })

      console.log(`  ${dryRun ? '[dry]' : '[join]'} ${spec.joinTable} ${leftKey}.${fieldName} → ${targets.join(',')}`)

      if (dryRun) continue

      // Idempotent: delete existing rows for this left side, then insert.
      // For `under` we scope by event_series_id instead.
      const scopeKey = kind === 'event_series' && fieldName === 'under' ? 'event_series_id' : spec.leftKey
      const { error: delErr } = await supabase
        // @ts-expect-error dynamic table name
        .from(spec.joinTable)
        .delete()
        .eq(scopeKey, leftId)
      if (delErr) throw new Error(`Delete failed for ${spec.joinTable} ${leftKey} — ${delErr.message}`)

      const { error: insErr } = await supabase
        // @ts-expect-error dynamic table name
        .from(spec.joinTable)
        .insert(rows)
      if (insErr) throw new Error(`Insert failed for ${spec.joinTable} ${leftKey} — ${insErr.message}`)
    }
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const path = args.find((a) => !a.startsWith('--'))
  if (!path) {
    console.error('Usage: npm run seed:kb -- <batch.md> [--dry-run]')
    process.exit(1)
  }
  const abs = resolve(path)
  if (!existsSync(abs)) {
    console.error(`Batch file not found: ${abs}`)
    process.exit(1)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')

  const supabase = createClient<Database>(url, key, {
    auth: { persistSession: false },
  })

  const entities = parseBatch(abs)
  console.log(`Parsed ${entities.length} entities from ${path}${dryRun ? ' (dry-run)' : ''}\n`)

  console.log('— leaves —')
  const ids = await upsertEntities(supabase, entities, dryRun)
  console.log('\n— joins —')
  await writeJoins(supabase, entities, ids, dryRun)
  console.log(`\n${dryRun ? 'Dry run complete' : 'Seed complete'}. ${entities.length} entities processed.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
