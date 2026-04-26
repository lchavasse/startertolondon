import { supabase } from './supabase'
import { GuideItem } from './types'

// ─── Tagged union for KB entities ────────────────────────────────────────────

export type KBEntityType = 'space' | 'community' | 'vc' | 'programme'

export interface KBSpace {
  _type: 'space'
  id: string
  slug: string
  name: string
  display_name: string | null
  pixel_art: string | null
  strapline: string | null
  description: string | null
  area: string | null
  access_type: string | null
  crowd_tags: string[] | null
  tags: string[] | null
  cover_image: string | null
  website: string | null
  events_url: string | null
  featured: boolean | null
}

export interface KBCommunity {
  _type: 'community'
  id: string
  slug: string
  name: string
  display_name: string | null
  pixel_art: string | null
  strapline: string | null
  description: string | null
  primary_area: string | null
  exclusivity: string | null
  sectors: string[] | null
  tags: string[] | null
  cover_image: string | null
  website: string | null
  events_url: string | null
  featured: boolean | null
}

export interface KBVC {
  _type: 'vc'
  id: string
  slug: string
  name: string
  strapline: string | null
  description: string | null
  sectors: string[] | null
  tags: string[] | null
  cover_image: string | null
  website: string | null
  featured: boolean | null
  london_team: boolean | null
}

export interface KBProgramme {
  _type: 'programme'
  id: string
  slug: string
  name: string
  strapline: string | null
  description: string | null
  programme_type: string | null
  cost_type: string | null
  sectors: string[] | null
  tags: string[] | null
  cover_image: string | null
  website: string | null
  featured: boolean | null
  applications_open: boolean | null
}

export type KBEntity = KBSpace | KBCommunity | KBVC | KBProgramme

// ─── Fetch all entities for /explore ─────────────────────────────────────────

export async function fetchAllKBEntities(): Promise<{
  spaces: KBSpace[]
  communities: KBCommunity[]
  vcs: KBVC[]
  programmes: KBProgramme[]
}> {
  const [spacesRes, communitiesRes, vcsRes, programmesRes] = await Promise.all([
    supabase
      .from('spaces')
      .select('id, slug, name, display_name, pixel_art, strapline, description, area, access_type, crowd_tags, tags, cover_image, website, events_url, featured')
      .not('tags', 'cs', '{venue-only}')
      .order('name'),
    supabase
      .from('communities')
      .select('id, slug, name, display_name, pixel_art, strapline, description, primary_area, exclusivity, sectors, tags, cover_image, website, events_url, featured')
      .order('name'),
    supabase
      .from('vcs')
      .select('id, slug, name, strapline, description, sectors, tags, cover_image, website, featured, london_team')
      .order('name'),
    supabase
      .from('programmes')
      .select('id, slug, name, strapline, description, programme_type, cost_type, sectors, tags, cover_image, website, featured, applications_open')
      .order('name'),
  ])

  const spaces: KBSpace[] = (spacesRes.data ?? []).map((s) => ({ _type: 'space', ...s }))
  const communities: KBCommunity[] = (communitiesRes.data ?? []).map((c) => ({ _type: 'community', ...c }))
  const vcs: KBVC[] = (vcsRes.data ?? []).map((v) => ({ _type: 'vc', ...v }))
  const programmes: KBProgramme[] = (programmesRes.data ?? []).map((p) => ({ _type: 'programme', ...p }))

  return { spaces, communities, vcs, programmes }
}

// ─── Derive unique sectors/tags for filter row ────────────────────────────────

export function deriveSectors(entities: {
  spaces: KBSpace[]
  communities: KBCommunity[]
  vcs: KBVC[]
  programmes: KBProgramme[]
}): string[] {
  const all = new Set<string>()
  for (const s of entities.spaces) {
    for (const t of s.tags ?? []) all.add(t.toLowerCase())
    for (const t of s.crowd_tags ?? []) all.add(t.toLowerCase())
  }
  for (const c of entities.communities) {
    for (const t of c.sectors ?? []) all.add(t.toLowerCase())
  }
  for (const v of entities.vcs) {
    for (const t of v.sectors ?? []) all.add(t.toLowerCase())
  }
  for (const p of entities.programmes) {
    for (const t of p.sectors ?? []) all.add(t.toLowerCase())
  }
  return [...all].sort()
}

// ─── Fetch highlights (top-trump cards) ───────────────────────────────────────

export interface HighlightPerson {
  slug: string
  name: string
  role: string | null
  twitter: string | null
  linkedin: string | null
}

export interface HighlightEventSeries {
  slug: string
  name: string
  frequency: string | null
  typical_size: number | null
  format: string | null
}

export interface HighlightProgramme {
  slug: string
  name: string
  programme_type: string | null
  cost_type: string | null
  applications_open: boolean | null
  website: string | null
}

export type HighlightCard =
  | {
      kind: 'space'
      space: KBSpace
      community: KBCommunity | null
      people: HighlightPerson[]
      eventSeries: HighlightEventSeries[]
      programmes: HighlightProgramme[]
    }
  | {
      kind: 'community'
      community: KBCommunity
      people: HighlightPerson[]
      eventSeries: HighlightEventSeries[]
      programmes: HighlightProgramme[]
    }

const COMMUNITY_SELECT =
  'id, slug, name, display_name, pixel_art, strapline, description, primary_area, exclusivity, sectors, tags, cover_image, website, events_url, featured'
const EVENT_SERIES_SELECT = 'slug, name, frequency, typical_size, format'
const PEOPLE_SELECT = 'slug, name, role, twitter, linkedin'
const PROGRAMME_SELECT = 'slug, name, programme_type, cost_type, applications_open, website'

async function fetchEventsForCommunities(communityIds: string[]): Promise<Map<string, HighlightEventSeries[]>> {
  const map = new Map<string, HighlightEventSeries[]>()
  if (communityIds.length === 0) return map
  const { data } = await supabase
    .from('community_event_series')
    .select(`community_id, event_series(${EVENT_SERIES_SELECT})`)
    .in('community_id', communityIds)
  for (const row of (data ?? []) as { community_id: string; event_series: HighlightEventSeries }[]) {
    if (!row.event_series) continue
    const list = map.get(row.community_id) ?? []
    list.push(row.event_series)
    map.set(row.community_id, list)
  }
  return map
}

async function fetchPeopleForCommunities(communityIds: string[]): Promise<Map<string, HighlightPerson[]>> {
  const map = new Map<string, HighlightPerson[]>()
  if (communityIds.length === 0) return map
  const { data } = await supabase
    .from('community_people')
    .select(`community_id, role, people(${PEOPLE_SELECT})`)
    .in('community_id', communityIds)
  for (const row of (data ?? []) as { community_id: string; people: HighlightPerson }[]) {
    if (!row.people) continue
    const list = map.get(row.community_id) ?? []
    list.push(row.people)
    map.set(row.community_id, list)
  }
  return map
}

function dedupBySlug<T extends { slug: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const it of items) {
    if (seen.has(it.slug)) continue
    seen.add(it.slug)
    out.push(it)
  }
  return out
}

export async function fetchHighlights(): Promise<HighlightCard[]> {
  const [spacesRes, communitiesRes] = await Promise.all([
    supabase
      .from('spaces')
      .select('id, slug, name, display_name, pixel_art, strapline, description, area, access_type, crowd_tags, tags, cover_image, website, events_url, featured')
      .eq('featured', true)
      .not('pixel_art', 'is', null)
      .order('name'),
    supabase
      .from('communities')
      .select(COMMUNITY_SELECT)
      .eq('featured', true)
      .not('pixel_art', 'is', null)
      .order('name'),
  ])

  const spaces = spacesRes.data ?? []
  const allCommunities = communitiesRes.data ?? []

  // Resolve which communities live at which featured spaces
  const spaceIds = spaces.map((s) => s.id)
  const csRes = spaceIds.length
    ? await supabase
        .from('community_spaces')
        .select(`community_id, space_id, communities(${COMMUNITY_SELECT})`)
        .in('space_id', spaceIds)
    : { data: [] as unknown[] }

  type CSRow = { community_id: string; space_id: string; communities: Omit<KBCommunity, '_type'> | null }
  const csRows = (csRes.data ?? []) as CSRow[]

  // Communities already represented under a space card — exclude from community-rooted cards
  const claimedCommunityIds = new Set(csRows.map((r) => r.community_id))

  const standaloneCommunities = allCommunities.filter((c) => !claimedCommunityIds.has(c.id))

  // ─ Gather all community ids we need joins for (under-space + standalone)
  const involvedCommunityIds = [
    ...csRows.map((r) => r.community_id),
    ...standaloneCommunities.map((c) => c.id),
  ]

  const [espRes, progRes, communityEvents, communityPeople] = await Promise.all([
    spaceIds.length
      ? supabase
          .from('event_series_spaces')
          .select(`space_id, event_series(${EVENT_SERIES_SELECT})`)
          .in('space_id', spaceIds)
      : Promise.resolve({ data: [] as unknown[] }),
    spaceIds.length
      ? supabase
          .from('programme_spaces')
          .select(`space_id, programmes(${PROGRAMME_SELECT})`)
          .in('space_id', spaceIds)
      : Promise.resolve({ data: [] as unknown[] }),
    fetchEventsForCommunities(involvedCommunityIds),
    fetchPeopleForCommunities(involvedCommunityIds),
  ])

  const cards: HighlightCard[] = []

  // ─ Space-rooted cards
  for (const s of spaces) {
    const cs = csRows.find((r) => r.space_id === s.id)
    const community = cs?.communities ? ({ _type: 'community', ...cs.communities } as KBCommunity) : null

    const directEvents = ((espRes.data ?? []) as { space_id: string; event_series: HighlightEventSeries }[])
      .filter((r) => r.space_id === s.id)
      .map((r) => r.event_series)
      .filter(Boolean)

    const communityEventList = community ? communityEvents.get(community.id) ?? [] : []
    const eventSeries = dedupBySlug([...directEvents, ...communityEventList])

    const people = community ? communityPeople.get(community.id) ?? [] : []

    const programmes = ((progRes.data ?? []) as { space_id: string; programmes: HighlightProgramme }[])
      .filter((r) => r.space_id === s.id)
      .map((r) => r.programmes)
      .filter(Boolean)

    cards.push({
      kind: 'space',
      space: { _type: 'space', ...s } as KBSpace,
      community,
      people,
      eventSeries,
      programmes,
    })
  }

  // ─ Community-rooted cards (those not already under a space card)
  for (const c of standaloneCommunities) {
    const community = { _type: 'community', ...c } as KBCommunity
    cards.push({
      kind: 'community',
      community,
      people: communityPeople.get(c.id) ?? [],
      eventSeries: communityEvents.get(c.id) ?? [],
      programmes: [],
    })
  }

  return cards
}

// ─── Fetch guide items (spaces, communities, programmes only) ─────────────────

export async function fetchGuideItems(): Promise<GuideItem[]> {
  const [spacesRes, communitiesRes, programmesRes] = await Promise.all([
    supabase
      .from('spaces')
      .select('id, name, strapline, description, area, crowd_tags, tags, website')
      .not('tags', 'cs', '{venue-only}')
      .order('name'),
    supabase
      .from('communities')
      .select('id, name, strapline, description, primary_area, sectors, tags, website')
      .order('name'),
    supabase
      .from('programmes')
      .select('id, name, strapline, description, sectors, programme_type, tags, website')
      .order('name'),
  ])

  const items: GuideItem[] = []

  for (const s of spacesRes.data ?? []) {
    const scoreTags = [...(s.crowd_tags ?? []), ...(s.tags ?? [])]
    items.push({
      id: s.id,
      category: 'space',
      name: s.name,
      strapline: s.strapline ?? '',
      description: s.description ?? s.strapline ?? '',
      location: s.area ?? 'London',
      tags: scoreTags.map((t) => t.toLowerCase()),
      vibe: scoreTags.slice(0, 3).join(', '),
      href: s.website ?? undefined,
      reason: s.description ?? `A London space: ${s.strapline ?? s.name}`,
    })
  }

  for (const c of communitiesRes.data ?? []) {
    const scoreTags = [...(c.sectors ?? []), ...(c.tags ?? [])]
    items.push({
      id: c.id,
      category: 'community',
      name: c.name,
      strapline: c.strapline ?? '',
      description: c.description ?? c.strapline ?? '',
      location: c.primary_area ?? 'London',
      tags: scoreTags.map((t) => t.toLowerCase()),
      vibe: scoreTags.slice(0, 3).join(', '),
      href: c.website ?? undefined,
      reason: c.description ?? `A London community: ${c.strapline ?? c.name}`,
    })
  }

  for (const p of programmesRes.data ?? []) {
    const scoreTags = [...(p.sectors ?? []), ...(p.tags ?? [])]
    items.push({
      id: p.id,
      category: 'community',
      name: p.name,
      strapline: p.strapline ?? '',
      description: p.description ?? p.strapline ?? '',
      location: 'London',
      tags: scoreTags.map((t) => t.toLowerCase()),
      vibe: [p.programme_type, ...scoreTags.slice(0, 2)].filter(Boolean).join(', '),
      href: p.website ?? undefined,
      reason: p.description ?? `A London programme: ${p.strapline ?? p.name}`,
    })
  }

  return items
}
