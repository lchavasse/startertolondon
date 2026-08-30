import { createClient } from '@supabase/supabase-js'

const DRY_RUN = process.argv.includes('--dry-run')

// Falling back to updated_at/created_at stamps every untouched row with its import date, which the
// UI would then report as "N days since activity". That is import age, not activity. Opt in only
// when you actually want that.
const ALLOW_FALLBACK = process.argv.includes('--fallback-to-updated-at')

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing env var: ${name}`)
  return value
}

const supabase = createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'))

function newest(...values: Array<string | null | undefined>): string | null {
  const times = values.filter((value): value is string => Boolean(value))
  if (!times.length) return null
  return times.reduce((a, b) => (new Date(a).getTime() >= new Date(b).getTime() ? a : b))
}

async function main() {
  const [opportunities, interactions, outreach] = await Promise.all([
    supabase.from('crm_opportunities').select('id, title, last_activity_at, updated_at, created_at'),
    supabase.from('crm_interactions').select('opportunity_id, happened_at'),
    supabase.from('crm_outreach_entries').select('opportunity_id, happened_at'),
  ])

  for (const result of [opportunities, interactions, outreach]) {
    if (result.error) throw result.error
  }

  const newestByOpportunity = new Map<string, string>()
  for (const row of [...(interactions.data ?? []), ...(outreach.data ?? [])] as Array<{ opportunity_id: string | null; happened_at: string | null }>) {
    if (!row.opportunity_id || !row.happened_at) continue
    const current = newestByOpportunity.get(row.opportunity_id)
    newestByOpportunity.set(row.opportunity_id, newest(current, row.happened_at)!)
  }

  const rows = (opportunities.data ?? []) as Array<{ id: string; title: string; last_activity_at: string | null; updated_at: string | null; created_at: string | null }>

  let fromActivity = 0
  let fromUpdatedAt = 0
  let skipped = 0
  const updates: Array<{ id: string; last_activity_at: string }> = []

  for (const row of rows) {
    if (row.last_activity_at) {
      skipped += 1
      continue
    }
    const activity = newestByOpportunity.get(row.id)
    const value = activity ?? (ALLOW_FALLBACK ? newest(row.updated_at, row.created_at) : null)
    if (!value) {
      skipped += 1
      continue
    }
    if (activity) fromActivity += 1
    else fromUpdatedAt += 1
    updates.push({ id: row.id, last_activity_at: value })
  }

  console.log(`opportunities: ${rows.length}`)
  console.log(`  already set or no derivable history, skipped: ${skipped}`)
  console.log(`  from interaction/outreach history: ${fromActivity}`)
  console.log(`  fallback to updated_at/created_at: ${fromUpdatedAt}${ALLOW_FALLBACK ? '' : ' (disabled — pass --fallback-to-updated-at)'}`)
  console.log(`  to write: ${updates.length}`)

  if (DRY_RUN) {
    console.log('\n--dry-run, nothing written')
    return
  }

  for (const update of updates) {
    const { error } = await supabase.from('crm_opportunities').update({ last_activity_at: update.last_activity_at }).eq('id', update.id)
    if (error) throw error
  }

  console.log(`\nwrote last_activity_at on ${updates.length} opportunities`)
  console.log('next_followup_at deliberately left alone — that is an operator decision, not a derived value')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
