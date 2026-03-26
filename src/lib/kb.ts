import { supabase } from './supabase'
import { GuideItem } from './types'

// ─── Tagged union for KB entities ────────────────────────────────────────────

export type KBEntityType = 'space' | 'community' | 'vc' | 'programme'

export interface KBSpace {
  _type: 'space'
  id: string
  slug: string
  name: string
  strapline: string | null
  description: string | null
  area: string | null
  access_type: string | null
  crowd_tags: string[] | null
  tags: string[] | null
  cover_image: string | null
  website: string | null
  featured: boolean | null
}

export interface KBCommunity {
  _type: 'community'
  id: string
  slug: string
  name: string
  strapline: string | null
  description: string | null
  primary_area: string | null
  exclusivity: string | null
  sectors: string[] | null
  tags: string[] | null
  cover_image: string | null
  website: string | null
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
      .select('id, slug, name, strapline, description, area, access_type, crowd_tags, tags, cover_image, website, featured')
      .order('name'),
    supabase
      .from('communities')
      .select('id, slug, name, strapline, description, primary_area, exclusivity, sectors, tags, cover_image, website, featured')
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

// ─── Fetch guide items (spaces, communities, programmes only) ─────────────────

export async function fetchGuideItems(): Promise<GuideItem[]> {
  const [spacesRes, communitiesRes, programmesRes] = await Promise.all([
    supabase
      .from('spaces')
      .select('id, name, strapline, description, area, crowd_tags, tags')
      .order('name'),
    supabase
      .from('communities')
      .select('id, name, strapline, description, primary_area, sectors, tags')
      .order('name'),
    supabase
      .from('programmes')
      .select('id, name, strapline, description, sectors, programme_type, tags')
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
      reason: p.description ?? `A London programme: ${p.strapline ?? p.name}`,
    })
  }

  return items
}
