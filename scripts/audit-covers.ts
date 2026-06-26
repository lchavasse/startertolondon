/**
 * Audit cover images across the LIVE feed (what getEvents returns).
 * Reports events with no coverUrl, and events whose coverUrl doesn't resolve
 * (non-200 / non-image). Read-only.
 *
 *   npm run audit-covers
 */
import { getEvents } from '../src/lib/kv'

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

async function reachable(url: string): Promise<{ ok: boolean; detail: string }> {
  try {
    let res = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(10000) })
    // Some hosts reject HEAD — fall back to a ranged GET.
    if (res.status === 405 || res.status === 403) {
      res = await fetch(url, { method: 'GET', headers: { 'User-Agent': UA, Range: 'bytes=0-0' }, redirect: 'follow', signal: AbortSignal.timeout(10000) })
    }
    const ct = res.headers.get('content-type') ?? ''
    const ok = res.ok && (ct.startsWith('image/') || ct === '')
    return { ok, detail: `${res.status} ${ct}` }
  } catch (e: any) {
    return { ok: false, detail: e?.message ?? 'fetch error' }
  }
}

async function main() {
  const events = await getEvents()
  const missing = events.filter((e) => !e.coverUrl)
  const withCover = events.filter((e) => e.coverUrl)

  console.log(`live events: ${events.length} · with cover: ${withCover.length} · missing: ${missing.length}\n`)

  if (missing.length) {
    console.log(`── MISSING COVER (${missing.length}) ──`)
    for (const e of missing) console.log(`  ${e.source.padEnd(15)} ${e.name.slice(0, 70)}`)
    console.log()
  }

  console.log(`── CHECKING ${withCover.length} cover URLs resolve ──`)
  const broken: { name: string; url: string; detail: string }[] = []
  for (let i = 0; i < withCover.length; i++) {
    const e = withCover[i]
    const { ok, detail } = await reachable(e.coverUrl!)
    if (!ok) {
      broken.push({ name: e.name, url: e.coverUrl!, detail })
      console.log(`  ✗ ${detail.padEnd(28)} ${e.name.slice(0, 55)}`)
    }
  }
  console.log(`\nbroken covers: ${broken.length}/${withCover.length}`)
  if (broken.length) {
    console.log('\n── BROKEN ──')
    for (const b of broken) console.log(`  ${b.name.slice(0, 50)}\n    ${b.url}\n    ${b.detail}`)
  }
}

main().catch((err) => {
  console.error(err.message ?? err)
  process.exit(1)
})
