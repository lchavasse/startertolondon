import { createClient } from '@supabase/supabase-js'
import {
  CrmChaseItem,
  CrmChaseReason,
  CrmContactPoint,
  CrmCountSummary,
  CrmDashboardData,
  CrmDashboardSummary,
  CrmInboundSummary,
  CrmInteraction,
  CrmOpportunity,
  CrmOpportunityDetail,
  CrmOpportunityOrganisation,
  CrmOpportunityPerson,
  CrmOpportunityView,
  CrmOrganisation,
  CrmOrganisationDetail,
  CrmOutreachEntry,
  CrmPerson,
  CrmPersonDetail,
  CrmPersonOrganisation,
  CrmSearchResult,
  CrmSourceLink,
  CrmTask,
  CrmTaskView,
  CrmUser,
} from './types'
import { CrmContact, CrmContactEvent } from './contacts'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing env var: ${name}`)
  return value
}

export function getCrmServiceClient() {
  return createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'))
}

function startOfTodayIso() {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return now.toISOString()
}

function endOfTodayIso() {
  const now = new Date()
  now.setHours(23, 59, 59, 999)
  return now.toISOString()
}

function isPast(value: string | null | undefined) {
  return Boolean(value && new Date(value).getTime() < Date.now())
}

async function loadOwners(supabase: ReturnType<typeof getCrmServiceClient>) {
  const { data, error } = await supabase.from('crm_users').select('*').order('name')
  if (error) throw error
  const owners = (data ?? []) as CrmUser[]
  return new Map(owners.map((owner) => [owner.id, owner.name]))
}

async function loadOpportunityViews(supabase: ReturnType<typeof getCrmServiceClient>) {
  const [{ data: opportunities, error: opportunitiesError }, { data: oppPeople, error: oppPeopleError }, { data: oppOrgs, error: oppOrgsError }, { data: people, error: peopleError }, { data: organisations, error: organisationsError }] = await Promise.all([
    supabase.from('crm_opportunities').select('*').order('priority', { ascending: true }).order('next_followup_at', { ascending: true, nullsFirst: false }),
    supabase.from('crm_opportunity_people').select('*'),
    supabase.from('crm_opportunity_organisations').select('*'),
    supabase.from('crm_people').select('id, full_name'),
    supabase.from('crm_organisations').select('id, name'),
  ])

  if (opportunitiesError) throw opportunitiesError
  if (oppPeopleError) throw oppPeopleError
  if (oppOrgsError) throw oppOrgsError
  if (peopleError) throw peopleError
  if (organisationsError) throw organisationsError

  const ownerMap = await loadOwners(supabase)
  const peopleMap = new Map(((people ?? []) as Pick<CrmPerson, 'id' | 'full_name'>[]).map((person) => [person.id, person.full_name]))
  const orgMap = new Map(((organisations ?? []) as Pick<CrmOrganisation, 'id' | 'name'>[]).map((org) => [org.id, org.name]))

  const oppPeopleByOpportunity = new Map<string, CrmOpportunityPerson[]>()
  for (const row of (oppPeople ?? []) as CrmOpportunityPerson[]) {
    const items = oppPeopleByOpportunity.get(row.opportunity_id) ?? []
    items.push(row)
    oppPeopleByOpportunity.set(row.opportunity_id, items)
  }

  const oppOrgsByOpportunity = new Map<string, CrmOpportunityOrganisation[]>()
  for (const row of (oppOrgs ?? []) as CrmOpportunityOrganisation[]) {
    const items = oppOrgsByOpportunity.get(row.opportunity_id) ?? []
    items.push(row)
    oppOrgsByOpportunity.set(row.opportunity_id, items)
  }

  return ((opportunities ?? []) as CrmOpportunity[]).map((opportunity) => ({
    ...opportunity,
    owner_name: opportunity.owner_user_id ? ownerMap.get(opportunity.owner_user_id) ?? null : null,
    people: (oppPeopleByOpportunity.get(opportunity.id) ?? []).map((row) => ({
      id: row.person_id,
      full_name: peopleMap.get(row.person_id) ?? 'Unknown person',
      role_label: row.role_label,
    })),
    organisations: (oppOrgsByOpportunity.get(opportunity.id) ?? []).map((row) => ({
      id: row.organisation_id,
      name: orgMap.get(row.organisation_id) ?? 'Unknown organisation',
      role_label: row.role_label,
    })),
  }))
}

async function loadTaskViews(supabase: ReturnType<typeof getCrmServiceClient>) {
  const [{ data: tasks, error: tasksError }, { data: opportunities, error: opportunitiesError }, { data: people, error: peopleError }, { data: organisations, error: organisationsError }] = await Promise.all([
    supabase.from('crm_tasks').select('*').order('priority', { ascending: true }).order('due_at', { ascending: true, nullsFirst: false }),
    supabase.from('crm_opportunities').select('id, title'),
    supabase.from('crm_people').select('id, full_name'),
    supabase.from('crm_organisations').select('id, name'),
  ])

  if (tasksError) throw tasksError
  if (opportunitiesError) throw opportunitiesError
  if (peopleError) throw peopleError
  if (organisationsError) throw organisationsError

  const ownerMap = await loadOwners(supabase)
  const opportunityMap = new Map(((opportunities ?? []) as Pick<CrmOpportunity, 'id' | 'title'>[]).map((opportunity) => [opportunity.id, opportunity.title]))
  const personMap = new Map(((people ?? []) as Pick<CrmPerson, 'id' | 'full_name'>[]).map((person) => [person.id, person.full_name]))
  const organisationMap = new Map(((organisations ?? []) as Pick<CrmOrganisation, 'id' | 'name'>[]).map((organisation) => [organisation.id, organisation.name]))

  return ((tasks ?? []) as CrmTask[]).map((task) => ({
    ...task,
    owner_name: task.owner_user_id ? ownerMap.get(task.owner_user_id) ?? null : null,
    linked_opportunity_title: task.linked_opportunity_id ? opportunityMap.get(task.linked_opportunity_id) ?? null : null,
    linked_person_name: task.linked_person_id ? personMap.get(task.linked_person_id) ?? null : null,
    linked_organisation_name: task.linked_organisation_id ? organisationMap.get(task.linked_organisation_id) ?? null : null,
  }))
}

async function loadAllContactPoints(supabase: ReturnType<typeof getCrmServiceClient>) {
  const { data, error } = await supabase.from('crm_contact_points').select('*').order('is_primary', { ascending: false })
  if (error) throw error
  const byEntity = new Map<string, CrmContactPoint[]>()
  for (const row of (data ?? []) as CrmContactPoint[]) {
    const key = `${row.entity_type}:${row.entity_id}`
    const items = byEntity.get(key) ?? []
    items.push(row)
    byEntity.set(key, items)
  }
  return byEntity
}

function opportunityContactPoints(opportunity: CrmOpportunityView, byEntity: Map<string, CrmContactPoint[]>) {
  return [
    ...opportunity.people.flatMap((person) => byEntity.get(`person:${person.id}`) ?? []),
    ...opportunity.organisations.flatMap((organisation) => byEntity.get(`organisation:${organisation.id}`) ?? []),
  ]
}

function daysBetween(from: string | null | undefined, to: number) {
  if (!from) return null
  return Math.floor((to - new Date(from).getTime()) / 86_400_000)
}

export async function fetchCrmDashboardData(): Promise<CrmDashboardData> {
  const supabase = getCrmServiceClient()
  const [opportunities, tasks, interactions, inbound, people, counts, contactPointsByEntity] = await Promise.all([
    loadOpportunityViews(supabase),
    loadTaskViews(supabase),
    fetchCrmInteractions({ limit: 12 }),
    fetchCrmInboundSummary(),
    fetchCrmPeople(),
    fetchCrmCounts(),
    loadAllContactPoints(supabase),
  ])

  const overdueOpportunities = opportunities.filter((opportunity) => isPast(opportunity.next_followup_at) && opportunity.status === 'active')
  const overdueTasks = tasks.filter((task) => task.status !== 'done' && task.status !== 'cancelled' && isPast(task.due_at))
  const dueTodayTasks = tasks.filter((task) => {
    if (!task.due_at || task.status === 'done' || task.status === 'cancelled') return false
    const due = new Date(task.due_at).getTime()
    return due >= new Date(startOfTodayIso()).getTime() && due <= new Date(endOfTodayIso()).getTime()
  })
  const staleActiveOpportunities = opportunities.filter((opportunity) => opportunity.status === 'active' && !opportunity.next_action)
  const noContactRouteOpportunities = opportunities.filter(
    (opportunity) => opportunity.status === 'active' && opportunityContactPoints(opportunity, contactPointsByEntity).length === 0,
  )

  const summary: CrmDashboardSummary = {
    opportunityCount: opportunities.length,
    activeOpportunityCount: opportunities.filter((opportunity) => opportunity.status === 'active').length,
    overdueOpportunityCount: overdueOpportunities.length,
    taskCount: tasks.length,
    overdueTaskCount: overdueTasks.length,
    dueTodayTaskCount: dueTodayTasks.length,
    peopleNeedingFollowupCount: people.filter((person) => isPast(person.next_followup_at)).length,
    organisationCount: counts.organisations,
    interactionCount: counts.interactions,
  }

  return {
    summary,
    overdueOpportunities,
    overdueTasks,
    dueTodayTasks,
    staleActiveOpportunities,
    noContactRouteOpportunities,
    recentInteractions: interactions,
    inbound,
  }
}

export async function fetchCrmChaseQueue(options: { limit?: number } = {}): Promise<CrmChaseItem[]> {
  const supabase = getCrmServiceClient()
  const [opportunities, contactPointsByEntity, outreach] = await Promise.all([
    loadOpportunityViews(supabase),
    loadAllContactPoints(supabase),
    supabase.from('crm_outreach_entries').select('*').order('happened_at', { ascending: false }),
  ])

  if (outreach.error) throw outreach.error

  const latestOutreachByOpportunity = new Map<string, CrmOutreachEntry>()
  for (const entry of (outreach.data ?? []) as CrmOutreachEntry[]) {
    if (!latestOutreachByOpportunity.has(entry.opportunity_id)) latestOutreachByOpportunity.set(entry.opportunity_id, entry)
  }

  const now = Date.now()

  const items = opportunities
    .filter((opportunity) => opportunity.status === 'active')
    .map((opportunity) => {
      const contactPoints = opportunityContactPoints(opportunity, contactPointsByEntity)
      const latestOutreach = latestOutreachByOpportunity.get(opportunity.id) ?? null
      const daysOverdue = isPast(opportunity.next_followup_at) ? daysBetween(opportunity.next_followup_at, now) : null
      const daysSinceActivity = daysBetween(opportunity.last_activity_at ?? latestOutreach?.happened_at ?? null, now)

      const reasons: CrmChaseReason[] = []
      let score = 0

      if (daysOverdue != null) {
        reasons.push('overdue_followup')
        score += 1000 + Math.min(daysOverdue, 365)
      }
      if (!opportunity.next_action) {
        reasons.push('no_next_action')
        score += 500
      }
      if (!opportunity.owner_user_id) {
        reasons.push('no_owner')
        score += 250
      }
      if (contactPoints.length === 0) {
        reasons.push('no_contact_route')
        score += 100
      }
      if (daysSinceActivity != null && daysSinceActivity > 7) {
        reasons.push('stale')
        score += Math.min(daysSinceActivity, 365)
      }

      return { opportunity, reasons, score, daysOverdue, daysSinceActivity, contactPoints, latestOutreach }
    })
    .filter((item) => item.reasons.length > 0)
    .sort((a, b) => b.score - a.score || a.opportunity.title.localeCompare(b.opportunity.title))

  return items.slice(0, options.limit ?? 50)
}

export async function searchCrm(query: string, options: { limit?: number } = {}): Promise<CrmSearchResult[]> {
  const term = query.trim()
  if (!term) return []
  const supabase = getCrmServiceClient()
  const pattern = `%${term}%`
  const limit = options.limit ?? 20

  const [opportunities, organisations, people] = await Promise.all([
    supabase.from('crm_opportunities').select('id, title, workstream, status').ilike('title', pattern).limit(limit),
    supabase.from('crm_organisations').select('id, name, org_type, website').ilike('name', pattern).limit(limit),
    supabase.from('crm_people').select('id, full_name, title').ilike('full_name', pattern).limit(limit),
  ])

  for (const result of [opportunities, organisations, people]) {
    if (result.error) throw result.error
  }

  return [
    ...((opportunities.data ?? []) as Array<{ id: string; title: string; workstream: string; status: string }>).map((row) => ({
      type: 'opportunity' as const,
      id: row.id,
      label: row.title,
      detail: `${row.workstream} · ${row.status}`,
    })),
    ...((organisations.data ?? []) as Array<{ id: string; name: string; org_type: string | null; website: string | null }>).map((row) => ({
      type: 'organisation' as const,
      id: row.id,
      label: row.name,
      detail: [row.org_type, row.website].filter(Boolean).join(' · ') || null,
    })),
    ...((people.data ?? []) as Array<{ id: string; full_name: string; title: string | null }>).map((row) => ({
      type: 'person' as const,
      id: row.id,
      label: row.full_name,
      detail: row.title,
    })),
  ].slice(0, limit)
}

export async function fetchCrmOpportunities(): Promise<CrmOpportunityView[]> {
  return loadOpportunityViews(getCrmServiceClient())
}

export async function fetchCrmTasks(): Promise<CrmTaskView[]> {
  return loadTaskViews(getCrmServiceClient())
}

export async function fetchCrmPeople(): Promise<CrmPerson[]> {
  const supabase = getCrmServiceClient()
  const { data, error } = await supabase.from('crm_people').select('*').order('next_followup_at', { ascending: true, nullsFirst: false }).order('full_name')
  if (error) throw error
  return (data ?? []) as CrmPerson[]
}

export async function fetchCrmOrganisations(): Promise<CrmOrganisation[]> {
  const supabase = getCrmServiceClient()
  const { data, error } = await supabase.from('crm_organisations').select('*').order('name')
  if (error) throw error
  return (data ?? []) as CrmOrganisation[]
}

export async function fetchCrmInteractions(options: { limit?: number } = {}): Promise<CrmInteraction[]> {
  const supabase = getCrmServiceClient()
  const { data, error } = await supabase.from('crm_interactions').select('*').order('happened_at', { ascending: false }).limit(options.limit ?? 25)
  if (error) throw error
  return (data ?? []) as CrmInteraction[]
}

export async function fetchCrmCounts(): Promise<CrmCountSummary> {
  const supabase = getCrmServiceClient()
  const [
    organisations,
    people,
    opportunities,
    tasks,
    interactions,
    sourceLinks,
  ] = await Promise.all([
    supabase.from('crm_organisations').select('*', { head: true, count: 'exact' }),
    supabase.from('crm_people').select('*', { head: true, count: 'exact' }),
    supabase.from('crm_opportunities').select('*', { head: true, count: 'exact' }),
    supabase.from('crm_tasks').select('*', { head: true, count: 'exact' }),
    supabase.from('crm_interactions').select('*', { head: true, count: 'exact' }),
    supabase.from('crm_source_links').select('*', { head: true, count: 'exact' }),
  ])

  for (const result of [organisations, people, opportunities, tasks, interactions, sourceLinks]) {
    if (result.error) throw result.error
  }

  return {
    organisations: organisations.count ?? 0,
    people: people.count ?? 0,
    opportunities: opportunities.count ?? 0,
    tasks: tasks.count ?? 0,
    interactions: interactions.count ?? 0,
    sourceLinks: sourceLinks.count ?? 0,
  }
}

export async function fetchCrmSourceLinks(entityType?: string, entityId?: string): Promise<CrmSourceLink[]> {
  const supabase = getCrmServiceClient()
  let query = supabase.from('crm_source_links').select('*').order('created_at', { ascending: false })
  if (entityType) query = query.eq('entity_type', entityType)
  if (entityId) query = query.eq('entity_id', entityId)
  const { data, error } = await query
  if (error) throw error
  return ((data ?? []) as CrmSourceLink[]).map((row) => ({ ...row, metadata: (row.metadata ?? {}) as Record<string, unknown> }))
}

export async function fetchCrmContactPoints(entityRefs: Array<{ entity_type: 'person' | 'organisation'; entity_id: string }>): Promise<CrmContactPoint[]> {
  if (!entityRefs.length) return []
  const supabase = getCrmServiceClient()
  const peopleIds = entityRefs.filter((ref) => ref.entity_type === 'person').map((ref) => ref.entity_id)
  const organisationIds = entityRefs.filter((ref) => ref.entity_type === 'organisation').map((ref) => ref.entity_id)

  const [peopleContacts, organisationContacts] = await Promise.all([
    peopleIds.length
      ? supabase.from('crm_contact_points').select('*').eq('entity_type', 'person').in('entity_id', peopleIds).order('is_primary', { ascending: false }).order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    organisationIds.length
      ? supabase.from('crm_contact_points').select('*').eq('entity_type', 'organisation').in('entity_id', organisationIds).order('is_primary', { ascending: false }).order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ])

  if (peopleContacts.error) throw peopleContacts.error
  if (organisationContacts.error) throw organisationContacts.error

  return [
    ...((peopleContacts.data ?? []) as CrmContactPoint[]),
    ...((organisationContacts.data ?? []) as CrmContactPoint[]),
  ]
}

export async function fetchCrmOpportunityDetail(id: string): Promise<CrmOpportunityDetail | null> {
  const supabase = getCrmServiceClient()
  const [opportunities, tasks, interactions, sourceLinks, outreachEntries] = await Promise.all([
    fetchCrmOpportunities(),
    fetchCrmTasks(),
    fetchCrmInteractions({ limit: 100 }),
    fetchCrmSourceLinks('opportunity', id),
    supabase.from('crm_outreach_entries').select('*').eq('opportunity_id', id).order('happened_at', { ascending: false }),
  ])

  if (outreachEntries.error) throw outreachEntries.error

  const opportunity = opportunities.find((item) => item.id === id)
  if (!opportunity) return null

  const contactPoints = await fetchCrmContactPoints([
    ...opportunity.people.map((person) => ({ entity_type: 'person' as const, entity_id: person.id })),
    ...opportunity.organisations.map((organisation) => ({ entity_type: 'organisation' as const, entity_id: organisation.id })),
  ])

  return {
    opportunity,
    owner_name: opportunity.owner_name,
    tasks: tasks.filter((task) => task.linked_opportunity_id === id),
    interactions: interactions.filter((interaction) => interaction.opportunity_id === id),
    sourceLinks,
    contactPoints,
    outreachEntries: (outreachEntries.data ?? []) as CrmOutreachEntry[],
  }
}

export async function fetchCrmPersonDetail(id: string): Promise<CrmPersonDetail | null> {
  const supabase = getCrmServiceClient()
  const [{ data: person, error: personError }, { data: links, error: linksError }, { data: relations, error: relationsError }, opportunities, tasks, interactions, sourceLinks, ownerMap, organisations] = await Promise.all([
    supabase.from('crm_people').select('*').eq('id', id).maybeSingle(),
    supabase.from('crm_opportunity_people').select('*').eq('person_id', id),
    supabase.from('crm_person_organisations').select('*').eq('person_id', id),
    fetchCrmOpportunities(),
    fetchCrmTasks(),
    fetchCrmInteractions({ limit: 50 }),
    fetchCrmSourceLinks('person', id),
    loadOwners(supabase),
    fetchCrmOrganisations(),
  ])

  if (personError) throw personError
  if (linksError) throw linksError
  if (relationsError) throw relationsError
  if (!person) return null

  const organisationMap = new Map(organisations.map((organisation) => [organisation.id, organisation]))

  return {
    person: person as CrmPerson,
    owner_name: person.owner_user_id ? ownerMap.get(person.owner_user_id) ?? null : null,
    organisations: ((relations ?? []) as CrmPersonOrganisation[])
      .map((relation) => {
        const organisation = organisationMap.get(relation.organisation_id)
        if (!organisation) return null
        return {
          organisation,
          role_label: relation.role_label,
          is_primary: relation.is_primary,
          notes: relation.notes,
        }
      })
      .filter((value): value is NonNullable<typeof value> => Boolean(value)),
    opportunities: opportunities.filter((opportunity) => ((links ?? []) as CrmOpportunityPerson[]).some((link) => link.opportunity_id === opportunity.id)),
    tasks: tasks.filter((task) => task.linked_person_id === id),
    interactions: interactions.filter((interaction) => interaction.person_id === id),
    sourceLinks,
  }
}

export async function fetchCrmOrganisationDetail(id: string): Promise<CrmOrganisationDetail | null> {
  const supabase = getCrmServiceClient()
  const [{ data: organisation, error: organisationError }, { data: links, error: linksError }, { data: relations, error: relationsError }, opportunities, tasks, interactions, sourceLinks, ownerMap, people] = await Promise.all([
    supabase.from('crm_organisations').select('*').eq('id', id).maybeSingle(),
    supabase.from('crm_opportunity_organisations').select('*').eq('organisation_id', id),
    supabase.from('crm_person_organisations').select('*').eq('organisation_id', id),
    fetchCrmOpportunities(),
    fetchCrmTasks(),
    fetchCrmInteractions({ limit: 50 }),
    fetchCrmSourceLinks('organisation', id),
    loadOwners(supabase),
    fetchCrmPeople(),
  ])

  if (organisationError) throw organisationError
  if (linksError) throw linksError
  if (relationsError) throw relationsError
  if (!organisation) return null

  const personMap = new Map(people.map((person) => [person.id, person]))

  return {
    organisation: organisation as CrmOrganisation,
    owner_name: organisation.owner_user_id ? ownerMap.get(organisation.owner_user_id) ?? null : null,
    people: ((relations ?? []) as CrmPersonOrganisation[])
      .map((relation) => {
        const person = personMap.get(relation.person_id)
        if (!person) return null
        return {
          person,
          role_label: relation.role_label,
          is_primary: relation.is_primary,
          notes: relation.notes,
        }
      })
      .filter((value): value is NonNullable<typeof value> => Boolean(value)),
    opportunities: opportunities.filter((opportunity) => ((links ?? []) as CrmOpportunityOrganisation[]).some((link) => link.opportunity_id === opportunity.id)),
    tasks: tasks.filter((task) => task.linked_organisation_id === id),
    interactions: interactions.filter((interaction) => interaction.organisation_id === id),
    sourceLinks,
  }
}

export async function fetchCrmInboundSummary(): Promise<CrmInboundSummary> {
  const supabase = getCrmServiceClient()
  const [{ count: applicationCount, error: applicationCountError }, { count: waitlistCount, error: waitlistCountError }, { data: latestApplication, error: latestApplicationError }, { data: latestWaitlist, error: latestWaitlistError }] = await Promise.all([
    supabase.from('applications').select('*', { head: true, count: 'exact' }),
    supabase.from('deeptech_waitlist').select('*', { head: true, count: 'exact' }),
    supabase.from('applications').select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('deeptech_waitlist').select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  if (applicationCountError) throw applicationCountError
  if (waitlistCountError) throw waitlistCountError
  if (latestApplicationError) throw latestApplicationError
  if (latestWaitlistError) throw latestWaitlistError

  return {
    applicationCount: applicationCount ?? 0,
    waitlistCount: waitlistCount ?? 0,
    latestApplicationAt: latestApplication?.created_at ?? null,
    latestWaitlistAt: latestWaitlist?.created_at ?? null,
  }
}

export async function fetchCrmContacts(filter: { source_system?: string; status?: string; label?: string } = {}): Promise<CrmContact[]> {
  const supabase = getCrmServiceClient()
  let query = supabase.from('crm_contacts').select('*')
  if (filter.source_system) query = query.eq('source_system', filter.source_system)
  if (filter.status) query = query.eq('status', filter.status)
  if (filter.label) query = query.contains('labels', [filter.label])
  const { data, error } = await query.order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as CrmContact[]
}

export async function fetchCrmContactEvents(contactIds: string[]): Promise<CrmContactEvent[]> {
  if (!contactIds.length) return []
  const supabase = getCrmServiceClient()
  const { data, error } = await supabase
    .from('crm_contact_events')
    .select('*')
    .in('contact_id', contactIds)
    .order('happened_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as CrmContactEvent[]
}

// The resurface queue. A contact parked for six months is only a reminder if something asks for it
// when the date arrives — this is that something, for both the dashboard and any agent or cron.
export async function fetchCrmContactsDue(options: { withinDays?: number; limit?: number } = {}): Promise<CrmContact[]> {
  const supabase = getCrmServiceClient()
  const horizon = new Date()
  horizon.setDate(horizon.getDate() + (options.withinDays ?? 0))
  const { data, error } = await supabase
    .from('crm_contacts')
    .select('*')
    .not('next_followup_at', 'is', null)
    .lte('next_followup_at', horizon.toISOString())
    .order('next_followup_at', { ascending: true })
    .limit(options.limit ?? 100)
  if (error) throw error
  return (data ?? []) as CrmContact[]
}
