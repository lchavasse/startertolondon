import { CrmShell } from '@/components/crm/CrmShell'
import { TodayCards } from '@/components/crm/TodayCards'
import { UrgentList } from '@/components/crm/UrgentList'
import { InboundSummary } from '@/components/crm/InboundSummary'
import { fetchCrmContactsDue, fetchCrmDashboardData } from '@/lib/crm/server'

export const dynamic = 'force-dynamic'

export default async function CrmHomePage() {
  const [data, dueContacts] = await Promise.all([fetchCrmDashboardData(), fetchCrmContactsDue()])

  return (
    <CrmShell
      title="CRM"
      subtitle="Manual-first outreach ops for sponsors, speakers, expo, partners, topics, and week-level admin. The point is not elegance. The point is not dropping the ball."
    >
      <TodayCards summary={data.summary} />
      <div className="grid gap-4 xl:grid-cols-2">
        <UrgentList
          title="Due to resurface"
          empty="Nobody parked for later has come round yet."
          items={dueContacts.map((contact) => ({
            id: contact.id,
            title: [contact.full_name, contact.role, contact.company].filter(Boolean).join(' · '),
            meta: [
              contact.next_followup_at ? `due ${contact.next_followup_at.slice(0, 10)}` : null,
              contact.labels.length ? contact.labels.join(', ') : null,
              contact.note,
            ].filter(Boolean).join(' · '),
            href: contact.source_system === 'expo_application' ? '/crm/expo' : null,
          }))}
        />
        <UrgentList
          title="Overdue follow-ups"
          empty="No overdue opportunity follow-ups. Miracles continue."
          items={data.overdueOpportunities.map((opportunity) => ({
            id: opportunity.id,
            title: opportunity.title,
            meta: `${opportunity.workstream} · ${opportunity.owner_name ?? 'Unassigned'} · ${opportunity.next_action ?? 'No next action'}`,
            href: `/crm/opportunities/${opportunity.id}`,
          }))}
        />
        <UrgentList
          title="Overdue tasks"
          empty="No overdue tasks. Either progress or very inventive denial."
          items={data.overdueTasks.map((task) => ({
            id: task.id,
            title: task.title,
            meta: `${task.owner_name ?? 'Unassigned'} · ${task.priority} · ${task.status}`,
            href: '/crm/tasks',
          }))}
        />
        <UrgentList
          title="Due today"
          empty="Nothing due today. Suspicious, frankly."
          items={data.dueTodayTasks.map((task) => ({
            id: task.id,
            title: task.title,
            meta: `${task.owner_name ?? 'Unassigned'} · ${task.priority}`,
            href: '/crm/tasks',
          }))}
        />
        <UrgentList
          title="Needs next action"
          empty="Every active opportunity has a next action. That almost never happens."
          items={data.staleActiveOpportunities.map((opportunity) => ({
            id: opportunity.id,
            title: opportunity.title,
            meta: `${opportunity.workstream} · ${opportunity.owner_name ?? 'Unassigned'}`,
            href: `/crm/opportunities/${opportunity.id}`,
          }))}
        />
        <UrgentList
          title="No contact route"
          empty="Every active opportunity has a contact point. Unlikely, but welcome."
          items={data.noContactRouteOpportunities.map((opportunity) => ({
            id: opportunity.id,
            title: opportunity.title,
            meta: `${opportunity.workstream} · ${opportunity.organisations[0]?.name ?? 'No linked org'}`,
            href: `/crm/opportunities/${opportunity.id}`,
          }))}
        />
      </div>
      <InboundSummary inbound={data.inbound} />
      <UrgentList
        title="Recent interactions"
        empty="No CRM interactions yet."
        items={data.recentInteractions.map((interaction) => ({
          id: interaction.id,
          title: interaction.summary,
          meta: `${interaction.interaction_type} · ${interaction.direction}`,
          href: null,
        }))}
      />
    </CrmShell>
  )
}
