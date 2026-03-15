import { NextRequest, NextResponse } from 'next/server'
import { runAllScrapers } from '@/lib/scrapers'
import { saveEvents } from '@/lib/kv'

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
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
