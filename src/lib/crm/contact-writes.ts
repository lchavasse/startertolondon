import type { SupabaseClient } from '@supabase/supabase-js'
import { normaliseLinkedInUrl } from './contacts'

// Server-only. The coupling rules live here rather than in the route so the CLI path and the web
// path cannot drift: a status move always leaves a timeline entry, and real contact always moves
// last_contacted_at. Both of those were learned the hard way — crm_outreach_entries sat empty for
// three weeks because logging outreach and updating the parent were two things you could forget
// to do separately.

export interface ContactFields {
  id?: string
  full_name: string
  company?: string | null
  role?: string | null
  email?: string | null
  phone?: string | null
  linkedin_url?: string | null
  source_system: string
  source_ref?: string | null
  status?: string
  labels?: string[]
  note?: string | null
  owner?: string | null
  last_contacted_at?: string | null
  next_followup_at?: string | null
  enrichment?: Record<string, unknown>
  enriched_at?: string | null
}

export interface ContactEventFields {
  contact_id: string
  happened_at?: string
  kind?: string
  body: string
  author?: string | null
}

const CONTACT_KINDS_THAT_ARE_CONTACT = ['outreach', 'reply', 'meeting']

// A person can arrive as a pasted URL, a pool row and a hand-typed name in the same week. Resolve
// against every identity we hold before deciding this is someone new, most reliable key first.
export async function resolveContactId(
  supabase: SupabaseClient,
  probe: { id?: string | null; source_system?: string | null; source_ref?: string | null; linkedin_url?: string | null; email?: string | null; full_name?: string | null; company?: string | null },
): Promise<string | null> {
  if (probe.id) return probe.id

  if (probe.source_system && probe.source_ref) {
    const { data } = await supabase.from('crm_contacts').select('id').eq('source_system', probe.source_system).eq('source_ref', probe.source_ref).maybeSingle()
    if (data?.id) return data.id
  }

  const linkedin = normaliseLinkedInUrl(probe.linkedin_url ?? null)
  if (linkedin) {
    const { data } = await supabase.from('crm_contacts').select('id').eq('linkedin_url', linkedin).maybeSingle()
    if (data?.id) return data.id
  }

  if (probe.email) {
    const { data } = await supabase.from('crm_contacts').select('id').ilike('email', probe.email).limit(1)
    if (data?.[0]?.id) return data[0].id
  }

  // Name plus company, case-insensitive. Name alone is not enough — two people called James is a
  // certainty at this scale, and silently merging them is worse than a duplicate row.
  if (probe.full_name && probe.company) {
    const { data } = await supabase.from('crm_contacts').select('id').ilike('full_name', probe.full_name).ilike('company', probe.company).limit(1)
    if (data?.[0]?.id) return data[0].id
  }

  return null
}

export async function upsertContact(
  supabase: SupabaseClient,
  fields: ContactFields,
): Promise<{ contact: Record<string, unknown>; created: boolean }> {
  const payload: Record<string, unknown> = { ...fields }
  if ('linkedin_url' in payload) payload.linkedin_url = normaliseLinkedInUrl(payload.linkedin_url as string | null)

  const existingId = await resolveContactId(supabase, {
    id: fields.id,
    source_system: fields.source_system,
    source_ref: fields.source_ref,
    linkedin_url: fields.linkedin_url,
    email: fields.email,
    full_name: fields.full_name,
    company: fields.company,
  })

  let previousStatus: string | null = null
  if (existingId) {
    const { data } = await supabase.from('crm_contacts').select('status').eq('id', existingId).maybeSingle()
    previousStatus = data?.status ?? null
    // Identity resolved by linkedin/email/name — do not let a stale id in the payload override it.
    delete payload.id
  }

  const { data, error } = existingId
    ? await supabase.from('crm_contacts').update(payload).eq('id', existingId).select('*').single()
    : await supabase.from('crm_contacts').insert(payload).select('*').single()
  if (error) throw error

  if (previousStatus && typeof payload.status === 'string' && payload.status !== previousStatus) {
    const { error: eventError } = await supabase.from('crm_contact_events').insert({
      contact_id: data.id,
      kind: 'status_change',
      body: `${previousStatus} → ${payload.status}`,
      author: typeof payload.owner === 'string' ? payload.owner : null,
    })
    if (eventError) throw eventError
  }

  return { contact: data, created: !existingId }
}

export async function addContactEvent(supabase: SupabaseClient, fields: ContactEventFields) {
  const { data, error } = await supabase.from('crm_contact_events').insert(fields).select('*').single()
  if (error) throw error

  if (CONTACT_KINDS_THAT_ARE_CONTACT.includes(fields.kind ?? 'note')) {
    const { error: touchError } = await supabase
      .from('crm_contacts')
      .update({ last_contacted_at: fields.happened_at ?? new Date().toISOString() })
      .eq('id', fields.contact_id)
    if (touchError) throw touchError
  }

  return data
}
