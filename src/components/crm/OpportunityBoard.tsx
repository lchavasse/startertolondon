import Link from 'next/link'
import { format } from 'date-fns'
import { CrmOpportunityView } from '@/lib/crm/types'

function formatMaybe(value: string | null) {
  if (!value) return 'No follow-up date'
  return format(new Date(value), 'd MMM')
}

export function OpportunityBoard({ opportunities }: { opportunities: CrmOpportunityView[] }) {
  const grouped = opportunities.reduce<Record<string, CrmOpportunityView[]>>((acc, opportunity) => {
    const key = opportunity.status || 'unknown'
    acc[key] ??= []
    acc[key].push(opportunity)
    return acc
  }, {})

  const orderedStatuses = ['active', 'won', 'paused', 'lost']
  const statuses = Array.from(new Set([...orderedStatuses, ...Object.keys(grouped)])).filter((key) => grouped[key]?.length)

  return (
    <div className="grid gap-4 xl:grid-cols-4">
      {statuses.map((status) => (
        <section key={status} className="terminal-panel p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-[var(--accent-bright)]">{status}</h2>
            <span className="font-mono text-[10px] text-[var(--muted)]">{grouped[status].length}</span>
          </div>
          <div className="space-y-3">
            {grouped[status].map((opportunity) => (
              <article key={opportunity.id} className="border border-[var(--line)] bg-[rgba(9,13,14,0.5)] p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#f0ede6]">{opportunity.title}</p>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
                      {opportunity.workstream} · {opportunity.priority}
                    </p>
                  </div>
                  <Link href={`/crm/opportunities/${opportunity.id}`} className="font-mono text-[10px] uppercase tracking-widest text-[var(--accent-yellow)]">
                    open
                  </Link>
                </div>
                {opportunity.next_action ? <p className="text-sm text-[var(--muted-strong)]">{opportunity.next_action}</p> : null}
                <div className="space-y-1 text-xs text-[var(--muted-strong)]">
                  <p>Owner: {opportunity.owner_name ?? 'Unassigned'}</p>
                  <p>Follow-up: {formatMaybe(opportunity.next_followup_at)}</p>
                  {opportunity.people.length ? <p>People: {opportunity.people.map((person) => person.full_name).join(', ')}</p> : null}
                  {opportunity.organisations.length ? <p>Orgs: {opportunity.organisations.map((organisation) => organisation.name).join(', ')}</p> : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
