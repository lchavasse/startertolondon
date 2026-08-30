const BASE = process.env.CRM_TEST_BASE ?? 'http://localhost:3000'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing env var: ${name}`)
  return value
}

const token = requireEnv('CRM_AGENT_TOKEN')
const authed = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

async function get(query: string, headers: Record<string, string> = authed) {
  const res = await fetch(`${BASE}/api/crm?${query}`, { headers, redirect: 'manual' })
  const text = await res.text()
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    body = text.slice(0, 200)
  }
  return { status: res.status, body }
}

async function post(payload: unknown, headers: Record<string, string> = authed) {
  const res = await fetch(`${BASE}/api/crm`, { method: 'POST', headers, body: JSON.stringify(payload), redirect: 'manual' })
  const text = await res.text()
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    body = text.slice(0, 200)
  }
  return { status: res.status, body }
}

async function main() {
  console.log(`base: ${BASE}\n`)

  console.log('== auth ==')
  const noAuth = await get('entity=chase', { 'Content-Type': 'application/json' })
  console.log(`  no credentials      -> ${noAuth.status} ${noAuth.status === 401 ? 'OK (rejected)' : 'FAIL (expected 401)'}`)
  const badToken = await get('entity=chase', { Authorization: 'Bearer wrong-token' })
  console.log(`  wrong bearer token  -> ${badToken.status} ${badToken.status === 401 ? 'OK (rejected)' : 'FAIL (expected 401)'}`)

  console.log('\n== GET entity=chase ==')
  const chase = await get('entity=chase&limit=5')
  console.log(`  status ${chase.status}`)
  const chaseItems = Array.isArray(chase.body) ? (chase.body as Array<Record<string, any>>) : []
  console.log(`  items: ${chaseItems.length}`)
  for (const item of chaseItems) {
    console.log(
      `    [${String(item.score).padStart(5)}] ${item.opportunity.title.slice(0, 48).padEnd(48)} ${item.reasons.join(',')}` +
        `${item.daysSinceActivity != null ? ` (${item.daysSinceActivity}d since activity)` : ''}`,
    )
  }

  console.log('\n== GET entity=search ==')
  const search = await get('entity=search&q=a&limit=5')
  console.log(`  status ${search.status}`)
  const results = Array.isArray(search.body) ? (search.body as Array<Record<string, any>>) : []
  for (const row of results) console.log(`    ${row.type.padEnd(13)} ${row.label.slice(0, 50)}`)

  console.log('\n== GET entity=opportunities&id= ==')
  const firstId = chaseItems[0]?.opportunity?.id
  if (firstId) {
    const detail = await get(`entity=opportunities&id=${firstId}`)
    const body = detail.body as Record<string, any>
    console.log(`  status ${detail.status} — ${body?.opportunity?.title}`)
    console.log(`  contactPoints ${body?.contactPoints?.length ?? 0}, outreachEntries ${body?.outreachEntries?.length ?? 0}, tasks ${body?.tasks?.length ?? 0}`)
  } else {
    console.log('  skipped — chase queue empty')
  }

  console.log('\n== POST ingest-document ==')
  const doc = await post({
    action: 'ingest-document',
    fields: {
      source_system: 'manual',
      document_type: 'note',
      title: 'agent api smoke test',
      raw_text: 'Smoke test document written by scripts/test-crm-agent-api.ts.',
      metadata: { test: true },
    },
  })
  console.log(`  status ${doc.status} — id ${(doc.body as Record<string, any>)?.id}`)
  const again = await post({
    action: 'ingest-document',
    fields: {
      source_system: 'manual',
      document_type: 'note',
      title: 'agent api smoke test',
      raw_text: 'Smoke test document written by scripts/test-crm-agent-api.ts.',
      metadata: { test: true },
    },
  })
  const firstDocId = (doc.body as Record<string, any>)?.id
  const sameId = Boolean(firstDocId) && firstDocId === (again.body as Record<string, any>)?.id
  console.log(`  re-ingest dedupes by content_hash -> ${sameId ? 'OK (same id)' : 'FAIL (no id, or a new row was created)'}`)

  // Write tests run against a throwaway opportunity so a smoke test never mutates real pipeline data.
  console.log('\n== POST add-outreach-entry coupling (throwaway opportunity) ==')
  const created = await post({
    action: 'upsert-opportunity',
    fields: { title: 'ZZZ smoke test — delete me', workstream: 'week_ops', status: 'active', priority: 'low' },
  })
  const testOppId = (created.body as Record<string, any>)?.id
  if (!testOppId) {
    console.log(`  FAIL — could not create test opportunity: ${JSON.stringify(created.body)}`)
    return
  }
  console.log(`  created ${testOppId}`)
  const beforeOpp = created.body as Record<string, any>
  console.log(`  before: next_action=${JSON.stringify(beforeOpp.next_action)} last_activity_at=${beforeOpp.last_activity_at} next_followup_at=${beforeOpp.next_followup_at}`)

  const nextDue = new Date(Date.now() + 7 * 86_400_000).toISOString()
  const outreach = await post({
    action: 'add-outreach-entry',
    fields: {
      opportunity_id: testOppId,
      channel: 'email',
      direction: 'outbound',
      status: 'sent',
      subject: 'agent api smoke test',
      body_excerpt: 'written by scripts/test-crm-agent-api.ts',
      next_step: 'smoke test next step',
      next_due_at: nextDue,
    },
  })
  console.log(`  add-outreach-entry status ${outreach.status}`)
  const patched = (outreach.body as Record<string, any>)?.opportunity
  console.log(`  after:  next_action=${JSON.stringify(patched?.next_action)} last_activity_at=${patched?.last_activity_at} next_followup_at=${patched?.next_followup_at}`)
  const sameInstant = (a: string | null | undefined, b: string) => Boolean(a) && new Date(a!).getTime() === new Date(b).getTime()
  const coupled = Boolean(patched?.last_activity_at) && patched?.next_action === 'smoke test next step' && sameInstant(patched?.next_followup_at, nextDue)
  console.log(`  parent opportunity updated -> ${coupled ? 'OK' : 'FAIL'}`)

  console.log('\n== POST set-next-step ==')
  const nextStep = await post({
    action: 'set-next-step',
    fields: { opportunity_id: testOppId, next_action: 'revised next step', next_followup_at: nextDue },
  })
  const revised = nextStep.body as Record<string, any>
  console.log(`  status ${nextStep.status} — next_action=${JSON.stringify(revised?.next_action)}`)
  console.log(`  set-next-step applied -> ${revised?.next_action === 'revised next step' ? 'OK' : 'FAIL'}`)

  console.log('\n== cleanup ==')
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'))
  await supabase.from('crm_outreach_entries').delete().eq('opportunity_id', testOppId)
  await supabase.from('crm_interactions').delete().eq('opportunity_id', testOppId)
  await supabase.from('crm_opportunities').delete().eq('id', testOppId)
  const docId = (doc.body as Record<string, any>)?.id
  if (docId) await supabase.from('crm_source_documents').delete().eq('id', docId)
  console.log(`  removed test opportunity ${testOppId}, its outreach/interactions, and source document ${docId}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
