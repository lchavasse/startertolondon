import { getCrmServiceClient } from '../server'
import {
  CrmEnrichmentDashboard,
  CrmEnrichmentDashboardSummary,
  CrmEnrichmentJob,
  CrmEnrichmentJobDetail,
  CrmEnrichmentJobStatus,
  CrmEnrichmentJobType,
  CrmEnrichmentJobView,
  CrmEnrichmentScopeType,
  CrmExtractedFact,
  CrmConnectionCandidate,
  CrmEntityCandidate,
  CrmImportBatch,
  CrmImportBatchStatus,
  CrmImportBatchType,
  CrmImportRow,
  CrmPriority,
  CrmSearchHit,
  CrmSearchRun,
  CrmSourceDocument,
  CrmUser,
} from '../types'

async function loadUsers() {
  const supabase = getCrmServiceClient()
  const { data, error } = await supabase.from('crm_users').select('id, name').order('name')
  if (error) throw error
  return new Map(((data ?? []) as Pick<CrmUser, 'id' | 'name'>[]).map((user) => [user.id, user.name]))
}

function emptySummary(): CrmEnrichmentDashboardSummary {
  return {
    queued: 0,
    active: 0,
    review: 0,
    failed: 0,
    promoted: 0,
  }
}

export function emptyEnrichmentDashboard(): CrmEnrichmentDashboard {
  return {
    summary: emptySummary(),
    queuedJobs: [],
    reviewJobs: [],
    recentJobs: [],
  }
}

function buildScopeLabel(job: CrmEnrichmentJob) {
  if (job.scope_id) return `${job.scope_type}:${job.scope_id}`
  const candidateName = typeof job.input_payload?.name === 'string' ? job.input_payload.name : null
  const candidateQuery = typeof job.input_payload?.query === 'string' ? job.input_payload.query : null
  return candidateName ?? candidateQuery ?? null
}

async function decorateJobs(jobs: CrmEnrichmentJob[]): Promise<CrmEnrichmentJobView[]> {
  if (!jobs.length) return []
  const userMap = await loadUsers()
  return jobs.map((job) => ({
    ...job,
    scope_label: buildScopeLabel(job),
    requested_by_name: job.requested_by_user_id ? userMap.get(job.requested_by_user_id) ?? null : null,
    assigned_to_name: job.assigned_to_user_id ? userMap.get(job.assigned_to_user_id) ?? null : null,
  }))
}

export async function fetchEnrichmentDashboard(): Promise<CrmEnrichmentDashboard> {
  const supabase = getCrmServiceClient()
  const { data, error } = await supabase
    .from('crm_enrichment_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(60)

  if (error) throw error
  const jobs = (data ?? []) as CrmEnrichmentJob[]
  if (!jobs.length) return emptyEnrichmentDashboard()

  const decorated = await decorateJobs(jobs)
  const summary = decorated.reduce<CrmEnrichmentDashboardSummary>((acc, job) => {
    if (job.status === 'queued') acc.queued += 1
    if (['searching', 'scraping', 'extracting'].includes(job.status)) acc.active += 1
    if (job.status === 'review') acc.review += 1
    if (job.status === 'failed') acc.failed += 1
    if (job.status === 'promoted') acc.promoted += 1
    return acc
  }, emptySummary())

  return {
    summary,
    queuedJobs: decorated.filter((job) => job.status === 'queued').slice(0, 12),
    reviewJobs: decorated.filter((job) => job.status === 'review').slice(0, 12),
    recentJobs: decorated.slice(0, 20),
  }
}

export async function fetchEnrichmentJobDetail(id: string): Promise<CrmEnrichmentJobDetail | null> {
  const supabase = getCrmServiceClient()
  const [{ data: job, error: jobError }, { data: searchRuns, error: searchRunsError }, { data: sourceDocuments, error: sourceDocumentsError }, { data: extractedFacts, error: extractedFactsError }, { data: entityCandidates, error: entityCandidatesError }, { data: connectionCandidates, error: connectionCandidatesError }] = await Promise.all([
    supabase.from('crm_enrichment_jobs').select('*').eq('id', id).maybeSingle(),
    supabase.from('crm_search_runs').select('*').eq('job_id', id).order('created_at', { ascending: false }),
    supabase.from('crm_source_documents').select('*').eq('job_id', id).order('created_at', { ascending: false }),
    supabase.from('crm_extracted_facts').select('*').eq('job_id', id).order('created_at', { ascending: false }),
    supabase.from('crm_entity_candidates').select('*').eq('job_id', id).order('created_at', { ascending: false }),
    supabase.from('crm_connection_candidates').select('*').eq('job_id', id).order('created_at', { ascending: false }),
  ])

  if (jobError) throw jobError
  if (searchRunsError) throw searchRunsError
  if (sourceDocumentsError) throw sourceDocumentsError
  if (extractedFactsError) throw extractedFactsError
  if (entityCandidatesError) throw entityCandidatesError
  if (connectionCandidatesError) throw connectionCandidatesError
  if (!job) return null

  const runs = (searchRuns ?? []) as CrmSearchRun[]
  const runIds = runs.map((run) => run.id)
  const searchHitsResult = runIds.length
    ? await supabase.from('crm_search_hits').select('*').in('search_run_id', runIds).order('rank', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false })
    : { data: [], error: null }
  if (searchHitsResult.error) throw searchHitsResult.error

  const [decoratedJob] = await decorateJobs([job as CrmEnrichmentJob])
  return {
    job: decoratedJob,
    searchRuns: runs,
    searchHits: (searchHitsResult.data ?? []) as CrmSearchHit[],
    sourceDocuments: ((sourceDocuments ?? []) as CrmSourceDocument[]).map((document) => ({ ...document, metadata: (document.metadata ?? {}) as Record<string, unknown> })),
    extractedFacts: (extractedFacts ?? []) as CrmExtractedFact[],
    entityCandidates: (entityCandidates ?? []) as CrmEntityCandidate[],
    connectionCandidates: (connectionCandidates ?? []) as CrmConnectionCandidate[],
  }
}

export async function queueEnrichmentJob(input: {
  scope_type: CrmEnrichmentScopeType
  scope_id?: string | null
  job_type: CrmEnrichmentJobType
  priority?: CrmPriority
  requested_by_user_id?: string | null
  assigned_to_user_id?: string | null
  input_payload?: Record<string, unknown>
  status?: CrmEnrichmentJobStatus
}) {
  const supabase = getCrmServiceClient()
  const payload = {
    scope_type: input.scope_type,
    scope_id: input.scope_id ?? null,
    job_type: input.job_type,
    priority: input.priority ?? 'medium',
    requested_by_user_id: input.requested_by_user_id ?? null,
    assigned_to_user_id: input.assigned_to_user_id ?? null,
    input_payload: input.input_payload ?? {},
    status: input.status ?? 'queued',
  }
  const { data, error } = await supabase.from('crm_enrichment_jobs').insert(payload).select('*').single()
  if (error) throw error
  return data as CrmEnrichmentJob
}

export async function createImportBatch(input: {
  source_system: string
  name: string
  source_url?: string | null
  import_type: CrmImportBatchType
  metadata?: Record<string, unknown>
  status?: CrmImportBatchStatus
}) {
  const supabase = getCrmServiceClient()
  const { data, error } = await supabase
    .from('crm_import_batches')
    .insert({
      source_system: input.source_system,
      name: input.name,
      source_url: input.source_url ?? null,
      import_type: input.import_type,
      metadata: input.metadata ?? {},
      status: input.status ?? 'pending',
      row_count: 0,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as CrmImportBatch
}

export async function addImportRows(batchId: string, rows: Array<{ row_index: number; raw_payload: Record<string, unknown>; normalized_name?: string | null; normalized_type?: string | null; status?: string }>) {
  if (!rows.length) return [] as CrmImportRow[]
  const supabase = getCrmServiceClient()
  const payload = rows.map((row) => ({
    batch_id: batchId,
    row_index: row.row_index,
    raw_payload: row.raw_payload,
    normalized_name: row.normalized_name ?? null,
    normalized_type: row.normalized_type ?? null,
    status: row.status ?? 'pending',
  }))
  const { data, error } = await supabase.from('crm_import_rows').upsert(payload).select('*')
  if (error) throw error
  const { error: updateError } = await supabase.from('crm_import_batches').update({ row_count: rows.length }).eq('id', batchId)
  if (updateError) throw updateError
  return (data ?? []) as CrmImportRow[]
}
