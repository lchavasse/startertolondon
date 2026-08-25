// The working layer over the sources. See supabase/migrations/20260825_crm_contacts.sql.

export const CRM_CONTACT_STATUSES = [
  'new',
  'reviewing',
  'contacted',
  'in_conversation',
  'confirmed',
  'declined',
  'parked',
] as const

export type CrmContactStatus = (typeof CRM_CONTACT_STATUSES)[number]

export const CONTACT_STATUS_LABELS: Record<CrmContactStatus, string> = {
  new: 'new',
  reviewing: 'reviewing',
  contacted: 'contacted',
  in_conversation: 'in conversation',
  confirmed: 'confirmed',
  declined: 'declined',
  parked: 'parked',
}

// Which lake a contact was pulled up from. Not a foreign key — the sources are owned by scrapers
// and public forms, and one of them lives in another repo.
export const CRM_CONTACT_SOURCES = [
  'expo_application',
  'waitlist',
  'people_pool',
  'scanner',
  'founder_candidate',
  'linkedin_url',
  'manual',
] as const

export const CRM_CONTACT_EVENT_KINDS = ['note', 'outreach', 'reply', 'meeting', 'status_change'] as const

export type CrmContactEventKind = (typeof CRM_CONTACT_EVENT_KINDS)[number]

// Labels are free text on purpose — the vocabulary is still forming and an enum would mean a
// migration every time a new one is wanted. These are only the quick-add suggestions.
export const CONTACT_LABEL_SUGGESTIONS = [
  'expo',
  'speaker',
  'sponsor',
  'attendee',
  'investor',
  'community',
  'press',
  'volunteer',
  'hot',
  'needs-reply',
]

export interface CrmContact {
  id: string
  full_name: string
  company: string | null
  email: string | null
  phone: string | null
  linkedin_url: string | null
  source_system: string
  source_ref: string | null
  status: CrmContactStatus
  labels: string[]
  note: string | null
  owner: string | null
  last_contacted_at: string | null
  next_followup_at: string | null
  enrichment: Record<string, unknown>
  enriched_at: string | null
  created_at: string
  updated_at: string
}

export interface CrmContactEvent {
  id: string
  contact_id: string
  happened_at: string
  kind: CrmContactEventKind
  body: string
  author: string | null
  created_at: string
}

// One person can arrive from the pool, the scanner and a pasted URL with three different spellings
// of the same profile. Normalise before it becomes the identity key, or the unique index does
// nothing.
export function normaliseLinkedInUrl(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    return null
  }
  if (!/(^|\.)linkedin\.com$/i.test(url.hostname)) return null
  const path = url.pathname.replace(/\/+$/, '')
  const match = path.match(/\/in\/([^/]+)/i)
  if (!match) return null
  return `https://www.linkedin.com/in/${decodeURIComponent(match[1]).toLowerCase()}`
}

export function labelsFromInput(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  const clean = value
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim().toLowerCase())
    .filter((v) => v && v.length <= 40)
  return [...new Set(clean)]
}
