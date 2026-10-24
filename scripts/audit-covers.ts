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

// PNG / JPEG / GIF / WebP / AVIF signatures.
async function isImageByBytes(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Range: 'bytes=0-15' },
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return false
    const b = new Uint8Array(await res.arrayBuffer())
    if (b.length < 12) return false
    const ascii = (o: number, n: number) =>
      String.fromCharCode(...b.slice(o, o + n))
    if (b[0] === 0x89 && ascii(1, 3) === 'PNG') return true
    if (b[0] === 0xff && b[1] === 0xd8) return true // JPEG
    if (ascii(0, 3) === 'GIF') return true
    if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return true
    if (ascii(4, 4) === 'ftyp' && ascii(8, 4).startsWith('avi')) return true
    return false
  } catch {
    return false
  }
}

async function reachable(url: string): Promise<{ ok: boolean; detail: string }> {
  try {
    let res = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(10000) })
    // Some hosts reject HEAD — fall back to a ranged GET.
    if (res.status === 405 || res.status === 403) {
      res = await fetch(url, { method: 'GET', headers: { 'User-Agent': UA, Range: 'bytes=0-0' }, redirect: 'follow', signal: AbortSignal.timeout(10000) })
    }
    const ct = res.headers.get('content-type') ?? ''
    // Some hosts (GCS) serve .webp as application/octet-stream — sniff magic
    // bytes rather than trusting the header, so real images aren't flagged.
    if (res.ok && !ct.startsWith('image/') && ct !== '') {
      const sniffed = await isImageByBytes(url)
      return { ok: sniffed, detail: `${res.status} ${ct}${sniffed ? ' (sniffed: image)' : ''}` }
    }
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
