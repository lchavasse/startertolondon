export const CRM_PILLARS = [
  'energy',
  'compute',
  'manufacturing',
  'biotech',
  'lab_automation',
  'space',
  'defence',
  'robotics',
  'autonomy',
  'materials',
  'hardware_other',
  'science',
] as const

export const CRM_PEOPLE_GROUPS = [
  'rivan',
  'top_founder',
  'early_eng_founder',
  'senior_engineer',
  'postdoc',
  'recent_grad',
  'policy_misc',
  'vc',
  'deeptech_operator',
  'deeptech_ic',
  'none',
] as const

export const GROUP_LABELS: Record<string, string> = {
  rivan: 'Rivan',
  top_founder: 'Top founders',
  early_eng_founder: 'Early-stage eng founders',
  senior_engineer: 'Senior engineers',
  postdoc: 'Post-docs',
  recent_grad: 'Recent grads',
  policy_misc: 'Policy / misc',
  vc: 'VCs',
  deeptech_operator: 'Deeptech operators',
  deeptech_ic: 'Deeptech ICs',
  none: 'Unsorted',
}

export type CrmPillar = (typeof CRM_PILLARS)[number]
export type CrmPeopleGroup = (typeof CRM_PEOPLE_GROUPS)[number]

export interface CrmPoolPerson {
  slug: string
  profile_url: string
  full_name: string | null
  company: string | null
  location: string | null
  followers: number | null
  event_group: string
  pillars: string[]
  seniority: string | null
  role_type: string | null
  confidence: number
  evidence: string | null
  fit: number
  is_deeptech: boolean
  scanner_sector: string | null
  is_physical: boolean | null
  industrial_score: number | null
  company_stage: string | null
  company_website: string | null
  is_connection: boolean
  last_message_at: string | null
  awaiting_reply_from: string | null
  message_count: number | null
  sources: string | null
  doctorate_status: 'completed' | 'in_progress' | 'none' | null
  doctorate_field: string | null
  doctorate_institution: string | null
  doctorate_confidence: number | null
  shortlisted: boolean
  note: string | null
  corrected: boolean
}
