import { notFound } from 'next/navigation'
import { CrmShell } from '@/components/crm/CrmShell'
import { fetchEnrichmentJobDetail } from '@/lib/crm/enrichment/server'

export const dynamic = 'force-dynamic'

export default async function CrmEnrichmentJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const detail = await fetchEnrichmentJobDetail(id)
  if (!detail) notFound()

  return (
    <CrmShell
      title={`Enrichment job: ${detail.job.job_type}`}
      subtitle={detail.job.scope_label ?? 'Evidence, candidates, and review state for this enrichment run.'}
    >
      <section className="terminal-panel p-4 space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            ['Status', detail.job.status],
            ['Priority', detail.job.priority],
            ['Requested by', detail.job.requested_by_name],
            ['Assigned to', detail.job.assigned_to_name],
            ['Scope', detail.job.scope_type],
            ['Started', detail.job.started_at],
            ['Completed', detail.job.completed_at],
            ['Summary', detail.job.result_summary],
          ].map(([label, value]) => (
            <div key={label} className="border border-[var(--line)] bg-[rgba(9,13,14,0.5)] p-3 space-y-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">{label}</p>
              <p className="text-sm text-[#f0ede6]">{value || '—'}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <section className="terminal-panel p-4 space-y-3">
          <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-[var(--accent-bright)]">Search runs</h2>
          {detail.searchRuns.length ? detail.searchRuns.map((run) => (
            <div key={run.id} className="border border-[var(--line)] bg-[rgba(9,13,14,0.5)] p-3 space-y-1">
              <p className="text-sm font-semibold text-[#f0ede6]">{run.query}</p>
              <p className="text-xs text-[var(--muted-strong)]">{run.provider} · {run.status}</p>
            </div>
          )) : <p className="text-sm text-[var(--muted)]">No search runs yet.</p>}
        </section>

        <section className="terminal-panel p-4 space-y-3">
          <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-[var(--accent-bright)]">Search hits</h2>
          {detail.searchHits.length ? detail.searchHits.map((hit) => (
            <div key={hit.id} className="border border-[var(--line)] bg-[rgba(9,13,14,0.5)] p-3 space-y-1">
              <p className="text-sm font-semibold text-[#f0ede6]">{hit.title ?? hit.url}</p>
              <p className="text-xs text-[var(--muted-strong)]">{hit.hit_type} · {hit.domain ?? 'unknown domain'}</p>
            </div>
          )) : <p className="text-sm text-[var(--muted)]">No search hits yet.</p>}
        </section>

        <section className="terminal-panel p-4 space-y-3">
          <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-[var(--accent-bright)]">Entity candidates</h2>
          {detail.entityCandidates.length ? detail.entityCandidates.map((candidate) => (
            <div key={candidate.id} className="border border-[var(--line)] bg-[rgba(9,13,14,0.5)] p-3 space-y-1">
              <p className="text-sm font-semibold text-[#f0ede6]">{candidate.name}</p>
              <p className="text-xs text-[var(--muted-strong)]">{candidate.entity_type} · {candidate.status}</p>
            </div>
          )) : <p className="text-sm text-[var(--muted)]">No candidates yet.</p>}
        </section>

        <section className="terminal-panel p-4 space-y-3">
          <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-[var(--accent-bright)]">Connection candidates</h2>
          {detail.connectionCandidates.length ? detail.connectionCandidates.map((candidate) => (
            <div key={candidate.id} className="border border-[var(--line)] bg-[rgba(9,13,14,0.5)] p-3 space-y-1">
              <p className="text-sm font-semibold text-[#f0ede6]">{candidate.connection_type}</p>
              <p className="text-xs text-[var(--muted-strong)]">{candidate.status} · confidence {candidate.confidence ?? '—'}</p>
            </div>
          )) : <p className="text-sm text-[var(--muted)]">No connection candidates yet.</p>}
        </section>
      </section>
    </CrmShell>
  )
}
