/**
 * Luma event sources. Add new sources here.
 *
 * CALENDAR_SOURCES: slugs from luma.com/<slug> or 'calendar/cal-XXXX' for direct cal-ids
 * USER_SOURCES:     usernames or usr-ids from luma.com/user/<id>
 * CHANNEL_SOURCES:  community/topic discovery pages from luma.com/<slug>
 *
 * curated: true  → events get ★ badge on site
 * curated: false → events appear but without badge
 */

export interface SystemSource {
  slug: string
  curated: boolean
}

export const CALENDAR_SOURCES: SystemSource[] = [
  // Organisation calendars (slug → page fetch to get cal-id)
  { slug: 'superteam', curated: true },
  { slug: 'ai-circle', curated: true },
  { slug: 'incident', curated: true },
  { slug: 'cal.ElevenLabs', curated: true },
  { slug: 'behscixsai', curated: true },
  { slug: 'glia', curated: true },
  { slug: 'thestartupstroll', curated: true },
  { slug: 'Londonlongevity', curated: true },
  { slug: 'sota-events', curated: true },
  { slug: 'mafia', curated: true },
  { slug: 'entrep', curated: true },
  { slug: 'gossip-group', curated: true },
  { slug: 'philosofriends', curated: true },
  { slug: 'pnr', curated: true },
  { slug: 'ft-ldn', curated: true },
  { slug: 'plugged', curated: true },
  { slug: 'voiceaispace', curated: true },
  { slug: 'vercel-events', curated: true },
  { slug: 'DeSciLondonEvents', curated: true },
  { slug: 'pillarvc', curated: true },
  { slug: 'granola', curated: true },
  { slug: 'genai-collective', curated: true },
  { slug: 'cursorcommunity', curated: true },
  { slug: 'deeptechfutures', curated: true },
  { slug: 'contrarianventures', curated: true },
  { slug: 'hy.pe', curated: true },
  { slug: 'ainexus-community', curated: true },
  { slug: 'abundance', curated: true },
  { slug: 'aiengine', curated: true },
  { slug: 'thebaehq', curated: true },
  { slug: 'seedrun', curated: true },
  { slug: 'renaissancephilanthropy', curated: true },
  { slug: 'srv-frontier', curated: true },
  { slug: 'lfh', curated: true },
  { slug: 'knowledgequarter', curated: true },
  { slug: 'london-ai', curated: true },
  { slug: 'llmlondon', curated: true },
  { slug: 'encode-club', curated: true },
  { slug: 'ai-demo-days', curated: true },
  // Direct cal-id paths (no page fetch needed)
  { slug: 'calendar/cal-ACd43Ggy4n6LhK6', curated: true },
  { slug: 'calendar/cal-QL14kxaKAz6HbZS', curated: true },
  { slug: 'calendar/cal-npDMhGfssuQj9ZE', curated: true },
]

export const USER_SOURCES: SystemSource[] = [
  { slug: 'redwoodfounders', curated: true },
  { slug: 'rarefounders', curated: true },
  { slug: 'kickstart', curated: true },
  { slug: 'Fatemalk', curated: true },
  { slug: 'meghamishra', curated: true },
  { slug: 'sequel', curated: true },
  { slug: 'jakublala', curated: true },
  { slug: 'fiftyyears', curated: true },
  { slug: 'usr-YGY3Gjoz6GYE7oP', curated: true },
  { slug: 'usr-MO4uBxuWtgsNXW5', curated: true },
  { slug: 'usr-D2BCRghdbZ0O73Z', curated: true },
  { slug: 'usr-xxNiMt5oFEdQTkM', curated: true },
  { slug: 'usr-wjrxYcvVBK6caRs', curated: true },
]

export const CHANNEL_SOURCES: string[] = [
  'deepmind',
  'london',
  'tech',
  'ai',
  'arts',
  'climate',
  'crypto',
]
