/**
 * Deterministic sector inheritance from KB rows.
 *
 * Loads `event_series` + `communities` once (single supabase round-trip) and
 * builds in-memory lookup maps keyed by every external ID we know about. For
 * each LondonEvent we try (in order):
 *
 *   1. event_series.luma_cal_ids        ← matched via event.calendarSlug or cal-id
 *   2. event_series.luma_user_ids       ← organiser usernames / usr-IDs
 *   3. event_series.eventbrite_organiser_ids
 *   4. event_series.meetup_group_ids
 *   5. communities.events_url           ← fallback for company-driven calendars
 *
 * First hit wins. Series wins over community when both match.
 *
 * Returns `null` if no match — orphan events get LLM tagging in PR 2.
 */
import { supabase } from '@/lib/supabase'
import { normaliseSectors, type Sector } from '@/lib/sectors'
import type { LondonEvent } from '@/lib/types'

export interface InheritanceMap {
  match(event: LondonEvent): Sector[] | null
  /** Number of KB rows loaded — for logging during cron runs. */
  stats: { eventSeries: number; communities: number }
}

interface SeriesRow {
  slug: string
  sectors: string[] | null
  luma_cal_ids: string[] | null
  luma_user_ids: string[] | null
  eventbrite_organiser_ids: string[] | null
  meetup_group_ids: string[] | null
}

interface CommunityRow {
  slug: string
  sectors: string[] | null
  events_url: string | null
}

function indexBy<T>(rows: readonly T[], pickKeys: (row: T) => readonly (string | null | undefined)[]): Map<string, T> {
  const map = new Map<string, T>()
  for (const row of rows) {
    for (const raw of pickKeys(row)) {
      if (!raw) continue
      const key = raw.toLowerCase().trim()
      if (!key) continue
      // First row wins on collision (rare but possible if KB has duplicates).
      if (!map.has(key)) map.set(key, row)
    }
  }
  return map
}

function deriveCommunitySlugFromEventsUrl(url: string | null): string | null {
  if (!url) return null
  // Examples:
  //   https://lu.ma/granola
  //   https://luma.com/pillarvc
  //   https://www.meetup.com/london-gophers
  //   https://eventbrite.co.uk/o/some-org-12345
  const match = url.match(/(?:lu\.ma|luma\.com)\/([A-Za-z0-9_.-]+)/i)
  if (match) return match[1].toLowerCase()
  return null
}

export async function loadInheritanceMap(): Promise<InheritanceMap> {
  const [seriesRes, commRes] = await Promise.all([
    supabase
      .from('event_series')
      .select('slug, sectors, luma_cal_ids, luma_user_ids, eventbrite_organiser_ids, meetup_group_ids'),
    supabase
      .from('communities')
      .select('slug, sectors, events_url'),
  ])

  const series = (seriesRes.data ?? []) as SeriesRow[]
  const communities = (commRes.data ?? []) as CommunityRow[]

  const seriesByCalId = indexBy(series, (s) => s.luma_cal_ids ?? [])
  const seriesByUserId = indexBy(series, (s) => s.luma_user_ids ?? [])
  const seriesByEbOrg = indexBy(series, (s) => s.eventbrite_organiser_ids ?? [])
  const seriesByMeetupGroup = indexBy(series, (s) => s.meetup_group_ids ?? [])
  const communityByLumaSlug = indexBy(communities, (c) => [deriveCommunitySlugFromEventsUrl(c.events_url)])

  function fromSeries(row: SeriesRow | undefined): Sector[] | null {
    if (!row) return null
    const sectors = normaliseSectors(row.sectors)
    return sectors.length > 0 ? sectors : null
  }

  function fromCommunity(row: CommunityRow | undefined): Sector[] | null {
    if (!row) return null
    const sectors = normaliseSectors(row.sectors)
    return sectors.length > 0 ? sectors : null
  }

  function match(event: LondonEvent): Sector[] | null {
    // Pull the slug — calendarSlug may be `cal-XXXX`, a luma user `usr-XXXX`,
    // a username, or a platform-prefixed key like `meetup:london-gophers` or
    // `eventbrite:12345`.
    const slug = event.calendarSlug?.toLowerCase().trim() ?? ''

    // 1) Luma cal-id direct match (handles `calendar/cal-XXXX` paths too).
    const calId = slug.match(/cal-[a-z0-9]+/i)?.[0]?.toLowerCase()
    if (calId) {
      const hit = fromSeries(seriesByCalId.get(calId))
      if (hit) return hit
    }

    // 2) Luma user — `usr-XXXX` or username slug.
    if (slug && (slug.startsWith('usr-') || event.source === 'luma-profile')) {
      const hit = fromSeries(seriesByUserId.get(slug))
      if (hit) return hit
    }
    // Some user-source events store the username directly as calendarSlug.
    if (slug) {
      const hit = fromSeries(seriesByUserId.get(slug))
      if (hit) return hit
    }

    // 3) Eventbrite organiser — slug is stored as `eventbrite:<id>`.
    if (slug.startsWith('eventbrite:')) {
      const id = slug.slice('eventbrite:'.length)
      const hit = fromSeries(seriesByEbOrg.get(id))
      if (hit) return hit
    }

    // 4) Meetup group — slug is stored as `meetup:<urlname>`.
    if (slug.startsWith('meetup:')) {
      const urlname = slug.slice('meetup:'.length)
      const hit = fromSeries(seriesByMeetupGroup.get(urlname))
      if (hit) return hit
    }

    // 5) Community fallback — match the Luma slug from communities.events_url.
    if (slug) {
      const hit = fromCommunity(communityByLumaSlug.get(slug))
      if (hit) return hit
    }

    return null
  }

  return {
    match,
    stats: { eventSeries: series.length, communities: communities.length },
  }
}
