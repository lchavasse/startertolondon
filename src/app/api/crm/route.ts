import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getCrmServiceClient, fetchCrmChaseQueue, fetchCrmDashboardData, fetchCrmOpportunityDetail, fetchCrmOpportunities, fetchCrmTasks, fetchCrmPeople, fetchCrmOrganisations, fetchCrmPersonDetail, fetchCrmOrganisationDetail, fetchCrmInteractions, fetchCrmSourceLinks, searchCrm } from '@/lib/crm/server'
import { CRM_CONTACT_CHANNELS, CRM_CONTACT_ENTITY_TYPES, CRM_ENTITY_TYPES, CRM_OPPORTUNITY_STATUSES, CRM_OUTREACH_STATUSES, CRM_PRIORITIES, CRM_SOURCE_DOCUMENT_TYPES, CRM_SOURCE_SYSTEMS, CRM_TASK_STATUSES, CRM_WORKSTREAMS } from '@/lib/crm/constants'

const CRM_COOKIE = 'crm_admin_key'

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET
  if (secret && (req.headers.get('x-admin-key') === secret || req.cookies.get(CRM_COOKIE)?.value === secret)) return true

  const agentToken = process.env.CRM_AGENT_TOKEN
  if (agentToken && req.headers.get('authorization') === `Bearer ${agentToken}`) return true

  return false
}

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function pick(source: Record<string, unknown>, allowed: string[]) {
  const out: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in source) out[key] = source[key]
  }
  return out
}

function ensureEnum(value: unknown, allowed: readonly string[], field: string) {
  if (value == null) return null
  if (typeof value !== 'string' || !allowed.includes(value)) throw new Error(`Invalid ${field}`)
  return value
}

async function replaceRelationRows(table: 'crm_opportunity_people' | 'crm_opportunity_organisations', opportunityId: string, items: Array<{ id: string; role_label?: string | null }>, key: 'person_id' | 'organisation_id') {
  const supabase = getCrmServiceClient()
  const { error: deleteError } = await supabase.from(table).delete().eq('opportunity_id', opportunityId)
  if (deleteError) throw deleteError
  if (!items.length) return
  const payload = items.map((item) => ({ opportunity_id: opportunityId, [key]: item.id, role_label: item.role_label ?? null }))
  const { error } = await supabase.from(table).insert(payload)
  if (error) throw error
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return bad('Unauthorized', 401)

  const url = new URL(req.url)
  const entity = url.searchParams.get('entity')
  const id = url.searchParams.get('id')
  const limitParam = Number(url.searchParams.get('limit'))
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : undefined

  if (!entity || entity === 'dashboard') {
    return NextResponse.json(await fetchCrmDashboardData())
  }
  if (entity === 'chase') return NextResponse.json(await fetchCrmChaseQueue({ limit }))
  if (entity === 'search') {
    const q = url.searchParams.get('q')
    if (!q) return bad('q required')
    return NextResponse.json(await searchCrm(q, { limit }))
  }
  if (entity === 'opportunities') return NextResponse.json(id ? await fetchCrmOpportunityDetail(id) : await fetchCrmOpportunities())
  if (entity === 'tasks') return NextResponse.json(await fetchCrmTasks())
  if (entity === 'people') return NextResponse.json(id ? await fetchCrmPersonDetail(id) : await fetchCrmPeople())
  if (entity === 'organisations') return NextResponse.json(id ? await fetchCrmOrganisationDetail(id) : await fetchCrmOrganisations())
  if (entity === 'interactions') return NextResponse.json(await fetchCrmInteractions())
  if (entity === 'source-links') return NextResponse.json(await fetchCrmSourceLinks(url.searchParams.get('entityType') ?? undefined, id ?? undefined))

  return bad('Unsupported entity', 404)
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return bad('Unauthorized', 401)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return bad('Invalid JSON')
  }

  const action = body.action
  if (typeof action !== 'string') return bad('action required')

  const supabase = getCrmServiceClient()

  try {
    if (action === 'upsert-person') {
      const fields = asRecord(body.fields)
      if (!fields) return bad('fields required')
      const payload = pick(fields, ['id', 'full_name', 'slug', 'primary_email', 'primary_phone', 'linkedin_url', 'title', 'location', 'notes_freeform', 'relationship_summary', 'owner_user_id', 'last_contacted_at', 'next_followup_at'])
      if (typeof payload.full_name !== 'string' || typeof payload.slug !== 'string') return bad('full_name and slug required')
      const { data, error } = await supabase.from('crm_people').upsert(payload).select('*').single()
      if (error) throw error
      return NextResponse.json(data)
    }

    if (action === 'upsert-organisation') {
      const fields = asRecord(body.fields)
      if (!fields) return bad('fields required')
      const payload = pick(fields, ['id', 'name', 'slug', 'org_type', 'website', 'linkedin_url', 'notes_freeform', 'relationship_summary', 'owner_user_id'])
      if (typeof payload.name !== 'string' || typeof payload.slug !== 'string' || typeof payload.org_type !== 'string') return bad('name, slug, org_type required')
      const { data, error } = await supabase.from('crm_organisations').upsert(payload).select('*').single()
      if (error) throw error
      return NextResponse.json(data)
    }

    if (action === 'upsert-opportunity') {
      const fields = asRecord(body.fields)
      if (!fields) return bad('fields required')
      ensureEnum(fields.workstream, CRM_WORKSTREAMS, 'workstream')
      ensureEnum(fields.status ?? 'active', CRM_OPPORTUNITY_STATUSES, 'status')
      ensureEnum(fields.priority ?? 'medium', CRM_PRIORITIES, 'priority')
      const payload = pick(fields, ['id', 'title', 'workstream', 'stage', 'status', 'priority', 'owner_user_id', 'source_of_lead', 'ask_type', 'value_notes', 'summary', 'next_action', 'next_followup_at', 'last_activity_at', 'notes_freeform'])
      if (typeof payload.title !== 'string' || typeof payload.workstream !== 'string') return bad('title and workstream required')
      const { data, error } = await supabase.from('crm_opportunities').upsert(payload).select('*').single()
      if (error) throw error
      const people = Array.isArray(body.people) ? body.people : []
      const organisations = Array.isArray(body.organisations) ? body.organisations : []
      await replaceRelationRows('crm_opportunity_people', data.id, people.map((item) => ({ id: (item as { id?: string }).id ?? '', role_label: (item as { role_label?: string | null }).role_label ?? null })).filter((item) => item.id), 'person_id')
      await replaceRelationRows('crm_opportunity_organisations', data.id, organisations.map((item) => ({ id: (item as { id?: string }).id ?? '', role_label: (item as { role_label?: string | null }).role_label ?? null })).filter((item) => item.id), 'organisation_id')
      return NextResponse.json(data)
    }

    if (action === 'upsert-task') {
      const fields = asRecord(body.fields)
      if (!fields) return bad('fields required')
      ensureEnum(fields.status ?? 'todo', CRM_TASK_STATUSES, 'status')
      ensureEnum(fields.priority ?? 'medium', CRM_PRIORITIES, 'priority')
      const payload = pick(fields, ['id', 'title', 'description', 'owner_user_id', 'linked_opportunity_id', 'linked_person_id', 'linked_organisation_id', 'status', 'priority', 'due_at', 'reminder_at', 'generated_by_rule'])
      if (typeof payload.title !== 'string') return bad('title required')
      const { data, error } = await supabase.from('crm_tasks').upsert(payload).select('*').single()
      if (error) throw error
      return NextResponse.json(data)
    }

    if (action === 'add-interaction') {
      const fields = asRecord(body.fields)
      if (!fields) return bad('fields required')
      const payload = pick(fields, ['interaction_type', 'direction', 'happened_at', 'summary', 'raw_excerpt', 'source_system', 'source_external_id', 'source_url', 'person_id', 'organisation_id', 'opportunity_id', 'created_by_user_id'])
      if (typeof payload.interaction_type !== 'string' || typeof payload.summary !== 'string') return bad('interaction_type and summary required')
      const { data, error } = await supabase.from('crm_interactions').insert(payload).select('*').single()
      if (error) throw error
      return NextResponse.json(data)
    }

    if (action === 'add-contact-point') {
      const fields = asRecord(body.fields)
      if (!fields) return bad('fields required')
      ensureEnum(fields.entity_type, CRM_CONTACT_ENTITY_TYPES, 'entity_type')
      ensureEnum(fields.channel, CRM_CONTACT_CHANNELS, 'channel')
      const payload = pick(fields, ['entity_type', 'entity_id', 'label', 'channel', 'value', 'notes', 'is_primary'])
      if (typeof payload.entity_type !== 'string' || typeof payload.entity_id !== 'string' || typeof payload.channel !== 'string' || typeof payload.value !== 'string') {
        return bad('entity_type, entity_id, channel, value required')
      }
      const { data, error } = await supabase.from('crm_contact_points').insert(payload).select('*').single()
      if (error) throw error
      return NextResponse.json(data)
    }

    if (action === 'add-outreach-entry') {
      const fields = asRecord(body.fields)
      if (!fields) return bad('fields required')
      ensureEnum(fields.channel, CRM_CONTACT_CHANNELS, 'channel')
      ensureEnum(fields.status ?? 'sent', CRM_OUTREACH_STATUSES, 'status')
      const payload = pick(fields, ['opportunity_id', 'contact_point_id', 'person_id', 'organisation_id', 'owner_user_id', 'channel', 'direction', 'status', 'subject', 'body_excerpt', 'happened_at', 'next_step', 'next_due_at', 'source_url', 'notes'])
      if (typeof payload.opportunity_id !== 'string' || typeof payload.channel !== 'string') return bad('opportunity_id and channel required')
      const { data, error } = await supabase.from('crm_outreach_entries').insert(payload).select('*').single()
      if (error) throw error

      const interactionSummary = [
        typeof payload.channel === 'string' ? payload.channel : 'outreach',
        typeof payload.subject === 'string' ? payload.subject : typeof payload.next_step === 'string' ? payload.next_step : 'outreach logged',
      ].filter(Boolean).join(' · ')

      const { error: interactionError } = await supabase.from('crm_interactions').insert({
        interaction_type: 'manual',
        direction: typeof payload.direction === 'string' ? payload.direction : 'outbound',
        happened_at: payload.happened_at,
        summary: interactionSummary,
        raw_excerpt: typeof payload.body_excerpt === 'string' ? payload.body_excerpt : null,
        source_system: 'manual',
        source_url: typeof payload.source_url === 'string' ? payload.source_url : null,
        person_id: typeof payload.person_id === 'string' ? payload.person_id : null,
        organisation_id: typeof payload.organisation_id === 'string' ? payload.organisation_id : null,
        opportunity_id: payload.opportunity_id,
        created_by_user_id: typeof payload.owner_user_id === 'string' ? payload.owner_user_id : null,
      })
      if (interactionError) throw interactionError

      const opportunityPatch: Record<string, unknown> = {
        last_activity_at: typeof payload.happened_at === 'string' ? payload.happened_at : new Date().toISOString(),
      }
      if (typeof payload.next_step === 'string' && payload.next_step) opportunityPatch.next_action = payload.next_step
      if (typeof payload.next_due_at === 'string' && payload.next_due_at) opportunityPatch.next_followup_at = payload.next_due_at

      const { data: opportunity, error: opportunityError } = await supabase
        .from('crm_opportunities')
        .update(opportunityPatch)
        .eq('id', payload.opportunity_id)
        .select('*')
        .single()
      if (opportunityError) throw opportunityError

      return NextResponse.json({ ...data, opportunity })
    }

    if (action === 'set-next-step') {
      const fields = asRecord(body.fields)
      if (!fields) return bad('fields required')
      const payload = pick(fields, ['opportunity_id', 'next_action', 'next_followup_at', 'owner_user_id'])
      if (typeof payload.opportunity_id !== 'string') return bad('opportunity_id required')
      const patch = pick(payload, ['next_action', 'next_followup_at', 'owner_user_id'])
      if (!Object.keys(patch).length) return bad('nothing to update')
      const { data, error } = await supabase.from('crm_opportunities').update(patch).eq('id', payload.opportunity_id).select('*').single()
      if (error) throw error
      return NextResponse.json(data)
    }

    if (action === 'ingest-document') {
      const fields = asRecord(body.fields)
      if (!fields) return bad('fields required')
      ensureEnum(fields.source_system, CRM_SOURCE_SYSTEMS, 'source_system')
      ensureEnum(fields.document_type ?? 'note', CRM_SOURCE_DOCUMENT_TYPES, 'document_type')
      const payload = pick(fields, ['job_id', 'source_system', 'url', 'title', 'document_type', 'fetched_at', 'raw_text', 'metadata', 'content_hash', 'parse_status'])
      if (typeof payload.source_system !== 'string') return bad('source_system required')
      if (typeof payload.raw_text !== 'string' || !payload.raw_text) return bad('raw_text required')
      if (!payload.content_hash) {
        payload.content_hash = createHash('sha256')
          .update(`${payload.source_system}:${payload.url ?? ''}:${payload.raw_text}`)
          .digest('hex')
      }
      // crm_source_documents_hash_idx is a partial unique index (where content_hash is not null),
      // which ON CONFLICT cannot target, so dedupe with an explicit lookup
      const { data: existing, error: existingError } = await supabase
        .from('crm_source_documents')
        .select('id')
        .eq('content_hash', payload.content_hash)
        .maybeSingle()
      if (existingError) throw existingError

      if (existing) {
        const { data, error } = await supabase.from('crm_source_documents').update(payload).eq('id', existing.id).select('*').single()
        if (error) throw error
        return NextResponse.json(data)
      }

      const { data, error } = await supabase.from('crm_source_documents').insert(payload).select('*').single()
      if (error) throw error
      return NextResponse.json(data)
    }

    if (action === 'upsert-source-link') {
      const fields = asRecord(body.fields)
      if (!fields) return bad('fields required')
      ensureEnum(fields.entity_type, CRM_ENTITY_TYPES, 'entity_type')
      ensureEnum(fields.source_system, CRM_SOURCE_SYSTEMS, 'source_system')
      const payload = pick(fields, ['id', 'entity_type', 'entity_id', 'source_system', 'source_ref', 'source_url', 'metadata', 'last_synced_at'])
      if (typeof payload.entity_type !== 'string' || typeof payload.entity_id !== 'string' || typeof payload.source_system !== 'string') return bad('entity_type, entity_id, source_system required')
      const { data, error } = await supabase.from('crm_source_links').upsert(payload).select('*').single()
      if (error) throw error
      return NextResponse.json(data)
    }

    return bad('Unsupported action', 404)
  } catch (error) {
    console.error('[crm api]', error)
    const message = error instanceof Error ? error.message : 'CRM API failure'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
