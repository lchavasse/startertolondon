import { CrmShell } from '@/components/crm/CrmShell'
import { PeoplePool } from '@/components/crm/PeoplePool'
import { getCrmServiceClient } from '@/lib/crm/server'
import { fetchAllRows } from '@/lib/crm/fetch-all'
import type { CrmPoolPerson } from '@/lib/crm/pillars'

export const dynamic = 'force-dynamic'

export default async function PeoplePoolPage() {
  const supabase = getCrmServiceClient()
  let data: CrmPoolPerson[] = []
  let error: { message: string } | null = null
  try {
    // Paged, not limited: Supabase truncates at db-max-rows and says nothing.
    data = await fetchAllRows<CrmPoolPerson>(() =>
      supabase.from('crm_people_pool').select('*').order('fit', { ascending: false }),
    )
  } catch (e) {
    error = { message: e instanceof Error ? e.message : 'query failed' }
  }

  if (error) {
    return (
      <CrmShell title="Sourcing" subtitle="Event sourcing pool.">
        <section className="terminal-panel p-4">
          <p className="text-sm text-[var(--muted-strong)]">
            Could not read <code>crm_people_pool</code>: {error.message}
          </p>
          <p className="mt-2 text-sm text-[var(--muted-strong)]">
            If the table does not exist yet, run <code>supabase/migrations/20260804_crm_people_pool.sql</code>,
            then <code>npm run crm:import-pool -- --commit</code>.
          </p>
        </section>
      </CrmShell>
    )
  }

  return (
    <CrmShell
      title="Sourcing"
      subtitle="Everyone classified from the LinkedIn network, the deeptech scanner, and profiles adjacent to both. Tick to shortlist, flag with a note, fix a wrong label in place. Everything saves as you go."
    >
      <PeoplePool people={data} />
    </CrmShell>
  )
}
