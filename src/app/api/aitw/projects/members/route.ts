import { NextRequest, NextResponse } from 'next/server'
import {
  getAitwClient,
  getBuilderByEmail,
  identityPayload,
  normalizeEmail,
} from '@/lib/aitw'

// Add a builder to the caller's team. No poaching: only builders without a
// team can be added — people move themselves via /projects/join.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const email = normalizeEmail(body.email)
  const builderId = typeof body.builderId === 'string' ? body.builderId : null
  if (!email) return NextResponse.json({ error: 'invalid_email' }, { status: 400 })
  if (!builderId) return NextResponse.json({ error: 'missing_builder' }, { status: 400 })

  try {
    const supabase = getAitwClient()
    const caller = await getBuilderByEmail(supabase, email)
    if (!caller) return NextResponse.json({ error: 'unknown_email' }, { status: 404 })
    if (!caller.project_id) return NextResponse.json({ error: 'no_team' }, { status: 400 })

    // the project_id guard makes this a no-op if they joined a team meanwhile
    const { data: updated, error } = await supabase
      .from('aitw_builders')
      .update({ project_id: caller.project_id })
      .eq('id', builderId)
      .is('project_id', null)
      .select('id')
    if (error) throw error
    if (!updated?.length) {
      return NextResponse.json({ error: 'already_on_a_team' }, { status: 409 })
    }

    return NextResponse.json(await identityPayload(supabase, caller))
  } catch (err) {
    console.error('aitw/projects/members failed', err)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
