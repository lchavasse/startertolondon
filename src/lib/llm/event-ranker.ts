/**
 * LLM ranker for the events review queue.
 *
 * Takes a batch of pending events plus the user's recent review decisions and
 * returns a ranked array with score, suggested decision, and a 1-line reason.
 * Used by scripts/review-events.ts during a review session.
 *
 * Fail-soft: any Anthropic API error returns the events with a default score
 * of 0.5 and a '(LLM unavailable)' reason so the user can still review.
 */
import Anthropic from '@anthropic-ai/sdk'
import type { LondonEvent, EventDecision, ReviewDecision } from '@/lib/types'

export interface RankedEvent {
  eventId: string
  score: number
  reason: string
  suggestedDecision: ReviewDecision
}

const MODEL = 'claude-haiku-4-5-20251001'
const BATCH_SIZE = 20

const SYSTEM_PROMPT = `You are a curator for starter-london, a London tech events directory aimed at active builders, founders, and engineers. You evaluate Eventbrite/Meetup events for inclusion in the public feed.

Quality bar:
- FEATURE (high signal): aimed at active builders/founders/engineers; tech / AI / deeptech / startup focus; respected organisers; recurring quality series.
- LIST (medium): on-topic but not exceptional — corporate panels with genuine builder relevance, peripheral tech, "good to know it exists" but not feed-worthy.
- REJECT (low signal): off-topic spam (MLM, generic networking, yoga-with-tech-tag); on-topic but low quality (vendor sales pitches, paid intro courses, recruiter mixers, generic "AI for everyone" intros).

Soft signals (do not auto-reject on these):
- Events without cover images score slightly lower (the feed looks ugly without them) but Meetup's image scraper often misses real photos. Don't auto-reject on missing image alone.

Use the user's past decisions (provided in the system block as few-shot examples) as the strongest signal for what they actually like. Their taste outweighs generic heuristics.

Output: call the rank_events tool exactly once with a 'ranked' array containing every input event.`

const RANK_TOOL: Anthropic.Tool = {
  name: 'rank_events',
  description: 'Score and annotate the candidate events. Must include every input event in the ranked array.',
  input_schema: {
    type: 'object',
    properties: {
      ranked: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            eventId: { type: 'string' },
            score: { type: 'number', minimum: 0, maximum: 1 },
            reason: { type: 'string', description: 'One short sentence explaining the score and suggested decision.' },
            suggestedDecision: { type: 'string', enum: ['feature', 'list', 'reject'] },
          },
          required: ['eventId', 'score', 'reason', 'suggestedDecision'],
        },
      },
    },
    required: ['ranked'],
  },
}

function renderEvent(e: LondonEvent): string {
  return JSON.stringify({
    id: e.id,
    name: e.name,
    organiser: e.organiserName || e.calendarSlug || '?',
    source: e.source,
    coverImage: e.coverUrl ? 'present' : 'missing',
    venue: e.locationName,
    startAt: e.startAt,
    tags: e.tags,
  })
}

function renderDecisions(decisions: EventDecision[]): string {
  if (decisions.length === 0) return '(no past decisions yet — use the system bar above)'
  const grouped: Record<ReviewDecision, EventDecision[]> = { feature: [], list: [], reject: [] }
  for (const d of decisions) grouped[d.decision].push(d)
  const lines: string[] = []
  for (const dec of ['feature', 'list', 'reject'] as const) {
    if (grouped[dec].length === 0) continue
    lines.push(`# ${dec.toUpperCase()}d`)
    for (const d of grouped[dec]) {
      lines.push(`- "${d.name}" by ${d.organiser}${d.reason ? ` — ${d.reason}` : ''}`)
    }
  }
  return lines.join('\n')
}

async function rankBatch(
  client: Anthropic,
  events: LondonEvent[],
  decisions: EventDecision[]
): Promise<RankedEvent[]> {
  const fewShot = renderDecisions(decisions)
  const candidates = events.map(renderEvent).join('\n')

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
      {
        type: 'text',
        text: `## User's past decisions\n${fewShot}`,
        cache_control: { type: 'ephemeral' },
      },
    ],
    tools: [RANK_TOOL],
    tool_choice: { type: 'tool', name: 'rank_events' },
    messages: [
      {
        role: 'user',
        content: `Rank these candidate events:\n\n${candidates}`,
      },
    ],
  })

  const toolUse = response.content.find((c) => c.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('Anthropic did not invoke rank_events tool')
  }
  const input = toolUse.input as { ranked?: RankedEvent[] }
  if (!Array.isArray(input.ranked)) {
    throw new Error('rank_events tool returned invalid shape')
  }
  return input.ranked
}

function failSoft(event: LondonEvent, reason: string): RankedEvent {
  return {
    eventId: event.id,
    score: 0.5,
    reason,
    suggestedDecision: 'list',
  }
}

export async function rankEvents(
  events: LondonEvent[],
  recentDecisions: EventDecision[]
): Promise<RankedEvent[]> {
  if (events.length === 0) return []
  if (!process.env.ANTHROPIC_API_KEY) {
    return events.map((e) => failSoft(e, '(no ANTHROPIC_API_KEY set)'))
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const results: RankedEvent[] = []

  for (let i = 0; i < events.length; i += BATCH_SIZE) {
    const batch = events.slice(i, i + BATCH_SIZE)
    try {
      const ranked = await rankBatch(client, batch, recentDecisions)
      results.push(...ranked)
    } catch (err) {
      console.warn(`[ranker] batch ${i}-${i + batch.length} failed:`, err instanceof Error ? err.message : err)
      results.push(...batch.map((e) => failSoft(e, '(LLM unavailable)')))
    }
  }
  return results
}
