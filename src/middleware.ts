import { NextResponse, type NextRequest } from 'next/server'

const CRM_COOKIE = 'crm_admin_key'

function isCrmAuthed(req: NextRequest) {
  const secret = process.env.ADMIN_SECRET
  if (secret) {
    const headerKey = req.headers.get('x-admin-key')
    const cookieKey = req.cookies.get(CRM_COOKIE)?.value
    if (headerKey === secret || cookieKey === secret) return true
  }

  const agentToken = process.env.CRM_AGENT_TOKEN
  if (agentToken) {
    const bearer = req.headers.get('authorization')
    if (bearer === `Bearer ${agentToken}`) return true
  }

  return false
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const isCrmPage = pathname.startsWith('/crm')
  const isCrmLogin = pathname === '/crm/login'
  const isCrmApi = pathname.startsWith('/api/crm')
  const isCrmAuthApi = pathname === '/api/crm/auth'

  if ((isCrmPage && !isCrmLogin) || (isCrmApi && !isCrmAuthApi)) {
    if (!isCrmAuthed(req)) {
      if (isCrmApi) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      const url = req.nextUrl.clone()
      url.pathname = '/crm/login'
      url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/crm/:path*', '/api/crm/:path*'],
}
