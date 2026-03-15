import { NextRequest, NextResponse } from 'next/server'
import { runAllScrapers } from '@/lib/scrapers'
import { saveEvents } from '@/lib/kv'

function isAuthorized(req: NextRequest): boolean {
  const bearer = req.headers.get('authorization')
  const secret = req.headers.get('x-cron-secret')
  return (
    bearer === `Bearer ${process.env.CRON_SECRET}` ||
    secret === process.env.CRON_SECRET
  )
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { events, failed, stats } = await runAllScrapers()
  await saveEvents(events)

  return NextResponse.json({
    ok: true,
    ...stats,
    rateLimited: failed.filter((f) => f.isRateLimit).length,
    failedSlugs: failed.map((f) => f.slug),
  })
}
