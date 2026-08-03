import { notFound } from 'next/navigation'
import { CrmShell } from '@/components/crm/CrmShell'
import { EntityDetail } from '@/components/crm/EntityDetail'
import { fetchCrmOrganisationDetail } from '@/lib/crm/server'

export const dynamic = 'force-dynamic'

export default async function CrmOrganisationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const detail = await fetchCrmOrganisationDetail(id)
  if (!detail) notFound()

  return (
    <CrmShell title={detail.organisation.name} subtitle={detail.organisation.relationship_summary ?? detail.organisation.org_type}>
      <EntityDetail
        title={detail.organisation.name}
        subtitle={detail.people.map((item) => item.person.full_name).join(' · ') || detail.organisation.org_type}
        details={[
          { label: 'Owner', value: detail.owner_name },
          { label: 'Type', value: detail.organisation.org_type },
          { label: 'Website', value: detail.organisation.website },
          { label: 'LinkedIn', value: detail.organisation.linkedin_url },
          { label: 'Summary', value: detail.organisation.relationship_summary },
          { label: 'Notes', value: detail.organisation.notes_freeform },
        ]}
        opportunities={detail.opportunities}
        tasks={detail.tasks}
        interactions={detail.interactions}
        sourceLinks={detail.sourceLinks}
      />
    </CrmShell>
  )
}
