import { CrmShell } from '@/components/crm/CrmShell'
import { TaskTable } from '@/components/crm/TaskTable'
import { fetchCrmTasks } from '@/lib/crm/server'

export const dynamic = 'force-dynamic'

export default async function CrmTasksPage() {
  const tasks = await fetchCrmTasks()

  return (
    <CrmShell
      title="Tasks"
      subtitle="Actual work, which stubbornly continues to exist whether or not anyone updates the spreadsheet."
    >
      <TaskTable tasks={tasks} />
    </CrmShell>
  )
}
