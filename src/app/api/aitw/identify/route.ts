import { NextRequest, NextResponse } from 'next/server'
import { getAitwClient, getBuilderByEmail, identityPayload, normalizeEmail } from '@/lib/aitw'

// The "login": an email that matches a builder row is the whole access model.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const email = normalizeEmail(body.email)
  if (!email) return NextResponse.json({ error: 'invalid_email' }, { status: 400 })

  try {
    const supabase = getAitwClient()
    const builder = await getBuilderByEmail(supabase, email)
    if (!builder) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    return NextResponse.json(await identityPayload(supabase, builder))
  } catch (err) {
    console.error('aitw/identify failed', err)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
