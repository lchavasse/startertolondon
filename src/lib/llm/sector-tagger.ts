/**
 * LLM sector tagger for orphan events (events whose source has no KB row).
 *
 * Takes a batch of events plus their descriptions and returns sector tags
 * + confidence per event. Used by `sector-pipeline.ts` after KB inheritance
 * misses; results are persisted on the event (`sectorTags`) and cached in
 * Redis (`event:sectors:<id>`) for idempotency across cron runs.
 *
 * Fail-soft: any Anthropic API error returns events tagged as `[]` so the
 * cron run still completes.
 */
import Anthropic from '@anthropic-ai/sdk'
import { SECTORS, SECTOR_DESCRIPTIONS, normaliseSectors, type Sector } from '@/lib/sectors'
import type { LondonEvent } from '@/lib/types'

export interface TaggedEvent {
  eventId: string
  sectors: Sector[]
  confidence: number
  reason: string
}

const MODEL = 'claude-haiku-4-5-20251001'
const BATCH_SIZE = 20
const CONFIDENCE_THRESHOLD = 0.5

const SECTOR_LIST_TEXT = SECTORS.map((s) => `- ${s}: ${SECTOR_DESCRIPTIONS[s]}`).join('\n')

const SYSTEM_PROMPT = `You tag London tech events with sectors for a curated events directory aimed at builders, founders, and engineers.

Output 1–3 sectors per event from this fixed list:

${SECTOR_LIST_TEXT}

Core rules:
- Be precise, not exhaustive. 1 sector is often correct. Never guess to fill space.
- Tag based on the *actual content* of the event, not the literal name of the host calendar. "Deep Tech Showcase" full of generic VC pitches is NOT \`deeptech\` — it's untagged \`[]\`.
- \`deeptech\` is for frontier-physics-adjacent topics (quantum, photonics, novel materials, space hardware, fusion). It is NOT for generic founder/VC events that contain the words "deep tech".
- \`hardware\` means physical products / electronics / IoT / makerspace / firmware. Software engineering events are NOT hardware.
- \`design\` means industrial design, design engineering, product design, UX. \`creative\` means media/gaming/art/music. Don't confuse them. A "Design Engineering Night" is \`design\`, not \`hardware\` and not \`creative\`.
- \`bio\` covers biotech, synbio, longevity, neuro, life sciences, bioelectronics. Lectures like "Bioelectronics: Technology Interfaces with the Human Body" → \`[bio, hardware]\`.
- \`science\` is for academic talks, named-researcher lectures, frontier research talks (Royal Institution, Bakerian Lecture, university inaugurals).
- "AI for X" → \`[ai]\` plus the X sector ONLY if X is a substantive focus, not framing. "AI agents in healthcare" → \`[ai, healthtech]\`. "Use AI to scale your business" → \`[ai]\` only.
- Drinks, "founder dinners", generic networking, demo nights with no domain focus → \`[]\`.
- Off-topic (yoga, kids' coding, MLM, generic networking, art exhibitions, postal museum) → \`[]\`.
- Confidence: 0.9+ = obvious from title alone. 0.7 = solid signal in description. 0.5 = inferred from organiser. <0.5 = guessing → return \`[]\` instead.

Few-shot examples:
- "London AI Demo Day" → \`[ai]\`, 0.95
- "Longevity London Hack" with AI mentioned in body → \`[bio, ai]\`, 0.85
- "Bakerian Lecture: Bioelectronics — Technology Interfaces with the Human Body" → \`[bio, hardware, science]\`, 0.9
- "Quantum Paradoxes: Testing the Multiverse" → \`[deeptech, science]\`, 0.9
- "Design Engineering Night #8" by Granola → \`[design]\`, 0.85
- "Scaling Hardware Innovation Companies" → \`[hardware]\`, 0.85
- "Deep Tech Showcase 2026" — generic VC/founder pitches → \`[]\`, 0.3 (don't tag deeptech just because it's in the name)
- "DEEPTECH LONDON" — generic ecosystem mixer → \`[]\`, 0.3
- "Frontier Photonics Symposium" — actual frontier physics → \`[deeptech, science]\`, 0.9
- "ElevenLabs voice AI workshop" → \`[ai, devtools]\`, 0.9
- "Solana developer meetup" → \`[crypto, devtools]\`, 0.9
- "Climate VC office hours" → \`[climate]\`, 0.8
- "AI x Weather x Climate Demo Night" → \`[ai, climate]\`, 0.9
- "Creative AI Meetup" → \`[ai, creative]\`, 0.85
- "Founders Dinner #14" → \`[]\`, 0.3
- "Private View | Summer Student Exhibition" → \`[]\`, 0.2 (art exhibition, not tech)
- "Curated Social Poker with Tech Founders" → \`[]\`, 0.2 (social, no domain focus)

Output: call the tag_events tool exactly once with a 'tagged' array containing every input event.`

const TAG_TOOL: Anthropic.Tool = {
  name: 'tag_events',
  description: 'Tag the candidate events. Must include every input event in the tagged array.',
  input_schema: {
    type: 'object',
    properties: {
      tagged: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            eventId: { type: 'string' },
            sectors: {
              type: 'array',
              items: { type: 'string', enum: [...SECTORS] },
              maxItems: 3,
            },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            reason: { type: 'string', description: 'One short sentence explaining the tags.' },
          },
          required: ['eventId', 'sectors', 'confidence', 'reason'],
        },
      },
    },
    required: ['tagged'],
  },
}

interface RenderableEvent {
  id: string
  name: string
  organiser: string
  description: string
}

function renderEvent(e: RenderableEvent): string {
  return JSON.stringify({
    id: e.id,
    name: e.name,
    organiser: e.organiser || '?',
    description: e.description ? e.description.slice(0, 1500) : '(no description fetched)',
  })
}

async function tagBatch(client: Anthropic, events: RenderableEvent[]): Promise<TaggedEvent[]> {
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
    ],
    tools: [TAG_TOOL],
    tool_choice: { type: 'tool', name: 'tag_events' },
    messages: [
      {
        role: 'user',
        content: `Tag these events:\n\n${candidates}`,
      },
    ],
  })

  const toolUse = response.content.find((c) => c.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('Anthropic did not invoke tag_events tool')
  }
  const input = toolUse.input as { tagged?: TaggedEvent[] }
  if (!Array.isArray(input.tagged)) {
    throw new Error('tag_events tool returned invalid shape')
  }
  // Apply confidence threshold + sector normalisation.
  return input.tagged.map((t) => ({
    eventId: t.eventId,
    sectors: t.confidence < CONFIDENCE_THRESHOLD ? [] : normaliseSectors(t.sectors),
    confidence: t.confidence,
    reason: t.reason ?? '',
  }))
}

function failSoft(eventId: string, reason: string): TaggedEvent {
  return { eventId, sectors: [], confidence: 0, reason }
}

export async function tagEvents(
  events: readonly LondonEvent[],
  descriptions: Map<string, string>
): Promise<TaggedEvent[]> {
  if (events.length === 0) return []
  if (!process.env.ANTHROPIC_API_KEY) {
    return events.map((e) => failSoft(e.id, '(no ANTHROPIC_API_KEY set)'))
  }

  const renderable: RenderableEvent[] = events.map((e) => ({
    id: e.id,
    name: e.name,
    organiser: e.organiserName || e.calendarSlug || '',
    description: descriptions.get(e.id) ?? '',
  }))

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const results: TaggedEvent[] = []

  for (let i = 0; i < renderable.length; i += BATCH_SIZE) {
    const batch = renderable.slice(i, i + BATCH_SIZE)
    try {
      const tagged = await tagBatch(client, batch)
      results.push(...tagged)
    } catch (err) {
      console.warn(
        `[sector-tagger] batch ${i}-${i + batch.length} failed:`,
        err instanceof Error ? err.message : err
      )
      results.push(...batch.map((e) => failSoft(e.id, '(LLM unavailable)')))
    }
  }
  return results
}
