/**
 * Fetches a luma.com page and extracts the api_id (cal- or discplace-).
 * Used by the pre-flight resolver in index.ts to serialize all page fetches
 * before scrapers run, avoiding rate limits from concurrent requests.
 */

const PAGE_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

export type PageId =
  | { kind: 'cal'; id: string }
  | { kind: 'discplace'; id: string }
  | null

function parsePageId(html: string): PageId {
  const dataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (!dataMatch) return null
  const json = dataMatch[1]

  // Detect rate-limit response embedded in __NEXT_DATA__
  if (/"status"\s*:\s*429/.test(json)) return null

  const placeMatch = json.match(/"api_id"\s*:\s*"(discplace-[A-Za-z0-9]+)"/)
  if (placeMatch) return { kind: 'discplace', id: placeMatch[1] }

  const calMatch = json.match(/"api_id"\s*:\s*"(cal-[A-Za-z0-9]+)"/)
  if (calMatch) return { kind: 'cal', id: calMatch[1] }

  return null
}

export async function fetchPageId(slug: string, retryOn429 = true): Promise<PageId> {
  try {
    const res = await fetch(`https://luma.com/${slug}`, {
      headers: PAGE_HEADERS,
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const html = await res.text()
    const result = parsePageId(html)

    // Rate limited — wait and retry once
    if (result === null && retryOn429 && /"status"\s*:\s*429/.test(html)) {
      await new Promise((r) => setTimeout(r, 15000))
      return fetchPageId(slug, false)
    }

    return result
  } catch {
    return null
  }
}
