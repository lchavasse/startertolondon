import { GuideItem, UserProfile } from '@/lib/types'

export const GUIDE_ITEMS: GuideItem[] = [
  {
    id: 'ldn-collective',
    category: 'community',
    name: 'London Operators Circle',
    strapline: 'Founders, operators, and sharp generalists who actually like meeting in person.',
    description: 'A recurring community for people building companies, products, and ambitious side projects. Strong fit for community-minded tinkerers.',
    location: 'Shoreditch',
    tags: ['community', 'founders', 'deeptech'],
    vibe: 'social, ambitious, high-signal',
    reason: 'Good default if you want fast access to smart people and recurring events.',
  },
  {
    id: 'mission-kitchen',
    category: 'space',
    name: 'Mission Kitchen',
    strapline: 'A work and gathering space with startup energy and enough warmth to stay awhile.',
    description: 'Flexible work, coffee, and a dense overlap of operators, makers, and occasional event hosts.',
    location: 'New Covent Garden',
    tags: ['community', 'founders', 'design'],
    vibe: 'practical, communal, startup',
    reason: 'Useful if you want a basecamp instead of another anonymous coffee shop.',
  },
  {
    id: 'proto-labs',
    category: 'company',
    name: 'Proto Labs London',
    strapline: 'A placeholder for deeptech firms, studios, and labs worth tracking.',
    description: 'Represents the kind of technical company cluster a science-minded newcomer would want on a radar page.',
    location: 'King’s Cross',
    tags: ['deeptech', 'ai', 'science'],
    vibe: 'technical, research-adjacent, ambitious',
    reason: 'Matches people who mention science, tinkering, or moonshot ideas.',
  },
  {
    id: 'oriole-bar',
    category: 'space',
    name: 'Late Shift Listening Bar',
    strapline: 'For nights when you want atmosphere, conversation, and a break from pure careerism.',
    description: 'A moody venue archetype for music, wine, and soft social collisions.',
    location: 'Central London',
    tags: ['music', 'wine', 'art'],
    vibe: 'cultured, nocturnal, intimate',
    reason: 'Useful when the profile signals music, wine, or a desire for social texture.',
  },
  {
    id: 'new-east-architecture',
    category: 'community',
    name: 'Open House Orbit',
    strapline: 'Architecture walks, city curiosity, and people who like looking up.',
    description: 'A city-exploration recommendation for users who care about architecture, design, or understanding the shape of London.',
    location: 'Across the city',
    tags: ['architecture', 'art', 'design'],
    vibe: 'curious, urbanist, exploratory',
    reason: 'Strong fit for city learners and architecture-minded visitors.',
  },
  {
    id: 'hacknight',
    category: 'community',
    name: 'Midnight Build Club',
    strapline: 'A friendly late-night hacking scene with room for weird prototypes.',
    description: 'Good for people who want to make things with others, not just talk about it.',
    location: 'Southwark',
    tags: ['ai', 'blockchain', 'deeptech', 'community'],
    vibe: 'maker, playful, technical',
    reason: 'Best match for builders who explicitly mention hacking, tinkering, or moonshots.',
  },
]

export function rankGuideItems(profile: UserProfile) {
  const interests = new Set(profile.interests)
  const lookingFor = profile.lookingFor.toLowerCase()

  return [...GUIDE_ITEMS]
    .map((item) => {
      const tagHits = item.tags.filter((tag) => interests.has(tag)).length
      const lookingForHit = lookingFor && (item.description.toLowerCase().includes(lookingFor) || item.strapline.toLowerCase().includes(lookingFor)) ? 2 : 0
      const newcomerBoost = profile.timeInLondon === 'new-arrival' && item.category !== 'company' ? 1 : 0
      const visitorBoost = profile.timeInLondon === 'visiting' && item.category === 'space' ? 1 : 0
      const score = tagHits * 3 + lookingForHit + newcomerBoost + visitorBoost
      return { ...item, score }
    })
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
}
