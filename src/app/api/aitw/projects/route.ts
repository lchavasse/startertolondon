import { NextRequest, NextResponse } from 'next/server'
import {
  getAitwClient,
  getBuilderByEmail,
  identityPayload,
  normalizeEmail,
} from '@/lib/aitw'

// Project-name search for the "join a team" flow.
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim()
  if (q.length < 2) return NextResponse.json({ projects: [] })

  try {
    const supabase = getAitwClient()
    const { data, error } = await supabase
      .from('aitw_projects')
      .select('id, name, aitw_builders(name)')
      .ilike('name', `%${q.replace(/[%_]/g, '')}%`)
      .order('name')
      .limit(10)
    if (error) throw error
    return NextResponse.json({
      projects: (data ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        members: p.aitw_builders.map((b) => b.name),
      })),
    })
  } catch (err) {
    console.error('aitw/projects search failed', err)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}

// Create a project and move the caller onto it.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const email = normalizeEmail(body.email)
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim() : null
  if (!email) return NextResponse.json({ error: 'invalid_email' }, { status: 400 })
  if (!name) return NextResponse.json({ error: 'missing_name' }, { status: 400 })

  try {
    const supabase = getAitwClient()
    const builder = await getBuilderByEmail(supabase, email)
    if (!builder) return NextResponse.json({ error: 'unknown_email' }, { status: 404 })

    const { data: project, error } = await supabase
      .from('aitw_projects')
      .insert({ name, description })
      .select('*')
      .single()
    if (error) throw error

    const { error: moveError } = await supabase
      .from('aitw_builders')
      .update({ project_id: project.id })
      .eq('id', builder.id)
    if (moveError) throw moveError

    builder.project_id = project.id
    return NextResponse.json(await identityPayload(supabase, builder), { status: 201 })
  } catch (err) {
    console.error('aitw/projects create failed', err)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}

// Edit the caller's project. Setting submissionUrl stamps submitted_at —
// late submissions are allowed, just flagged (soft lock).
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const email = normalizeEmail(body.email)
  if (!email) return NextResponse.json({ error: 'invalid_email' }, { status: 400 })

  const updates: Record<string, string | null> = {}
  if (typeof body.name === 'string' && body.name.trim()) updates.name = body.name.trim()
  if (typeof body.description === 'string') updates.description = body.description.trim() || null
  if (typeof body.submissionUrl === 'string') {
    const url = body.submissionUrl.trim()
    if (url && !/^https?:\/\//.test(url)) {
      return NextResponse.json({ error: 'invalid_url' }, { status: 400 })
    }
    updates.submission_url = url || null
    updates.submitted_at = url ? new Date().toISOString() : null
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no_updates' }, { status: 400 })
  }
  updates.updated_at = new Date().toISOString()

  try {
    const supabase = getAitwClient()
    const builder = await getBuilderByEmail(supabase, email)
    if (!builder) return NextResponse.json({ error: 'unknown_email' }, { status: 404 })
    if (!builder.project_id) return NextResponse.json({ error: 'no_team' }, { status: 400 })

    const { error } = await supabase
      .from('aitw_projects')
      .update(updates)
      .eq('id', builder.project_id)
    if (error) throw error

    return NextResponse.json(await identityPayload(supabase, builder))
  } catch (err) {
    console.error('aitw/projects update failed', err)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
