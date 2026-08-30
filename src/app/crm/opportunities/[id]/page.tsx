import { notFound } from 'next/navigation'
import { CrmShell } from '@/components/crm/CrmShell'
import { OpportunityWorkbench } from '@/components/crm/OpportunityWorkbench'
import { fetchCrmOpportunityDetail } from '@/lib/crm/server'

export const dynamic = 'force-dynamic'

export default async function CrmOpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const detail = await fetchCrmOpportunityDetail(id)
  if (!detail) notFound()

  return (
    <CrmShell
      title={detail.opportunity.title}
      subtitle={detail.opportunity.summary ?? detail.opportunity.value_notes ?? 'Opportunity workbench'}
    >
      <OpportunityWorkbench detail={detail} />
    </CrmShell>
  )
}
