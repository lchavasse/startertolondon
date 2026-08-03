import { CrmShell } from '@/components/crm/CrmShell'
import { OpportunityBoard } from '@/components/crm/OpportunityBoard'
import { fetchCrmOpportunities } from '@/lib/crm/server'

export const dynamic = 'force-dynamic'

export default async function CrmOpportunitiesPage() {
  const opportunities = await fetchCrmOpportunities()

  return (
    <CrmShell
      title="Opportunities"
      subtitle="One place for sponsors, speakers, expo, partners, topics, and assorted week-level chaos."
    >
      <OpportunityBoard opportunities={opportunities} />
    </CrmShell>
  )
}
