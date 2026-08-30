import { CrmDashboardSummary } from '@/lib/crm/types'

const cards: Array<{ key: keyof CrmDashboardSummary; label: string }> = [
  { key: 'activeOpportunityCount', label: 'Active opportunities' },
  { key: 'overdueOpportunityCount', label: 'Overdue follow-ups' },
  { key: 'taskCount', label: 'Open tasks' },
  { key: 'overdueTaskCount', label: 'Overdue tasks' },
  { key: 'dueTodayTaskCount', label: 'Due today' },
  { key: 'peopleNeedingFollowupCount', label: 'People to chase' },
  { key: 'organisationCount', label: 'Organisations tracked' },
  { key: 'interactionCount', label: 'Recent interactions loaded' },
]

export function TodayCards({ summary }: { summary: CrmDashboardSummary }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div key={card.key} className="terminal-panel space-y-2 p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">{card.label}</p>
          <p className="text-3xl font-bold text-[#f0ede6]">{summary[card.key]}</p>
        </div>
      ))}
    </div>
  )
}
