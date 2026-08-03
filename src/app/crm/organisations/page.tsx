import { CrmShell } from '@/components/crm/CrmShell'
import { EntityList } from '@/components/crm/EntityList'
import { fetchCrmOrganisations } from '@/lib/crm/server'

export const dynamic = 'force-dynamic'

export default async function CrmOrganisationsPage() {
  const organisations = await fetchCrmOrganisations()

  return (
    <CrmShell
      title="Organisations"
      subtitle="Funds, sponsors, startups, communities, media, venues, and any other institution causing paperwork."
    >
      <EntityList
        title="Organisations"
        empty="No organisations imported yet."
        items={organisations.map((organisation) => ({
          id: organisation.id,
          title: organisation.name,
          subtitle: organisation.relationship_summary || organisation.website,
          meta: organisation.org_type,
          href: `/crm/organisations/${organisation.id}`,
        }))}
      />
    </CrmShell>
  )
}
