export interface LondonEvent {
  id: string
  name: string
  startAt: string
  endAt: string
  timezone: string
  url: string
  coverUrl: string | null
  locationName: string
  city: string
  organiserName: string
  organiserAvatarUrl: string | null
  tags: string[]
  source: 'luma-discovery' | 'luma-calendar' | 'luma-profile' | 'cerebral-valley' | 'eventbrite' | 'meetup' | 'other'
  calendarSlug?: string  // source slug that produced this event (enables per-source caching)
  scrapedAt: string
  curated: boolean
  pending?: boolean
}

export interface FailedSource {
  slug: string
  error: string
  statusCode?: number
  isRateLimit: boolean
  timestamp: string
}

export interface EventScraper {
  name: string
  run(): Promise<LondonEvent[]>
}

export interface CommunitySource {
  slug: string
  type: 'calendar' | 'user'
  curated: boolean
  reviewed: boolean
  name: string
  url: string
  addedAt: string
}

export type TimeInLondon = 'pre-luma' | 'new-arrival' | 'visiting' | 'other'

export interface UserProfile {
  name: string | null
  age: number | null
  bio: string
  timeInLondon: TimeInLondon | null
  timeInLondonLabel: string | null
  lookingFor: string
  interests: string[]
  vibeTags: string[]
  summary: string
  completedAt: string | null
}

export interface ProfileSignal {
  type: 'name' | 'age' | 'timeInLondon' | 'interest' | 'lookingFor'
  value: string
  confidence: number
}

export interface FollowUpQuestion {
  id: 'time-in-london' | 'what-to-see'
  kind: 'menu' | 'text'
  prompt: string
  options?: Array<{ id: string; label: string; value: string }>
  placeholder?: string
  suggestedTags?: string[]
}

export interface ProfileExtractionResult {
  profile: UserProfile
  signals: ProfileSignal[]
  missingFields: Array<'timeInLondon' | 'lookingFor'>
  suggestedTags: string[]
}

export interface QuestionPlannerResult {
  questions: FollowUpQuestion[]
}

export type GuideCategory = 'community' | 'space' | 'company'

export interface GuideItem {
  id: string
  category: GuideCategory
  name: string
  strapline: string
  description: string
  location: string
  tags: string[]
  vibe: string
  reason: string
  href?: string
}

export interface StoredOnboardingState {
  profile: UserProfile
  stage: 'in-progress' | 'complete'
  lastAnsweredAt: string
}
