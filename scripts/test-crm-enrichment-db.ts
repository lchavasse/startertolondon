import assert from 'node:assert/strict'
import { addImportRows, createImportBatch, fetchEnrichmentDashboard, fetchEnrichmentJobDetail, queueEnrichmentJob } from '../src/lib/crm/enrichment/server'
import { getCrmServiceClient } from '../src/lib/crm/server'

async function main() {
  const supabase = getCrmServiceClient()
  const batch = await createImportBatch({
    source_system: 'manual',
    name: 'Hermes enrichment substrate smoke test',
    import_type: 'sponsor_targets',
    metadata: { test: true },
  })

  const rows = await addImportRows(batch.id, [
    {
      row_index: 1,
      raw_payload: { company: 'Example Robotics' },
      normalized_name: 'Example Robotics',
      normalized_type: 'organisation',
      status: 'queued_for_enrichment',
    },
  ])

  const job = await queueEnrichmentJob({
    scope_type: 'list_import',
    scope_id: null,
    job_type: 'list_import',
    input_payload: { batch_id: batch.id, row_ids: rows.map((row) => row.id), test: true },
  })

  const dashboard = await fetchEnrichmentDashboard()
  assert.ok(dashboard.recentJobs.some((item) => item.id === job.id), 'queued job should appear in enrichment dashboard')

  const detail = await fetchEnrichmentJobDetail(job.id)
  assert.ok(detail, 'job detail should load')
  assert.equal(detail?.job.id, job.id)

  const cleanup = async () => {
    await supabase.from('crm_import_rows').delete().eq('batch_id', batch.id)
    await supabase.from('crm_import_batches').delete().eq('id', batch.id)
    await supabase.from('crm_enrichment_jobs').delete().eq('id', job.id)
  }

  await cleanup()
}

main().catch(async (error) => {
  console.error(error)
  process.exit(1)
})
