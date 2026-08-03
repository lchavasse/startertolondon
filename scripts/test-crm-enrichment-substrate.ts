import assert from 'node:assert/strict'

async function main() {
  const constants = await import('../src/lib/crm/constants')
  assert.ok(Array.isArray(constants.CRM_ENRICHMENT_JOB_TYPES), 'CRM_ENRICHMENT_JOB_TYPES should exist')
  assert.ok(constants.CRM_ENRICHMENT_JOB_TYPES.includes('discover_contacts'), 'discover_contacts job type should be supported')
  assert.ok(Array.isArray(constants.CRM_CONNECTION_TYPES), 'CRM_CONNECTION_TYPES should exist')
  assert.ok(constants.CRM_CONNECTION_TYPES.includes('warm_route'), 'warm_route connection type should be supported')

  const enrichment = await import('../src/lib/crm/enrichment/server')
  assert.equal(typeof enrichment.queueEnrichmentJob, 'function', 'queueEnrichmentJob should be exported')
  assert.equal(typeof enrichment.fetchEnrichmentDashboard, 'function', 'fetchEnrichmentDashboard should be exported')
  assert.equal(typeof enrichment.fetchEnrichmentJobDetail, 'function', 'fetchEnrichmentJobDetail should be exported')

  const dashboard = enrichment.emptyEnrichmentDashboard()
  assert.deepEqual(dashboard.summary, {
    queued: 0,
    active: 0,
    review: 0,
    failed: 0,
    promoted: 0,
  })
  assert.deepEqual(dashboard.queuedJobs, [])
  assert.deepEqual(dashboard.reviewJobs, [])
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
