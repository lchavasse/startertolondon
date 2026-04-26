import { GuideItem, UserProfile } from '@/lib/types'

type ScoredItem = GuideItem & { score: number }

export function rankGuideItems(items: GuideItem[], profile: UserProfile): GuideItem[] {
  const interests = new Set(profile.interests.map((i) => i.toLowerCase()))
  const lookingFor = profile.lookingFor.toLowerCase()

  const scored: ScoredItem[] = items.map((item) => {
    const tagHits = item.tags.filter((tag) => interests.has(tag.toLowerCase())).length
    const lookingForHit =
      lookingFor &&
      (item.description.toLowerCase().includes(lookingFor) ||
        item.strapline.toLowerCase().includes(lookingFor))
        ? 2
        : 0
    const newcomerBoost =
      profile.timeInLondon === 'new-arrival' && item.category !== 'company' ? 1 : 0
    const visitorBoost =
      profile.timeInLondon === 'visiting' && item.category === 'space' ? 1 : 0
    const score = tagHits * 3 + lookingForHit + newcomerBoost + visitorBoost
    return { ...item, score }
  })

  return scored
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
}
