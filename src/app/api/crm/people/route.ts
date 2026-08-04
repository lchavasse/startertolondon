import { NextRequest, NextResponse } from 'next/server'
import { getCrmServiceClient } from '@/lib/crm/server'
import { CRM_PEOPLE_GROUPS, CRM_PILLARS } from '@/lib/crm/pillars'

// Writes for the sourcing pool: shortlisting, notes, and hand-corrections to the classifier.
//
// A correction sets `corrected`, which the importer honours by leaving that row's group and pillars
// alone on the next run. Without it a re-import would quietly revert every judgement call.

const CRM_COOKIE = 'crm_admin_key'

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET
  if (secret && (req.headers.get('x-admin-key') === secret || req.cookies.get(CRM_COOKIE)?.value === secret)) return true
  const agent = process.env.CRM_AGENT_TOKEN
  return Boolean(agent && req.headers.get('authorization') === `Bearer ${agent}`)
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const slug = typeof body.slug === 'string' ? body.slug : null
  if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 })

  const patch: Record<string, unknown> = {}

  if ('shortlisted' in body) patch.shortlisted = Boolean(body.shortlisted)
  if ('note' in body) patch.note = typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null

  if (typeof body.event_group === 'string') {
    if (!CRM_PEOPLE_GROUPS.includes(body.event_group as never)) {
      return NextResponse.json({ error: 'Invalid event_group' }, { status: 400 })
    }
    patch.event_group = body.event_group
    patch.corrected = true
  }

  if (Array.isArray(body.pillars)) {
    const clean = body.pillars.filter((p): p is string => typeof p === 'string' && CRM_PILLARS.includes(p as never))
    patch.pillars = clean
    patch.corrected = true
  }

  if (!Object.keys(patch).length) return NextResponse.json({ error: 'nothing to update' }, { status: 400 })

  const supabase = getCrmServiceClient()
  const { data, error } = await supabase.from('crm_people_pool').update(patch).eq('slug', slug).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
