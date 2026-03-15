import {
  FollowUpQuestion,
  ProfileExtractionResult,
  QuestionPlannerResult,
  StoredOnboardingState,
  TimeInLondon,
  UserProfile,
} from '@/lib/types'

export const ONBOARDING_STORAGE_KEY = 'starter-london:onboarding'

export const INTEREST_VOCAB = [
  'deeptech',
  'ai',
  'blockchain',
  'art',
  'music',
  'wine',
  'architecture',
  'community',
  'parties',
  'science',
  'founders',
  'design',
] as const

const TIME_OPTIONS: Array<{ id: TimeInLondon; label: string; value: string }> = [
  { id: 'pre-luma', label: 'was here pre-luma mate', value: 'was here pre-luma mate' },
  { id: 'new-arrival', label: 'fresh off the boat', value: 'fresh off the boat' },
  { id: 'visiting', label: 'just visiting', value: 'just visiting' },
  { id: 'other', label: 'other', value: 'other' },
]

export const DEFAULT_IDENTITY_TEXT = `I'm Lachlan, a 26-year-old scientist and tinkerer, who loves community building, parties and moonshot ideas - living my best life in Londontown. Looking for a new community space to hang out in.`

export function createEmptyProfile(): UserProfile {
  return {
    name: null,
    age: null,
    bio: '',
    timeInLondon: null,
    timeInLondonLabel: null,
    lookingFor: '',
    interests: [],
    vibeTags: [],
    summary: '',
    completedAt: null,
  }
}

export function extractProfile(identity: string): ProfileExtractionResult {
  const profile = createEmptyProfile()
  const signals = [] as ProfileExtractionResult['signals']
  const raw = identity.trim()
  const lower = raw.toLowerCase()

  profile.bio = raw

  const nameMatch = raw.match(/(?:i'm|i am)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i)
  if (nameMatch) {
    profile.name = nameMatch[1].trim()
    signals.push({ type: 'name', value: profile.name, confidence: 0.92 })
  }

  const ageMatch = raw.match(/(\d{2})-year-old|(\d{2})\s*years?\s*old/i)
  const ageValue = ageMatch ? Number(ageMatch[1] ?? ageMatch[2]) : null
  if (ageValue) {
    profile.age = ageValue
    signals.push({ type: 'age', value: String(ageValue), confidence: 0.88 })
  }

  const timeMap: Array<[TimeInLondon, RegExp, string]> = [
    ['pre-luma', /(years|ages|forever|long time|born here|londoner)/i, 'long-time londoner'],
    ['new-arrival', /(just moved|new to london|recently moved|fresh off|new arrival)/i, 'new to london'],
    ['visiting', /(visiting|in town for|here for a week|here for a few days|short stay)/i, 'visiting'],
  ]
  for (const [id, regex, label] of timeMap) {
    if (regex.test(lower)) {
      profile.timeInLondon = id
      profile.timeInLondonLabel = label
      signals.push({ type: 'timeInLondon', value: label, confidence: 0.75 })
      break
    }
  }

  const lookingForMatch = raw.match(/looking for\s+(.+?)(?:[.!]|$)/i)
  if (lookingForMatch) {
    profile.lookingFor = lookingForMatch[1].trim()
    signals.push({ type: 'lookingFor', value: profile.lookingFor, confidence: 0.8 })
  }

  const interests = INTEREST_VOCAB.filter((tag) => lower.includes(tag))
  if (lower.includes('scientist')) interests.push('science')
  if (lower.includes('tinkerer')) interests.push('deeptech')
  if (lower.includes('party')) interests.push('parties')
  if (lower.includes('community')) interests.push('community')

  profile.interests = unique(interests)
  profile.vibeTags = [...profile.interests]

  for (const interest of profile.interests) {
    signals.push({ type: 'interest', value: interest, confidence: 0.7 })
  }

  profile.summary = summarizeProfile(profile)

  return {
    profile,
    signals,
    missingFields: [
      ...(profile.timeInLondon ? [] : ['timeInLondon' as const]),
      ...(profile.lookingFor ? [] : ['lookingFor' as const]),
    ],
    suggestedTags: profile.interests.slice(0, 6),
  }
}

export function planQuestions(result: ProfileExtractionResult): QuestionPlannerResult {
  const questions: FollowUpQuestion[] = []

  if (result.missingFields.includes('timeInLondon')) {
    questions.push({
      id: 'time-in-london',
      kind: 'menu',
      prompt: 'Q: how long are you here for?',
      options: TIME_OPTIONS.map((option) => ({ ...option })),
    })
  }

  questions.push({
    id: 'what-to-see',
    kind: 'text',
    prompt: 'Q: what do you want to see?',
    placeholder: 'Tell the guide what scenes, people, or places you want more of.',
    suggestedTags: result.suggestedTags,
  })

  return { questions }
}

export function applyTimeInLondon(profile: UserProfile, value: string): UserProfile {
  const match = TIME_OPTIONS.find((option) => option.value === value || option.label === value)
  if (!match) {
    return {
      ...profile,
      timeInLondon: 'other',
      timeInLondonLabel: value,
      summary: summarizeProfile({ ...profile, timeInLondon: 'other', timeInLondonLabel: value }),
    }
  }

  return {
    ...profile,
    timeInLondon: match.id,
    timeInLondonLabel: match.label,
    summary: summarizeProfile({ ...profile, timeInLondon: match.id, timeInLondonLabel: match.label }),
  }
}

export function applyLookingFor(profile: UserProfile, value: string, suggestedTags: string[] = []): UserProfile {
  const lower = value.toLowerCase()
  const interests = unique([
    ...profile.interests,
    ...suggestedTags,
    ...INTEREST_VOCAB.filter((tag) => lower.includes(tag)),
  ])

  const next = {
    ...profile,
    lookingFor: value.trim(),
    interests,
    vibeTags: interests,
  }

  return { ...next, summary: summarizeProfile(next) }
}

export function finalizeProfile(profile: UserProfile): UserProfile {
  const next = { ...profile, completedAt: new Date().toISOString() }
  return { ...next, summary: summarizeProfile(next) }
}

export function summarizeProfile(profile: UserProfile): string {
  const bits = [
    profile.name ? `${profile.name} in London` : 'Traveller in London',
    profile.timeInLondonLabel ? profile.timeInLondonLabel : null,
    profile.lookingFor ? `looking for ${profile.lookingFor}` : null,
    profile.interests.length ? `into ${profile.interests.slice(0, 3).join(', ')}` : null,
  ].filter(Boolean)

  return bits.join(' | ')
}

export function loadStoredOnboarding(): StoredOnboardingState | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(ONBOARDING_STORAGE_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw) as StoredOnboardingState
  } catch {
    return null
  }
}

export function saveStoredOnboarding(state: StoredOnboardingState) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(state))
}

export function clearStoredOnboarding() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(ONBOARDING_STORAGE_KEY)
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}
