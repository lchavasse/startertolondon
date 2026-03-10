import { NextRequest, NextResponse } from 'next/server'
import {
  getCommunitySources,
  updateCommunitySource,
  removeCommunitySource,
  getManualEvents,
  removeManualEvent,
  updateManualEvent,
  setCuratedOverride,
  getSystemSourceOverrides,
  setSystemSourceOverride,
  getBlocklist,
  addToBlocklist,
  removeFromBlocklist,
  getFailedSources,
  getEvents,
} from '@/lib/kv'
import { CALENDAR_SOURCES, USER_SOURCES } from '@/lib/scrapers/sources'

function isAuthorized(req: NextRequest): boolean {
  return req.headers.get('x-admin-key') === process.env.ADMIN_SECRET
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [communitySources, manualEvents, blocklist, failed, events, systemOverrides] = await Promise.all([
    getCommunitySources(),
    getManualEvents(),
    getBlocklist(),
    getFailedSources(),
    getEvents(),
    getSystemSourceOverrides(),
  ])

  const calendarsWithEffective = CALENDAR_SOURCES.map((s) => ({
    ...s,
    effectiveCurated: s.slug in systemOverrides ? systemOverrides[s.slug] : s.curated,
  }))
  const usersWithEffective = USER_SOURCES.map((s) => ({
    ...s,
    effectiveCurated: s.slug in systemOverrides ? systemOverrides[s.slug] : s.curated,
  }))

  return NextResponse.json({
    communitySources,
    systemSources: { calendars: calendarsWithEffective, users: usersWithEffective },
    manualEvents,
    blocklist,
    failed,
    events,
  })
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, string | boolean>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const action = body.action as string | undefined

  if (action === 'curate-source') {
    const { slug, curated } = body
    if (!slug || typeof curated !== 'boolean') {
      return NextResponse.json({ error: 'slug and curated required' }, { status: 400 })
    }
    await updateCommunitySource(slug as string, { curated })
    return NextResponse.json({ ok: true })
  }

  if (action === 'review-source') {
    const { slug } = body
    if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 })
    await updateCommunitySource(slug as string, { reviewed: true })
    return NextResponse.json({ ok: true })
  }

  if (action === 'remove-source') {
    const { slug } = body
    if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 })
    await removeCommunitySource(slug as string)
    return NextResponse.json({ ok: true })
  }

  if (action === 'curate-event') {
    const { id, curated } = body
    if (!id || typeof curated !== 'boolean') {
      return NextResponse.json({ error: 'id and curated required' }, { status: 400 })
    }
    const manualEvents = await getManualEvents()
    const isManual = manualEvents.some((e) => e.id === id)
    await Promise.all([
      setCuratedOverride(id as string, curated),
      ...(isManual ? [updateManualEvent(id as string, { curated, ...(curated ? { pending: false } : {}) })] : []),
    ])
    return NextResponse.json({ ok: true })
  }

  if (action === 'toggle-system-source') {
    const { slug, curated } = body
    if (!slug || typeof curated !== 'boolean') {
      return NextResponse.json({ error: 'slug and curated required' }, { status: 400 })
    }
    await setSystemSourceOverride(slug as string, curated)
    return NextResponse.json({ ok: true })
  }

  if (action === 'approve-event') {
    const { id } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const manual = await getManualEvents()
    if (manual.some((e) => e.id === id)) {
      await updateManualEvent(id as string, { pending: false })
    }
    return NextResponse.json({ ok: true })
  }

  if (action === 'remove-event') {
    const { id } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    await removeManualEvent(id as string)
    return NextResponse.json({ ok: true })
  }

  if (action === 'delete-event') {
    const { id } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    await Promise.all([
      addToBlocklist(id as string),
      removeManualEvent(id as string),
    ])
    return NextResponse.json({ ok: true })
  }

  if (action === 'block') {
    const { eventId } = body
    if (!eventId) return NextResponse.json({ error: 'eventId required' }, { status: 400 })
    await addToBlocklist(eventId as string)
    return NextResponse.json({ ok: true })
  }

  if (action === 'unblock') {
    const { eventId } = body
    if (!eventId) return NextResponse.json({ error: 'eventId required' }, { status: 400 })
    await removeFromBlocklist(eventId as string)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 404 })
}
