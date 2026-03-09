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
  source: 'luma-discovery' | 'luma-calendar' | 'luma-profile'
  scrapedAt: string
}

export interface EventScraper {
  name: string
  run(): Promise<LondonEvent[]>
}
