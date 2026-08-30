import { format } from 'date-fns'
import { CrmTaskView } from '@/lib/crm/types'

function formatMaybe(value: string | null) {
  if (!value) return '—'
  return format(new Date(value), 'd MMM yyyy')
}

export function TaskTable({ tasks }: { tasks: CrmTaskView[] }) {
  return (
    <div className="terminal-panel overflow-hidden">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-[var(--line)] bg-[rgba(9,13,14,0.75)]">
          <tr className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
            <th className="px-4 py-3">Task</th>
            <th className="px-4 py-3">Owner</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Priority</th>
            <th className="px-4 py-3">Due</th>
            <th className="px-4 py-3">Links</th>
          </tr>
        </thead>
        <tbody>
          {tasks.length === 0 ? (
            <tr>
              <td className="px-4 py-6 text-[var(--muted)]" colSpan={6}>No tasks yet.</td>
            </tr>
          ) : (
            tasks.map((task) => (
              <tr key={task.id} className="border-b border-[var(--line)] align-top last:border-b-0">
                <td className="px-4 py-3">
                  <div className="space-y-1">
                    <p className="font-semibold text-[#f0ede6]">{task.title}</p>
                    {task.description ? <p className="text-xs text-[var(--muted-strong)]">{task.description}</p> : null}
                  </div>
                </td>
                <td className="px-4 py-3 text-[var(--muted-strong)]">{task.owner_name ?? 'Unassigned'}</td>
                <td className="px-4 py-3 text-[var(--muted-strong)]">{task.status}</td>
                <td className="px-4 py-3 text-[var(--muted-strong)]">{task.priority}</td>
                <td className="px-4 py-3 text-[var(--muted-strong)]">{formatMaybe(task.due_at)}</td>
                <td className="px-4 py-3 text-xs text-[var(--muted-strong)]">
                  <div className="space-y-1">
                    {task.linked_opportunity_title ? <p>Opp: {task.linked_opportunity_title}</p> : null}
                    {task.linked_person_name ? <p>Person: {task.linked_person_name}</p> : null}
                    {task.linked_organisation_name ? <p>Org: {task.linked_organisation_name}</p> : null}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
