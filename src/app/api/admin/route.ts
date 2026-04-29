import { NextRequest, NextResponse } from 'next/server'
import {
  getCommunitySources,
  updateCommunitySource,
  removeCommunitySource,
  getManualEvents,
  addManualEvent,
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
  getPendingReview,
  removeFromPendingReview,
  getRecentDecisions,
  appendDecision,
  getEbMeetupAllowlist,
  addToEbMeetupAllowlist,
  removeFromEbMeetupAllowlist,
} from '@/lib/kv'
import { CALENDAR_SOURCES, USER_SOURCES } from '@/lib/scrapers/sources'
import type { ReviewDecision, EventDecision } from '@/lib/types'

function isAuthorized(req: NextRequest): boolean {
  return req.headers.get('x-admin-key') === process.env.ADMIN_SECRET
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [
    communitySources,
    manualEvents,
    blocklist,
    failed,
    events,
    systemOverrides,
    pendingReview,
    recentDecisions,
    ebMeetupAllowlist,
  ] = await Promise.all([
    getCommunitySources(),
    getManualEvents(),
    getBlocklist(),
    getFailedSources(),
    getEvents(),
    getSystemSourceOverrides(),
    getPendingReview(),
    getRecentDecisions(50),
    getEbMeetupAllowlist(),
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
    pendingReview,
    recentDecisions,
    ebMeetupAllowlist,
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

  // ─── EB/Meetup review queue ───────────────────────────────────────────────

  if (action === 'review-decision') {
    const { id, decision, reason } = body as { id?: string; decision?: ReviewDecision; reason?: string }
    if (!id || !decision || !['feature', 'list', 'reject'].includes(decision)) {
      return NextResponse.json({ error: 'id and valid decision required' }, { status: 400 })
    }
    const pending = await getPendingReview()
    const event = pending.find((e) => e.id === id)
    if (!event) return NextResponse.json({ error: 'event not in pending queue' }, { status: 404 })

    const decisionRecord: EventDecision = {
      id: event.id,
      name: event.name,
      organiser: event.organiserName || event.calendarSlug || '',
      decision,
      reason: typeof reason === 'string' && reason.length > 0 ? reason : undefined,
      timestamp: new Date().toISOString(),
    }

    if (decision === 'feature') {
      await addManualEvent({ ...event, curated: true, pending: false })
    } else if (decision === 'list') {
      await addManualEvent({ ...event, curated: false, pending: false })
    } else {
      await addToBlocklist(event.id)
    }
    await Promise.all([
      removeFromPendingReview(event.id),
      appendDecision(decisionRecord),
    ])
    return NextResponse.json({ ok: true })
  }

  if (action === 'review-bulk') {
    const { ids, decision, reason } = body as { ids?: string[]; decision?: ReviewDecision; reason?: string }
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids array required' }, { status: 400 })
    }
    if (!decision || !['feature', 'list', 'reject'].includes(decision)) {
      return NextResponse.json({ error: 'valid decision required' }, { status: 400 })
    }
    const pending = await getPendingReview()
    const pendingById = new Map(pending.map((e) => [e.id, e]))
    const ts = new Date().toISOString()
    let processed = 0
    for (const id of ids) {
      const event = pendingById.get(id)
      if (!event) continue
      const decisionRecord: EventDecision = {
        id: event.id,
        name: event.name,
        organiser: event.organiserName || event.calendarSlug || '',
        decision,
        reason: typeof reason === 'string' && reason.length > 0 ? reason : undefined,
        timestamp: ts,
      }
      if (decision === 'feature') {
        await addManualEvent({ ...event, curated: true, pending: false })
      } else if (decision === 'list') {
        await addManualEvent({ ...event, curated: false, pending: false })
      } else {
        await addToBlocklist(event.id)
      }
      await Promise.all([
        removeFromPendingReview(event.id),
        appendDecision(decisionRecord),
      ])
      processed++
    }
    return NextResponse.json({ ok: true, processed })
  }

  if (action === 'trust-organiser') {
    const { id, reason } = body as { id?: string; reason?: string }
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const pending = await getPendingReview()
    const event = pending.find((e) => e.id === id)
    if (!event) return NextResponse.json({ error: 'event not in pending queue' }, { status: 404 })
    if (!event.calendarSlug) {
      return NextResponse.json({ error: 'event has no calendarSlug — cannot allowlist' }, { status: 422 })
    }
    const decisionRecord: EventDecision = {
      id: event.id,
      name: event.name,
      organiser: event.organiserName || event.calendarSlug,
      decision: 'list',
      reason: typeof reason === 'string' && reason.length > 0 ? reason : 'trust-organiser',
      timestamp: new Date().toISOString(),
    }
    await Promise.all([
      addToEbMeetupAllowlist(event.calendarSlug),
      addManualEvent({ ...event, curated: false, pending: false }),
      removeFromPendingReview(event.id),
      appendDecision(decisionRecord),
    ])
    return NextResponse.json({ ok: true })
  }

  if (action === 'allowlist-add') {
    const { key } = body as { key?: string }
    if (!key || !key.startsWith('meetup:') && !key.startsWith('eventbrite:')) {
      return NextResponse.json({ error: 'key must start with meetup: or eventbrite:' }, { status: 400 })
    }
    await addToEbMeetupAllowlist(key)
    return NextResponse.json({ ok: true })
  }

  if (action === 'allowlist-remove') {
    const { key } = body as { key?: string }
    if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 })
    await removeFromEbMeetupAllowlist(key)
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
