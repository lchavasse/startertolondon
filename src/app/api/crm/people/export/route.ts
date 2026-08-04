import { NextRequest, NextResponse } from 'next/server'
import { getCrmServiceClient } from '@/lib/crm/server'

// CSV export for the sourcing pool. Server-rendered rather than built in the browser: the earlier
// version lived in a published artifact, where the sandboxed iframe blocks both downloads and
// clipboard writes, so the buttons could never have worked.
//
// ?group=top_founder   one profile
// ?shortlisted=1       only what the operator ticked
// no params            everything

const COLUMNS: Array<[string, (r: Record<string, any>) => unknown]> = [
  ['fit', (r) => r.fit],
  ['name', (r) => r.full_name],
  ['company', (r) => r.company],
  ['group', (r) => r.event_group],
  ['pillars', (r) => (r.pillars ?? []).join(' ')],
  ['seniority', (r) => r.seniority],
  ['role', (r) => r.role_type],
  ['sector', (r) => r.scanner_sector],
  ['physical', (r) => (r.is_physical == null ? '' : r.is_physical ? 'yes' : 'no')],
  ['industrial_score', (r) => r.industrial_score],
  ['stage', (r) => r.company_stage],
  ['location', (r) => r.location],
  ['route', (r) => (r.last_message_at ? `talked ${String(r.last_message_at).slice(0, 10)}` : r.is_connection ? 'connection' : 'not connected')],
  ['owes_reply', (r) => (r.awaiting_reply_from === 'lachlan' ? 'yes' : '')],
  ['shortlisted', (r) => (r.shortlisted ? 'yes' : '')],
  ['note', (r) => r.note],
  ['confidence', (r) => r.confidence],
  ['why', (r) => r.evidence],
  ['linkedin', (r) => r.profile_url],
  ['website', (r) => r.company_website],
]

function cell(value: unknown) {
  const s = value == null ? '' : String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// Checked here as well as in middleware. This route dumps the whole sourcing pool — names,
// employers and LinkedIn URLs — so it should not be one misplaced config file away from public.
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET
  if (secret && (req.headers.get('x-admin-key') === secret || req.cookies.get('crm_admin_key')?.value === secret)) return true
  const agent = process.env.CRM_AGENT_TOKEN
  return Boolean(agent && req.headers.get('authorization') === `Bearer ${agent}`)
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const group = url.searchParams.get('group')
  const shortlisted = url.searchParams.get('shortlisted') === '1'
  const flagged = url.searchParams.get('flagged') === '1'
  const pillar = url.searchParams.get('pillar')

  const supabase = getCrmServiceClient()
  let query = supabase.from('crm_people_pool').select('*').order('fit', { ascending: false }).limit(10000)
  if (group) query = query.eq('event_group', group)
  if (shortlisted) query = query.eq('shortlisted', true)
  if (flagged) query = query.not('note', 'is', null)
  if (pillar) query = query.contains('pillars', [pillar])

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = data ?? []
  const csv = [
    COLUMNS.map(([h]) => h).join(','),
    ...rows.map((r) => COLUMNS.map(([, get]) => cell(get(r as Record<string, any>))).join(',')),
  ].join('\n')

  const name = [
    'deeptech',
    group ?? (shortlisted ? 'shortlist' : 'all'),
    flagged ? 'flagged' : null,
    pillar,
  ].filter(Boolean).join('-')

  // ﻿ so Excel opens UTF-8 names correctly rather than mangling them.
  return new NextResponse('﻿' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
