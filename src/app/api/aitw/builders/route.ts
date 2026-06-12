import { NextRequest, NextResponse } from 'next/server'
import {
  getAitwClient,
  getBuilderByEmail,
  identityPayload,
  normalizeEmail,
} from '@/lib/aitw'

// Name search for the add-teammate flow. Returns names only — never emails.
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim()
  if (q.length < 2) return NextResponse.json({ builders: [] })

  try {
    const supabase = getAitwClient()
    const { data, error } = await supabase
      .from('aitw_builders')
      .select('id, name, project_id')
      .ilike('name', `%${q.replace(/[%_]/g, '')}%`)
      .order('name')
      .limit(10)
    if (error) throw error
    return NextResponse.json({
      builders: (data ?? []).map((b) => ({ id: b.id, name: b.name, hasTeam: b.project_id != null })),
    })
  } catch (err) {
    console.error('aitw/builders search failed', err)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}

// Self-signup for builders not in the imported list. If the email already
// exists this acts like identify (and backfills a missing phone).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const email = normalizeEmail(body.email)
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
  if (!email) return NextResponse.json({ error: 'invalid_email' }, { status: 400 })
  if (!name) return NextResponse.json({ error: 'missing_name' }, { status: 400 })

  try {
    const supabase = getAitwClient()
    const existing = await getBuilderByEmail(supabase, email)
    if (existing) {
      if (!existing.phone && phone) {
        const { error } = await supabase
          .from('aitw_builders')
          .update({ phone })
          .eq('id', existing.id)
        if (error) throw error
        existing.phone = phone
      }
      return NextResponse.json(await identityPayload(supabase, existing))
    }

    const { data, error } = await supabase
      .from('aitw_builders')
      .insert({ name, email, phone: phone || null, source: 'signup' })
      .select('*')
      .single()
    if (error) throw error
    return NextResponse.json(await identityPayload(supabase, data), { status: 201 })
  } catch (err) {
    console.error('aitw/builders signup failed', err)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
