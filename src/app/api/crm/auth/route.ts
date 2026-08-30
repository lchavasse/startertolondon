import { NextRequest, NextResponse } from 'next/server'

const CRM_COOKIE = 'crm_admin_key'

export async function POST(req: NextRequest) {
  let body: { key?: string; next?: string } = {}
  try {
    body = await req.json()
  } catch {}

  if (!process.env.ADMIN_SECRET || body.key !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true, next: body.next || '/crm' })
  response.cookies.set(CRM_COOKIE, process.env.ADMIN_SECRET, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12,
  })
  return response
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set(CRM_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
  return response
}
