import { NextRequest, NextResponse } from 'next/server'
import { runAllScrapers } from '@/lib/scrapers'
import { saveEvents } from '@/lib/kv'

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const events = await runAllScrapers()
  await saveEvents(events)

  return NextResponse.json({ ok: true, count: events.length })
}
