/**
 * Find events with no coverUrl and try to fetch one from the source page's
 * og:image meta tag.
 *
 * Usage:
 *   npm run fix-covers                          # dry-run, show what would change (default 50)
 *   npm run fix-covers -- --apply               # actually write back to KV
 *   npm run fix-covers -- --apply --limit 200
 *   npm run fix-covers -- --source cerebral-valley --apply
 *
 * Operates on events:london (full-overwrite via saveEvents) and events:manual
 * (per-event update). Skips events whose URL is unfetchable, returns no
 * og:image, or whose host doesn't respond.
 */
import { getRawEvents, saveEvents, getManualEvents, updateManualEvent } from '../src/lib/kv'
import type { LondonEvent } from '../src/lib/types'

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const REQUEST_DELAY_MS = 400

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/gi, '/')
}

async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const html = await res.text()
    // Match og:image regardless of attribute order
    const m =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
    return m?.[1] ? decodeHtmlEntities(m[1]) : null
  } catch {
    return null
  }
}

interface Args {
  apply: boolean
  limit: number
  sourceFilter: string | null
  retryBroken: boolean
}

function parseArgs(): Args {
  const argv = process.argv.slice(2)
  const apply = argv.includes('--apply')
  const retryBroken = argv.includes('--retry-broken')
  const limitIdx = argv.indexOf('--limit')
  const limit = limitIdx !== -1 ? parseInt(argv[limitIdx + 1] ?? '50', 10) : 50
  const sourceIdx = argv.indexOf('--source')
  const sourceFilter = sourceIdx !== -1 ? argv[sourceIdx + 1] ?? null : null
  return { apply, limit, sourceFilter, retryBroken }
}

// An event needs cover-fixing if it has no coverUrl, or (when --retry-broken
// is set) its coverUrl contains HTML-entity-encoded characters from a buggy
// earlier extraction pass.
function needsCoverFix(event: LondonEvent, retryBroken: boolean): boolean {
  if (!event.coverUrl) return true
  if (retryBroken && event.coverUrl.includes('&amp;')) return true
  return false
}

async function main() {
  const { apply, limit, sourceFilter, retryBroken } = parseArgs()
  const mode = apply ? 'apply' : 'dry-run'
  const retryNote = retryBroken ? ' · retry-broken' : ''
  console.log(`mode: ${mode} · limit: ${limit}${sourceFilter ? ` · source: ${sourceFilter}` : ''}${retryNote}\n`)

  const [london, manual] = await Promise.all([getRawEvents(), getManualEvents()])

  const candidates: { event: LondonEvent; from: 'london' | 'manual' }[] = []
  for (const e of london) {
    if (needsCoverFix(e, retryBroken) && (!sourceFilter || e.source === sourceFilter)) {
      candidates.push({ event: e, from: 'london' })
    }
  }
  for (const e of manual) {
    if (needsCoverFix(e, retryBroken) && (!sourceFilter || e.source === sourceFilter)) {
      candidates.push({ event: e, from: 'manual' })
    }
  }

  console.log(`found ${candidates.length} events needing fix (${london.filter((e) => needsCoverFix(e, retryBroken)).length} in london, ${manual.filter((e) => needsCoverFix(e, retryBroken)).length} in manual)`)
  if (candidates.length === 0) return

  const slice = candidates.slice(0, limit)
  console.log(`processing ${slice.length}...\n`)

  let fixed = 0
  let failed = 0
  // Track per-collection updates so we can persist london in one shot.
  const londonUpdates = new Map<string, string>()  // id → coverUrl

  for (let i = 0; i < slice.length; i++) {
    const { event, from } = slice[i]
    const cover = await fetchOgImage(event.url)
    const tag = cover ? '✓' : '✗'
    console.log(`  [${i + 1}/${slice.length}] ${tag} ${from} ${event.source.padEnd(15)} ${event.name.slice(0, 60)}`)
    if (cover) {
      fixed++
      if (apply) {
        if (from === 'london') londonUpdates.set(event.id, cover)
        else await updateManualEvent(event.id, { coverUrl: cover })
      }
    } else {
      failed++
    }
    if (i < slice.length - 1) await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS))
  }

  if (apply && londonUpdates.size > 0) {
    const updated = london.map((e) => (londonUpdates.has(e.id) ? { ...e, coverUrl: londonUpdates.get(e.id)! } : e))
    await saveEvents(updated)
    console.log(`\npersisted ${londonUpdates.size} london updates`)
  }

  console.log(`\n${apply ? 'applied' : 'would apply'}: ${fixed} fixed · ${failed} no-image-found`)
  const remaining = candidates.length - slice.length
  if (remaining > 0) console.log(`${remaining} more candidates remain — re-run with higher --limit`)
}

main().catch((err) => {
  console.error(err.message ?? err)
  process.exit(1)
})
