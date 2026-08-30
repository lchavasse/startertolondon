export const CRM_OWNERS = ['Lachlan', 'Barrett'] as const

export const CRM_WORKSTREAMS = [
  'sponsor',
  'speaker',
  'expo',
  'attendee',
  'community_partner',
  'press',
  'topic',
  'week_ops',
] as const

export const CRM_OPPORTUNITY_STATUSES = ['active', 'won', 'lost', 'paused'] as const
export const CRM_TASK_STATUSES = ['todo', 'in_progress', 'blocked', 'done', 'cancelled'] as const
export const CRM_PRIORITIES = ['urgent', 'high', 'medium', 'low'] as const

export const CRM_SOURCE_SYSTEMS = [
  'sheet',
  'notion',
  'supabase',
  'gmail',
  'whatsapp',
  'granola',
  'linkedin',
  'manual',
] as const

export const CRM_ENTITY_TYPES = ['person', 'organisation', 'opportunity', 'task', 'interaction'] as const

export const CRM_CONTACT_ENTITY_TYPES = ['person', 'organisation'] as const

export const CRM_CONTACT_CHANNELS = [
  'email',
  'linkedin',
  'whatsapp',
  'phone',
  'x',
  'webform',
  'other',
] as const

export const CRM_OUTREACH_STATUSES = [
  'draft',
  'queued',
  'sent',
  'replied',
  'no_response',
  'bounced',
  'declined',
] as const

export const CRM_ENRICHMENT_SCOPE_TYPES = ['opportunity', 'organisation', 'person', 'topic', 'list_import'] as const

export const CRM_ENRICHMENT_JOB_TYPES = [
  'discover_contacts',
  'org_research',
  'speaker_research',
  'topic_research',
  'list_import',
] as const

export const CRM_ENRICHMENT_JOB_STATUSES = [
  'queued',
  'searching',
  'scraping',
  'extracting',
  'review',
  'promoted',
  'failed',
  'cancelled',
] as const

export const CRM_SEARCH_PROVIDERS = [
  'browser',
  'manual',
  'google',
  'linkedin',
  'company_site',
  'notion',
  'other',
] as const

export const CRM_SEARCH_RUN_STATUSES = ['queued', 'running', 'completed', 'failed'] as const

export const CRM_SEARCH_HIT_TYPES = [
  'company_site',
  'linkedin_profile',
  'linkedin_company',
  'team_page',
  'article',
  'directory',
  'event_page',
  'other',
] as const

export const CRM_SOURCE_DOCUMENT_TYPES = [
  'webpage',
  'linkedin_profile',
  'linkedin_company',
  'article',
  'directory',
  'note',
  'other',
] as const

export const CRM_EXTRACTION_FACT_TYPES = [
  'website',
  'linkedin_url',
  'person_name',
  'person_role',
  'contact_email',
  'contact_phone',
  'location',
  'market',
  'sponsor_fit',
  'speaker_topic',
  'relationship_claim',
  'other',
] as const

export const CRM_FACT_STATUSES = ['proposed', 'accepted', 'rejected', 'superseded'] as const

export const CRM_CANDIDATE_STATUSES = ['proposed', 'accepted', 'rejected', 'merged'] as const

export const CRM_CONNECTION_TYPES = [
  'works_at',
  'sponsor_target',
  'speaker_candidate',
  'founder_of',
  'partner_at',
  'knows_space',
  'likely_buyer',
  'warm_route',
] as const

export const CRM_CONNECTION_STATUSES = ['proposed', 'accepted', 'rejected'] as const

export const CRM_IMPORT_BATCH_TYPES = [
  'sponsor_targets',
  'speaker_longlist',
  'topic_seed',
  'people_seed',
  'organisation_seed',
] as const

export const CRM_IMPORT_BATCH_STATUSES = ['pending', 'processing', 'completed', 'failed', 'cancelled'] as const

export const CRM_IMPORT_ROW_STATUSES = [
  'pending',
  'normalized',
  'queued_for_enrichment',
  'promoted',
  'skipped',
  'failed',
] as const
