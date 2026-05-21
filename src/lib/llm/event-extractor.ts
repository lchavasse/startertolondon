/**
 * Extract structured event fields from an arbitrary event page using Haiku.
 *
 * Used by the dashboard submit flow (`src/lib/submit.ts`) when the URL isn't
 * a Luma calendar/user/event — i.e. a custom site like crusoe.ai, a corporate
 * events page, a meetup-style listing on someone's blog, etc. Fails soft:
 * returns null on any error so the caller can fall back to og:title scraping.
 */
import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-haiku-4-5-20251001'
const MAX_TEXT_CHARS = 30_000

export interface ExtractedEvent {
  name: string
  startAt: string         // ISO 8601
  endAt: string | null    // ISO 8601 or null if not stated
  timezone: string        // IANA, defaults to Europe/London
  locationName: string    // venue / address; "London" if only city given
  coverUrl: string | null // absolute URL
  organiserName: string
  confidence: number      // 0..1 — caller may threshold
}

const SYSTEM_PROMPT = `You extract structured event data from a single event page for a London tech events directory.

Output one event via the extract_event tool, even if the page lists multiple events — pick the one matching the URL slug. If the page is clearly not a single event (a generic listing, an article, a 404), set confidence below 0.3.

Field rules:
- name: the event title, no host site suffix ("Crusoe AI Talks: London", not "Crusoe AI Talks: London | Crusoe").
- startAt / endAt: ISO 8601 with offset. Use the page's stated timezone; if it says "BST" use +01:00, "GMT" use +00:00, "PT" use -07:00 or -08:00 depending on date. If only a date is given, set time to 18:00 local. If endAt isn't stated, return null.
- timezone: IANA name (Europe/London, America/Los_Angeles). Default Europe/London for London events.
- locationName: full venue + address if shown ("CodeNode, 10 South Place, London EC2M 7EB"). If only "London" or "London, UK" is shown, return "London". If virtual, "Online".
- coverUrl: absolute URL of the main event hero image. Skip avatars, sponsor logos, footer images. Return null if none clearly identifiable.
- organiserName: the hosting org or community ("Crusoe", "AI Tinkerers London"). Empty string if unclear.
- confidence: 0.9+ = unambiguous event page with full details. 0.6 = found event but missing fields. <0.3 = probably not an event page.

Filter: London-only directory. If the event is clearly in another city (NYC, SF, Berlin), set confidence below 0.3.`

const EXTRACT_TOOL: Anthropic.Tool = {
  name: 'extract_event',
  description: 'Return the extracted event fields.',
  input_schema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      startAt: { type: 'string', description: 'ISO 8601 with timezone offset' },
      endAt: { type: ['string', 'null'], description: 'ISO 8601 with timezone offset, or null' },
      timezone: { type: 'string', description: 'IANA timezone name' },
      locationName: { type: 'string' },
      coverUrl: { type: ['string', 'null'], description: 'Absolute URL or null' },
      organiserName: { type: 'string' },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
    },
    required: ['name', 'startAt', 'endAt', 'timezone', 'locationName', 'coverUrl', 'organiserName', 'confidence'],
  },
}

function htmlToText(html: string): string {
  // Strip scripts/styles/noscript/svg, then collapse tags to whitespace.
  // Cheap but good enough — Haiku tolerates noisy input.
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function resolveUrl(maybeRelative: string | null, baseUrl: string): string | null {
  if (!maybeRelative) return null
  try {
    return new URL(maybeRelative, baseUrl).toString()
  } catch {
    return null
  }
}

export async function extractEventFromHtml(
  url: string,
  html: string,
): Promise<ExtractedEvent | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null

  const text = htmlToText(html).slice(0, MAX_TEXT_CHARS)
  if (text.length < 200) return null

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  let response: Anthropic.Message
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      tools: [EXTRACT_TOOL],
      tool_choice: { type: 'tool', name: 'extract_event' },
      messages: [
        {
          role: 'user',
          content: `URL: ${url}\n\nPage content:\n${text}`,
        },
      ],
    })
  } catch (err) {
    console.warn('[event-extractor] Anthropic error:', err instanceof Error ? err.message : err)
    return null
  }

  const toolUse = response.content.find((c) => c.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') return null

  const input = toolUse.input as Partial<ExtractedEvent>
  if (typeof input.name !== 'string' || typeof input.startAt !== 'string') return null

  const startMs = new Date(input.startAt).getTime()
  if (isNaN(startMs)) return null

  // Sanity: drop events older than 1 day or further than 18 months out — common
  // failure mode is the LLM picking up an old "past events" item.
  const nowMs = Date.now()
  if (startMs < nowMs - 24 * 60 * 60 * 1000) return null
  if (startMs > nowMs + 18 * 30 * 24 * 60 * 60 * 1000) return null

  const endAt =
    typeof input.endAt === 'string' && !isNaN(new Date(input.endAt).getTime())
      ? input.endAt
      : null

  return {
    name: input.name.trim(),
    startAt: input.startAt,
    endAt,
    timezone: input.timezone || 'Europe/London',
    locationName: (input.locationName || 'London').trim(),
    coverUrl: resolveUrl(typeof input.coverUrl === 'string' ? input.coverUrl : null, url),
    organiserName: (input.organiserName || '').trim(),
    confidence: typeof input.confidence === 'number' ? input.confidence : 0,
  }
}
