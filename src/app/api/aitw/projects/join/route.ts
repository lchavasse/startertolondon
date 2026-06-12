import { NextRequest, NextResponse } from 'next/server'
import {
  getAitwClient,
  getBuilderByEmail,
  identityPayload,
  normalizeEmail,
} from '@/lib/aitw'

// Move yourself to any project (projectId) or leave your team (projectId: null).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const email = normalizeEmail(body.email)
  const projectId = typeof body.projectId === 'string' ? body.projectId : null
  if (!email) return NextResponse.json({ error: 'invalid_email' }, { status: 400 })

  try {
    const supabase = getAitwClient()
    const builder = await getBuilderByEmail(supabase, email)
    if (!builder) return NextResponse.json({ error: 'unknown_email' }, { status: 404 })

    if (projectId) {
      const { data: project, error } = await supabase
        .from('aitw_projects')
        .select('id')
        .eq('id', projectId)
        .maybeSingle()
      if (error) throw error
      if (!project) return NextResponse.json({ error: 'unknown_project' }, { status: 404 })
    }

    const { error: moveError } = await supabase
      .from('aitw_builders')
      .update({ project_id: projectId })
      .eq('id', builder.id)
    if (moveError) throw moveError

    builder.project_id = projectId
    return NextResponse.json(await identityPayload(supabase, builder))
  } catch (err) {
    console.error('aitw/projects/join failed', err)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
