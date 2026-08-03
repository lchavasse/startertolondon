import { format } from 'date-fns'
import { CrmInteraction, CrmOpportunityView, CrmSourceLink, CrmTaskView } from '@/lib/crm/types'

function formatMaybe(value: string | null) {
  if (!value) return '—'
  return format(new Date(value), 'd MMM yyyy, HH:mm')
}

function detailList(items: Array<{ label: string; value?: string | null }>) {
  return (
    <dl className="grid gap-3 md:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="border border-[var(--line)] bg-[rgba(9,13,14,0.5)] p-3 space-y-1">
          <dt className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">{item.label}</dt>
          <dd className="text-sm text-[#f0ede6]">{item.value || '—'}</dd>
        </div>
      ))}
    </dl>
  )
}

function simpleOpportunityList(opportunities: CrmOpportunityView[]) {
  if (!opportunities.length) return <p className="text-sm text-[var(--muted)]">Nothing linked yet.</p>
  return (
    <ul className="space-y-3">
      {opportunities.map((opportunity) => (
        <li key={opportunity.id} className="border border-[var(--line)] bg-[rgba(9,13,14,0.5)] p-3">
          <p className="font-semibold text-[#f0ede6]">{opportunity.title}</p>
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
            {opportunity.workstream} · {opportunity.status} · {opportunity.priority}
          </p>
          {opportunity.next_action ? <p className="text-xs text-[var(--muted-strong)] mt-1">{opportunity.next_action}</p> : null}
        </li>
      ))}
    </ul>
  )
}

function simpleTaskList(tasks: CrmTaskView[]) {
  if (!tasks.length) return <p className="text-sm text-[var(--muted)]">No linked tasks.</p>
  return (
    <ul className="space-y-3">
      {tasks.map((task) => (
        <li key={task.id} className="border border-[var(--line)] bg-[rgba(9,13,14,0.5)] p-3">
          <p className="font-semibold text-[#f0ede6]">{task.title}</p>
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
            {task.status} · {task.priority} · due {task.due_at ? formatMaybe(task.due_at) : '—'}
          </p>
          {task.description ? <p className="text-xs text-[var(--muted-strong)] mt-1">{task.description}</p> : null}
        </li>
      ))}
    </ul>
  )
}

function interactionList(interactions: CrmInteraction[]) {
  if (!interactions.length) return <p className="text-sm text-[var(--muted)]">No interactions yet.</p>
  return (
    <ul className="space-y-3">
      {interactions.map((interaction) => (
        <li key={interaction.id} className="border border-[var(--line)] bg-[rgba(9,13,14,0.5)] p-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--accent-yellow)]">{interaction.interaction_type}</p>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">{interaction.direction}</p>
            <p className="text-xs text-[var(--muted-strong)]">{formatMaybe(interaction.happened_at)}</p>
          </div>
          <p className="mt-2 text-sm text-[#f0ede6]">{interaction.summary}</p>
          {interaction.raw_excerpt ? <p className="mt-1 text-xs text-[var(--muted-strong)]">{interaction.raw_excerpt}</p> : null}
        </li>
      ))}
    </ul>
  )
}

function sourceLinkList(sourceLinks: CrmSourceLink[]) {
  if (!sourceLinks.length) return <p className="text-sm text-[var(--muted)]">No source provenance attached yet.</p>
  return (
    <ul className="space-y-3">
      {sourceLinks.map((sourceLink) => (
        <li key={sourceLink.id} className="border border-[var(--line)] bg-[rgba(9,13,14,0.5)] p-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--accent-yellow)]">{sourceLink.source_system}</p>
          {sourceLink.source_ref ? <p className="text-sm text-[#f0ede6] mt-1">{sourceLink.source_ref}</p> : null}
          {sourceLink.source_url ? (
            <a href={sourceLink.source_url} target="_blank" rel="noreferrer" className="text-xs text-[var(--muted-strong)] underline break-all">
              {sourceLink.source_url}
            </a>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

export function EntityDetail({
  title,
  subtitle,
  details,
  opportunities,
  tasks,
  interactions,
  sourceLinks,
}: {
  title: string
  subtitle?: string | null
  details: Array<{ label: string; value?: string | null }>
  opportunities: CrmOpportunityView[]
  tasks: CrmTaskView[]
  interactions: CrmInteraction[]
  sourceLinks: CrmSourceLink[]
}) {
  return (
    <div className="space-y-6">
      <section className="terminal-panel p-4 space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-[#f0ede6]">{title}</h2>
          {subtitle ? <p className="text-sm text-[var(--muted-strong)] mt-1">{subtitle}</p> : null}
        </div>
        {detailList(details)}
      </section>

      <section className="terminal-panel p-4 space-y-3">
        <h3 className="font-mono text-xs uppercase tracking-[0.25em] text-[var(--accent-bright)]">Linked opportunities</h3>
        {simpleOpportunityList(opportunities)}
      </section>

      <section className="terminal-panel p-4 space-y-3">
        <h3 className="font-mono text-xs uppercase tracking-[0.25em] text-[var(--accent-bright)]">Linked tasks</h3>
        {simpleTaskList(tasks)}
      </section>

      <section className="terminal-panel p-4 space-y-3">
        <h3 className="font-mono text-xs uppercase tracking-[0.25em] text-[var(--accent-bright)]">Interactions</h3>
        {interactionList(interactions)}
      </section>

      <section className="terminal-panel p-4 space-y-3">
        <h3 className="font-mono text-xs uppercase tracking-[0.25em] text-[var(--accent-bright)]">Source links</h3>
        {sourceLinkList(sourceLinks)}
      </section>
    </div>
  )
}
