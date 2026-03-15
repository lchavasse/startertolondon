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
