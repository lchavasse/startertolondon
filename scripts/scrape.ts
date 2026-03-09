import { runAllScrapers } from '../src/lib/scrapers'
import { saveEvents } from '../src/lib/kv'

async function main() {
  console.log('Running scrapers...')
  const events = await runAllScrapers()
  console.log(`Scraped ${events.length} events`)

  if (events.length > 0) {
    console.log('Saving to KV...')
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
