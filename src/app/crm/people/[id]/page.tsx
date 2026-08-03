import { notFound } from 'next/navigation'
import { CrmShell } from '@/components/crm/CrmShell'
import { EntityDetail } from '@/components/crm/EntityDetail'
import { fetchCrmPersonDetail } from '@/lib/crm/server'

export const dynamic = 'force-dynamic'

export default async function CrmPersonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const detail = await fetchCrmPersonDetail(id)
  if (!detail) notFound()

  return (
    <CrmShell title={detail.person.full_name} subtitle={detail.person.relationship_summary ?? 'Person record'}>
      <EntityDetail
        title={detail.person.full_name}
        subtitle={detail.organisations.map((item) => item.organisation.name).join(' · ') || detail.person.title}
        details={[
          { label: 'Owner', value: detail.owner_name },
          { label: 'Title', value: detail.person.title },
          { label: 'Email', value: detail.person.primary_email },
          { label: 'Phone', value: detail.person.primary_phone },
          { label: 'LinkedIn', value: detail.person.linkedin_url },
          { label: 'Location', value: detail.person.location },
          { label: 'Last contacted', value: detail.person.last_contacted_at },
          { label: 'Next follow-up', value: detail.person.next_followup_at },
          { label: 'Summary', value: detail.person.relationship_summary },
          { label: 'Notes', value: detail.person.notes_freeform },
        ]}
        opportunities={detail.opportunities}
        tasks={detail.tasks}
        interactions={detail.interactions}
        sourceLinks={detail.sourceLinks}
      />
    </CrmShell>
  )
}
