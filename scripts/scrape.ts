import { runAllScrapers } from '../src/lib/scrapers'
import { saveEvents, getRawEvents } from '../src/lib/kv'
import { Redis } from '@upstash/redis'
import { dedupeBySlug } from '../src/lib/scrapers/dedup-utils'

async function main() {
  const force = process.argv.includes('--force')
  const dedupeOnly = process.argv.includes('--dedupe')

  if (dedupeOnly) {
    console.log('Dedupe mode: loading events from KV...')
    const events = await getRawEvents()
    console.log(`Loaded ${events.length} events`)
    const deduped = dedupeBySlug(events)
    console.log(`After slug dedup: ${deduped.length} (removed ${events.length - deduped.length})`)
    await saveEvents(deduped)
    console.log('Done.')
    return
  }

  if (force) {
    console.log('Force mode: clearing scraped-at cache...')
    const redis = new Redis({ url: process.env.KV_REST_API_URL!, token: process.env.KV_REST_API_TOKEN! })
    await redis.set('sources:scraped-at', '{}')
  }

  console.log('Running scrapers...')
  const { events, failed, stats } = await runAllScrapers()
  console.log(`Scraped ${stats.total} events (${stats.fresh} fresh, ${stats.cached} cached)`)

  if (failed.length > 0) {
    const rateLimited = failed.filter((f) => f.isRateLimit)
    console.warn(`\n${failed.length} source(s) failed (${rateLimited.length} rate-limited):`)
    for (const f of failed) {
      console.warn(`  - ${f.slug}: ${f.error}${f.isRateLimit ? ' [RATE LIMITED]' : ''}`)
    }
  }

  if (events.length > 0) {
    console.log('\nSaving to KV...')
    await saveEvents(events)
    console.log('Done.')
    console.log('\nSample events:')
    events.slice(0, 3).forEach((e) => {
      console.log(`  - ${e.name} (${e.startAt})`)
    })
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
