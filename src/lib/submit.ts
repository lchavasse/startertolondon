import { nanoid } from 'nanoid'
import { LondonEvent, CommunitySource } from '@/lib/types'
import { addCommunitySource, addManualEvent } from '@/lib/kv'

const PAGE_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}


function isLumaUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return ['lu.ma', 'luma.com', 'www.lu.ma', 'www.luma.com'].includes(parsed.hostname)
  } catch {
    return false
  }
}

function extractSlug(url: string): string | null {
  try {
    const parsed = new URL(url)
    const slug = parsed.pathname.replace(/^\//, '').replace(/\/$/, '')
    return slug || null
  } catch {
    return null
  }
}

export type ResolvedSubmission =
  | { type: 'calendar'; slug: string; name: string; url: string }
  | { type: 'user'; slug: string; name: string; url: string }
  | { type: 'event'; slug: string; name: string; url: string; eventData: LondonEvent }
  | { type: 'other'; slug: string; name: string; url: string }

export async function resolveSubmission(url: string): Promise<ResolvedSubmission | null> {
  let normalizedUrl: string
  try {
    normalizedUrl = new URL(url).toString()
  } catch {
    return null
  }

  if (isLumaUrl(url)) {
    return resolveLumaUrl(url)
  }

  return resolveOtherUrl(normalizedUrl)
}

async function resolveLumaUrl(url: string): Promise<ResolvedSubmission | null> {
  const slug = extractSlug(url)
  if (!slug) return null

  const pageUrl = `https://luma.com/${slug}`

  try {
    const res = await fetch(pageUrl, {
      headers: PAGE_HEADERS,
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const html = await res.text()

    const dataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
    if (!dataMatch) return null

    // Parse as JSON so we can inspect the primary entity type, not just any occurrence
    let nextData: Record<string, unknown>
    try {
      nextData = JSON.parse(dataMatch[1])
    } catch {
      return null
    }

    // Navigate to the entity data — Luma's __NEXT_DATA__ shape:
    // props.pageProps.initialData.data.{ event, calendar, user }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pageProps = (nextData?.props as any)?.pageProps
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const container: Record<string, any> =
      pageProps?.initialData?.data ?? pageProps?.initialData ?? pageProps?.data ?? pageProps ?? {}

    const eventObj = container.event as Record<string, unknown> | undefined
    const calObj   = container.calendar as Record<string, unknown> | undefined
    const userObj  = container.user as Record<string, unknown> | undefined

    // Check event first — event pages have both an event AND a calendar object;
    // calendar pages only have a calendar object.
    if (typeof eventObj?.api_id === 'string' && eventObj.api_id.startsWith('evt-')) {
      const evtId = eventObj.api_id
      const eventData = mapPageEvent(evtId, eventObj, calObj, url)
      return { type: 'event', slug: evtId, name: eventData.name, url, eventData }
    }

    if (typeof calObj?.api_id === 'string' && calObj.api_id.startsWith('cal-')) {
      const name = (calObj.name as string | undefined) ?? slug
      return { type: 'calendar', slug, name, url: pageUrl }
    }

    if (typeof userObj?.api_id === 'string' && userObj.api_id.startsWith('usr-')) {
      const name = (userObj.username as string | undefined) ?? (userObj.name as string | undefined) ?? slug
      return { type: 'user', slug, name, url: pageUrl }
    }

    return null
  } catch {
    return null
  }
}

function mapPageEvent(
  evtId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  eventObj: Record<string, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  calObj: Record<string, any> | undefined,
  originalUrl: string,
): LondonEvent {
  const now = new Date().toISOString()
  const urlSlug = eventObj.url as string | undefined
  const eventUrl = `https://lu.ma/${urlSlug ?? evtId}`
  const geo = eventObj.geo_address_info as Record<string, string> | undefined

  return {
    id: evtId,
    name: (eventObj.name as string | undefined) ?? evtId,
    startAt: (eventObj.start_at as string | undefined) ?? now,
    endAt: (eventObj.end_at as string | undefined) ?? now,
    timezone: (eventObj.timezone as string | undefined) ?? 'Europe/London',
    url: originalUrl.startsWith('https://lu.ma/') ? originalUrl : eventUrl,
    coverUrl: (eventObj.cover_url as string | null | undefined) ?? null,
    locationName: geo?.full_address ?? geo?.city ?? '',
    city: geo?.city ?? 'London',
    organiserName: (calObj?.name as string | undefined) ?? '',
    organiserAvatarUrl: (calObj?.avatar_url as string | null | undefined) ?? null,
    tags: calObj?.name ? [calObj.name as string] : [],
    source: 'luma-calendar',
    scrapedAt: now,
    curated: false,
  }
}

async function resolveOtherUrl(url: string): Promise<ResolvedSubmission | null> {
  try {
    const res = await fetch(url, {
      headers: PAGE_HEADERS,
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const html = await res.text()

    let name = ''
    const ogMatch = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/)
    if (ogMatch) {
      name = ogMatch[1]
    } else {
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/)
      if (titleMatch) name = titleMatch[1].trim()
    }

    if (!name) {
      try {
        name = new URL(url).hostname
      } catch {
        name = url
      }
    }

    return { type: 'other', slug: '', name, url }
  } catch {
    return null
  }
}

export type StoreResult =
  | { kind: 'source'; source: CommunitySource }
  | { kind: 'event'; event: LondonEvent }

export async function resolveAndStore(url: string): Promise<StoreResult | null> {
  const resolved = await resolveSubmission(url)
  if (!resolved) return null

  const now = new Date().toISOString()

  if (resolved.type === 'calendar' || resolved.type === 'user') {
    const source: CommunitySource = {
      slug: resolved.slug,
      type: resolved.type,
      curated: false,
      reviewed: false,
      name: resolved.name,
      url: resolved.url,
      addedAt: now,
    }
    await addCommunitySource(source)
    return { kind: 'source', source }
  }

  if (resolved.type === 'event') {
    const event = { ...resolved.eventData, scrapedAt: now, pending: true }
    await addManualEvent(event)
    return { kind: 'event', event }
  }

  // type === 'other'
  const event: LondonEvent = {
    id: nanoid(),
    name: resolved.name,
    startAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    endAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    timezone: 'Europe/London',
    url: resolved.url,
    coverUrl: null,
    locationName: '',
    city: 'London',
    organiserName: '',
    organiserAvatarUrl: null,
    tags: [],
    source: 'other',
    scrapedAt: now,
    curated: false,
    pending: true,
  }
  await addManualEvent(event)
  return { kind: 'event', event }
}
