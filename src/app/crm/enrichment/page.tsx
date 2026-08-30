import { CrmShell } from '@/components/crm/CrmShell'
import { EntityList } from '@/components/crm/EntityList'
import { fetchEnrichmentDashboard } from '@/lib/crm/enrichment/server'

export const dynamic = 'force-dynamic'

export default async function CrmEnrichmentPage() {
  const data = await fetchEnrichmentDashboard()

  return (
    <CrmShell
      title="Enrichment"
      subtitle="Import, search, scrape, extract, review, promote. Slightly less chaotic than just pasting more notes into the opportunity."
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          ['Queued', data.summary.queued],
          ['Active', data.summary.active],
          ['Review', data.summary.review],
          ['Failed', data.summary.failed],
          ['Promoted', data.summary.promoted],
        ].map(([label, value]) => (
          <div key={label} className="terminal-panel p-4 space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--muted)]">{label}</p>
            <p className="text-3xl font-bold text-[#f0ede6]">{value}</p>
          </div>
        ))}
      </section>

      <EntityList
        title="Queued jobs"
        empty="No enrichment jobs queued. Either glorious efficiency or nothing is being researched yet."
        items={data.queuedJobs.map((job) => ({
          id: job.id,
          title: `${job.job_type}`,
          subtitle: job.scope_label ?? 'No scope label yet',
          meta: `${job.priority} · ${job.status}`,
          href: `/crm/enrichment/${job.id}`,
        }))}
      />

      <EntityList
        title="Needs review"
        empty="No enrichment jobs waiting for review. A rare and suspicious peace."
        items={data.reviewJobs.map((job) => ({
          id: job.id,
          title: `${job.job_type}`,
          subtitle: job.scope_label ?? 'No scope label yet',
          meta: `${job.priority} · ${job.status}`,
          href: `/crm/enrichment/${job.id}`,
        }))}
      />

      <EntityList
        title="Recent jobs"
        empty="No enrichment history yet."
        items={data.recentJobs.map((job) => ({
          id: job.id,
          title: `${job.job_type}`,
          subtitle: job.scope_label ?? 'No scope label yet',
          meta: `${job.priority} · ${job.status}`,
          href: `/crm/enrichment/${job.id}`,
        }))}
      />
    </CrmShell>
  )
}
