import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { resolveAndStore } from '@/lib/submit'

export async function POST(req: NextRequest) {
  let body: { url?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { url } = body
  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'url is required' }, { status: 400 })
  }

  const result = await resolveAndStore(url.trim())
  if (!result) {
    return NextResponse.json(
      { error: 'Could not resolve URL — make sure it is a valid link to a Luma calendar, user, or event' },
      { status: 422 }
    )
  }

  revalidatePath('/events')
  return NextResponse.json({ ok: true, result })
}
