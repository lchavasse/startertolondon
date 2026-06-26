/**
 * List every Agents in the Wild team/project and its members.
 *
 *   npm run aitw:teams              # all teams + members + submission status
 *   npm run aitw:teams -- --solo    # also list builders not yet on a team
 *
 * Read-only. Uses the service role key so it bypasses RLS.
 */
import { createClient } from '@supabase/supabase-js'
import { Database } from '../src/lib/database.types'
import { SUBMISSION_DEADLINE } from '../src/lib/aitw'

async function main() {
  const showSolo = process.argv.includes('--solo')
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: projects, error } = await supabase
    .from('aitw_projects')
    .select('id, name, description, submission_url, submitted_at, created_at, aitw_builders(name, email)')
    .order('created_at')
  if (error) throw error

  console.log(`\n${projects?.length ?? 0} team(s)\n${'='.repeat(40)}`)
  for (const p of projects ?? []) {
    const members = (p.aitw_builders ?? []) as { name: string; email: string }[]
    const submitted = p.submitted_at
      ? `submitted ${p.submitted_at}${new Date(p.submitted_at) > SUBMISSION_DEADLINE ? ' (LATE)' : ''}`
      : 'not submitted'
    console.log(`\n▸ ${p.name}  —  ${submitted}`)
    if (p.description) console.log(`  ${p.description}`)
    for (const m of members) console.log(`  · ${m.name} <${m.email}>`)
    if (members.length === 0) console.log('  (no members)')
    if (p.submission_url) console.log(`  → ${p.submission_url}`)
  }

  if (showSolo) {
    const { data: solo, error: soloError } = await supabase
      .from('aitw_builders')
      .select('name, email')
      .is('project_id', null)
      .order('created_at')
    if (soloError) throw soloError
    console.log(`\n${'='.repeat(40)}\n${solo?.length ?? 0} builder(s) not yet on a team`)
    for (const b of solo ?? []) console.log(`  · ${b.name} <${b.email}>`)
  }

  console.log()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
