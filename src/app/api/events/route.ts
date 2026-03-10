import { NextRequest, NextResponse } from 'next/server'
import { getEvents } from '@/lib/kv'
import { apiRateLimit } from '@/lib/rate-limit'
import { LondonEvent } from '@/lib/types'

interface CalendarEvent {
  id: string
  summary: string
  description?: string
  location?: string
  start: { dateTime?: string; date?: string; timeZone?: string }
  end: { dateTime?: string; date?: string; timeZone?: string }
  htmlLink: string
  externalUrl?: string
  imageUrl?: string
  hostedByUM: boolean
}

function toCalendarEvent(e: LondonEvent): CalendarEvent {
  const descParts: string[] = []
  if (e.organiserName) descParts.push(`Hosted by ${e.organiserName}`)
  if (e.tags.length > 0) descParts.push(`Tags: ${e.tags.join(', ')}`)

  return {
    id: e.id,
    summary: e.name,
    description: descParts.length > 0 ? descParts.join(' | ') : undefined,
    location: e.locationName || undefined,
    start: { dateTime: e.startAt, timeZone: e.timezone },
    end: { dateTime: e.endAt, timeZone: e.timezone },
    htmlLink: e.url,
    externalUrl: e.url,
    imageUrl: e.coverUrl || undefined,
    hostedByUM: false,
  }
}

function getApiKey(req: NextRequest): string | null {
  return (
    req.nextUrl.searchParams.get('key') ||
    req.headers.get('x-api-key') ||
    null
  )
}

export async function GET(req: NextRequest) {
  const apiKey = getApiKey(req)
  if (!apiKey || apiKey !== process.env.EVENTS_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { success, remaining, reset } = await apiRateLimit.limit(apiKey)
  if (!success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Remaining': String(remaining),
          'X-RateLimit-Reset': String(reset),
        },
      }
    )
  }

  let events = await getEvents()

  const curated = req.nextUrl.searchParams.get('curated')
  if (curated === 'true') {
    events = events.filter((e) => e.curated)
  }

  // Filter out pending/unapproved events from the public API
  events = events.filter((e) => !e.pending)

  const raw = req.nextUrl.searchParams.get('raw')
  if (raw === 'true') {
    return NextResponse.json(
      { events, count: events.length, updatedAt: new Date().toISOString() },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
          'X-RateLimit-Remaining': String(remaining),
        },
      }
    )
  }

  const calendarEvents = events.map(toCalendarEvent)
  return NextResponse.json(
    {
      events: calendarEvents,
      count: calendarEvents.length,
      updatedAt: new Date().toISOString(),
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'X-RateLimit-Remaining': String(remaining),
      },
    }
  )
}
