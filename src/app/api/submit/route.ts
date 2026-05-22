import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { resolveAndStore } from '@/lib/submit'
import { submitRateLimit } from '@/lib/rate-limit'

function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const { success, remaining, reset } = await submitRateLimit.limit(ip)
  if (!success) {
    return NextResponse.json(
      { error: 'Too many submissions — try again later.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Remaining': String(remaining),
          'X-RateLimit-Reset': String(reset),
          'Retry-After': String(Math.max(1, Math.ceil((reset - Date.now()) / 1000))),
        },
      }
    )
  }

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
