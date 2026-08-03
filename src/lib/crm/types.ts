import {
  CRM_CANDIDATE_STATUSES,
  CRM_CONNECTION_STATUSES,
  CRM_CONNECTION_TYPES,
  CRM_CONTACT_CHANNELS,
  CRM_CONTACT_ENTITY_TYPES,
  CRM_ENRICHMENT_JOB_STATUSES,
  CRM_ENRICHMENT_JOB_TYPES,
  CRM_ENRICHMENT_SCOPE_TYPES,
  CRM_ENTITY_TYPES,
  CRM_EXTRACTION_FACT_TYPES,
  CRM_FACT_STATUSES,
  CRM_IMPORT_BATCH_STATUSES,
  CRM_IMPORT_BATCH_TYPES,
  CRM_IMPORT_ROW_STATUSES,
  CRM_OPPORTUNITY_STATUSES,
  CRM_OUTREACH_STATUSES,
  CRM_OWNERS,
  CRM_PRIORITIES,
  CRM_SEARCH_HIT_TYPES,
  CRM_SEARCH_PROVIDERS,
  CRM_SEARCH_RUN_STATUSES,
  CRM_SOURCE_DOCUMENT_TYPES,
  CRM_SOURCE_SYSTEMS,
  CRM_TASK_STATUSES,
  CRM_WORKSTREAMS,
} from './constants'

export type CrmOwner = (typeof CRM_OWNERS)[number]
export type CrmWorkstream = (typeof CRM_WORKSTREAMS)[number]
export type CrmOpportunityStatus = (typeof CRM_OPPORTUNITY_STATUSES)[number]
export type CrmTaskStatus = (typeof CRM_TASK_STATUSES)[number]
export type CrmPriority = (typeof CRM_PRIORITIES)[number]
export type CrmSourceSystem = (typeof CRM_SOURCE_SYSTEMS)[number]
export type CrmEntityType = (typeof CRM_ENTITY_TYPES)[number]
export type CrmContactEntityType = (typeof CRM_CONTACT_ENTITY_TYPES)[number]
export type CrmContactChannel = (typeof CRM_CONTACT_CHANNELS)[number]
export type CrmOutreachStatus = (typeof CRM_OUTREACH_STATUSES)[number]
export type CrmEnrichmentScopeType = (typeof CRM_ENRICHMENT_SCOPE_TYPES)[number]
export type CrmEnrichmentJobType = (typeof CRM_ENRICHMENT_JOB_TYPES)[number]
export type CrmEnrichmentJobStatus = (typeof CRM_ENRICHMENT_JOB_STATUSES)[number]
export type CrmSearchProvider = (typeof CRM_SEARCH_PROVIDERS)[number]
export type CrmSearchRunStatus = (typeof CRM_SEARCH_RUN_STATUSES)[number]
export type CrmSearchHitType = (typeof CRM_SEARCH_HIT_TYPES)[number]
export type CrmSourceDocumentType = (typeof CRM_SOURCE_DOCUMENT_TYPES)[number]
export type CrmExtractionFactType = (typeof CRM_EXTRACTION_FACT_TYPES)[number]
export type CrmFactStatus = (typeof CRM_FACT_STATUSES)[number]
export type CrmCandidateStatus = (typeof CRM_CANDIDATE_STATUSES)[number]
export type CrmConnectionType = (typeof CRM_CONNECTION_TYPES)[number]
export type CrmConnectionStatus = (typeof CRM_CONNECTION_STATUSES)[number]
export type CrmImportBatchType = (typeof CRM_IMPORT_BATCH_TYPES)[number]
export type CrmImportBatchStatus = (typeof CRM_IMPORT_BATCH_STATUSES)[number]
export type CrmImportRowStatus = (typeof CRM_IMPORT_ROW_STATUSES)[number]

export interface CrmUser {
  id: string
  slug: string
  name: string
  email: string | null
  created_at: string
  updated_at: string
}

export interface CrmOrganisation {
  id: string
  name: string
  slug: string
  org_type: string
  website: string | null
  linkedin_url: string | null
  notes_freeform: string | null
  relationship_summary: string | null
  owner_user_id: string | null
  created_at: string
  updated_at: string
}

export interface CrmPerson {
  id: string
  full_name: string
  slug: string
  primary_email: string | null
  primary_phone: string | null
  linkedin_url: string | null
  title: string | null
  location: string | null
  notes_freeform: string | null
  relationship_summary: string | null
  owner_user_id: string | null
  last_contacted_at: string | null
  next_followup_at: string | null
  created_at: string
  updated_at: string
}

export interface CrmOpportunity {
  id: string
  title: string
  workstream: CrmWorkstream | string
  stage: string | null
  status: CrmOpportunityStatus | string
  priority: CrmPriority | string
  owner_user_id: string | null
  source_of_lead: string | null
  ask_type: string | null
  value_notes: string | null
  summary: string | null
  next_action: string | null
  next_followup_at: string | null
  last_activity_at: string | null
  notes_freeform: string | null
  created_at: string
  updated_at: string
}

export interface CrmTask {
  id: string
  title: string
  description: string | null
  owner_user_id: string | null
  linked_opportunity_id: string | null
  linked_person_id: string | null
  linked_organisation_id: string | null
  status: CrmTaskStatus | string
  priority: CrmPriority | string
  due_at: string | null
  reminder_at: string | null
  generated_by_rule: boolean
  created_at: string
  updated_at: string
}

export interface CrmInteraction {
  id: string
  interaction_type: string
  direction: 'inbound' | 'outbound' | 'internal' | string
  happened_at: string
  summary: string
  raw_excerpt: string | null
  source_system: string | null
  source_external_id: string | null
  source_url: string | null
  person_id: string | null
  organisation_id: string | null
  opportunity_id: string | null
  created_by_user_id: string | null
  created_at: string
}

export interface CrmSourceLink {
  id: string
  entity_type: CrmEntityType | string
  entity_id: string
  source_system: CrmSourceSystem | string
  source_ref: string | null
  source_url: string | null
  metadata: Record<string, unknown>
  last_synced_at: string | null
  created_at: string
}

export interface CrmContactPoint {
  id: string
  entity_type: CrmContactEntityType | string
  entity_id: string
  label: string | null
  channel: CrmContactChannel | string
  value: string
  notes: string | null
  is_primary: boolean
  created_at: string
  updated_at: string
}

export interface CrmOutreachEntry {
  id: string
  opportunity_id: string
  contact_point_id: string | null
  person_id: string | null
  organisation_id: string | null
  owner_user_id: string | null
  channel: CrmContactChannel | string
  direction: 'outbound' | 'inbound' | 'internal' | string
  status: CrmOutreachStatus | string
  subject: string | null
  body_excerpt: string | null
  happened_at: string
  next_step: string | null
  next_due_at: string | null
  source_url: string | null
  notes: string | null
  created_at: string
}

export interface CrmPersonOrganisation {
  id: string
  person_id: string
  organisation_id: string
  role_label: string | null
  is_primary: boolean
  notes: string | null
  created_at: string
}

export interface CrmOpportunityPerson {
  id: string
  opportunity_id: string
  person_id: string
  role_label: string | null
  created_at: string
}

export interface CrmOpportunityOrganisation {
  id: string
  opportunity_id: string
  organisation_id: string
  role_label: string | null
  created_at: string
}

export interface CrmOpportunityView extends CrmOpportunity {
  owner_name: string | null
  people: Array<{ id: string; full_name: string; role_label: string | null }>
  organisations: Array<{ id: string; name: string; role_label: string | null }>
}

export interface CrmTaskView extends CrmTask {
  owner_name: string | null
  linked_opportunity_title: string | null
  linked_person_name: string | null
  linked_organisation_name: string | null
}

export interface CrmDashboardSummary {
  opportunityCount: number
  activeOpportunityCount: number
  overdueOpportunityCount: number
  taskCount: number
  overdueTaskCount: number
  dueTodayTaskCount: number
  peopleNeedingFollowupCount: number
  organisationCount: number
  interactionCount: number
}

export interface CrmInboundSummary {
  applicationCount: number
  waitlistCount: number
  latestApplicationAt: string | null
  latestWaitlistAt: string | null
}

export interface CrmDashboardData {
  summary: CrmDashboardSummary
  overdueOpportunities: CrmOpportunityView[]
  overdueTasks: CrmTaskView[]
  dueTodayTasks: CrmTaskView[]
  staleActiveOpportunities: CrmOpportunityView[]
  recentInteractions: CrmInteraction[]
  inbound: CrmInboundSummary
}

export interface CrmCountSummary {
  organisations: number
  people: number
  opportunities: number
  tasks: number
  interactions: number
  sourceLinks: number
}

export interface CrmPersonDetail {
  person: CrmPerson
  owner_name: string | null
  organisations: Array<{ organisation: CrmOrganisation; role_label: string | null; is_primary: boolean; notes: string | null }>
  opportunities: CrmOpportunityView[]
  tasks: CrmTaskView[]
  interactions: CrmInteraction[]
  sourceLinks: CrmSourceLink[]
}

export interface CrmOrganisationDetail {
  organisation: CrmOrganisation
  owner_name: string | null
  people: Array<{ person: CrmPerson; role_label: string | null; is_primary: boolean; notes: string | null }>
  opportunities: CrmOpportunityView[]
  tasks: CrmTaskView[]
  interactions: CrmInteraction[]
  sourceLinks: CrmSourceLink[]
}

export interface CrmOpportunityDetail {
  opportunity: CrmOpportunityView
  owner_name: string | null
  tasks: CrmTaskView[]
  interactions: CrmInteraction[]
  sourceLinks: CrmSourceLink[]
  contactPoints: CrmContactPoint[]
  outreachEntries: CrmOutreachEntry[]
}

export interface CrmEnrichmentJob {
  id: string
  scope_type: CrmEnrichmentScopeType | string
  scope_id: string | null
  job_type: CrmEnrichmentJobType | string
  status: CrmEnrichmentJobStatus | string
  priority: CrmPriority | string
  requested_by_user_id: string | null
  assigned_to_user_id: string | null
  input_payload: Record<string, unknown>
  result_summary: string | null
  error_log: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface CrmSearchRun {
  id: string
  job_id: string
  provider: CrmSearchProvider | string
  query: string
  status: CrmSearchRunStatus | string
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CrmSearchHit {
  id: string
  search_run_id: string
  title: string | null
  url: string
  snippet: string | null
  domain: string | null
  rank: number | null
  hit_type: CrmSearchHitType | string
  selected_for_fetch: boolean
  created_at: string
}

export interface CrmSourceDocument {
  id: string
  job_id: string | null
  search_hit_id: string | null
  source_system: CrmSourceSystem | string
  url: string | null
  title: string | null
  document_type: CrmSourceDocumentType | string
  fetched_at: string | null
  raw_text: string | null
  metadata: Record<string, unknown>
  content_hash: string | null
  parse_status: string | null
  created_at: string
  updated_at: string
}

export interface CrmExtractedFact {
  id: string
  job_id: string
  source_document_id: string
  subject_type: CrmEnrichmentScopeType | string
  subject_temp_key: string | null
  fact_type: CrmExtractionFactType | string
  fact_value: string
  confidence: number | null
  evidence_excerpt: string | null
  status: CrmFactStatus | string
  created_at: string
  updated_at: string
}

export interface CrmEntityCandidate {
  id: string
  job_id: string
  entity_type: CrmContactEntityType | string
  name: string
  headline_or_role: string | null
  website: string | null
  linkedin_url: string | null
  location: string | null
  summary: string | null
  confidence: number | null
  status: CrmCandidateStatus | string
  promoted_entity_id: string | null
  created_at: string
  updated_at: string
}

export interface CrmConnectionCandidate {
  id: string
  job_id: string
  from_entity_type: CrmEntityType | string
  from_entity_id: string | null
  from_candidate_id: string | null
  to_entity_type: CrmEntityType | string
  to_entity_id: string | null
  to_candidate_id: string | null
  connection_type: CrmConnectionType | string
  label: string | null
  confidence: number | null
  evidence_excerpt: string | null
  status: CrmConnectionStatus | string
  created_at: string
  updated_at: string
}

export interface CrmImportBatch {
  id: string
  source_system: CrmSourceSystem | string
  name: string
  source_url: string | null
  import_type: CrmImportBatchType | string
  row_count: number
  status: CrmImportBatchStatus | string
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CrmImportRow {
  id: string
  batch_id: string
  row_index: number
  raw_payload: Record<string, unknown>
  normalized_name: string | null
  normalized_type: string | null
  linked_opportunity_id: string | null
  linked_candidate_id: string | null
  linked_entity_id: string | null
  status: CrmImportRowStatus | string
  created_at: string
  updated_at: string
}

export interface CrmEnrichmentDashboardSummary {
  queued: number
  active: number
  review: number
  failed: number
  promoted: number
}

export interface CrmEnrichmentJobView extends CrmEnrichmentJob {
  scope_label: string | null
  requested_by_name: string | null
  assigned_to_name: string | null
}

export interface CrmEnrichmentDashboard {
  summary: CrmEnrichmentDashboardSummary
  queuedJobs: CrmEnrichmentJobView[]
  reviewJobs: CrmEnrichmentJobView[]
  recentJobs: CrmEnrichmentJobView[]
}

export interface CrmEnrichmentJobDetail {
  job: CrmEnrichmentJobView
  searchRuns: CrmSearchRun[]
  searchHits: CrmSearchHit[]
  sourceDocuments: CrmSourceDocument[]
  extractedFacts: CrmExtractedFact[]
  entityCandidates: CrmEntityCandidate[]
  connectionCandidates: CrmConnectionCandidate[]
}
