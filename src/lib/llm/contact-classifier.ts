/**
 * Classifies the free-text values the 10 July sheet import dumped into
 * `crm_opportunities.next_action`. None of them is an action — they are contact names, firms,
 * LinkedIn URLs, and half-written reminders ("messaged Leo", "via Santi").
 *
 * Rule-based parsing loses here: the values carry verb prefixes, initials for Lachlan, firm names
 * that look like first names (Singular, Wilbe), and embedded routes. One Haiku call over the whole
 * distinct set is both cheaper to write and markedly more accurate.
 *
 * Fail-soft: an API error returns every value as `unclear`, so the caller creates nothing.
 */
import Anthropic from '@anthropic-ai/sdk'

export type ContactKind = 'person' | 'organisation' | 'linkedin_url' | 'not_a_contact' | 'unclear'

export interface ClassifiedContact {
  raw: string
  kind: ContactKind
  personName: string | null
  organisationName: string | null
  linkedinUrl: string | null
  routeVia: string | null
  confidence: number
  reason: string
}

const MODEL = 'claude-haiku-4-5-20251001'

const SYSTEM_PROMPT = `You are cleaning a CRM column for a London deeptech events team (DeepTech London).

A spreadsheet column called "who" was mis-imported into a field called next_action. Each value is
whatever the operator typed while tracking sponsor, speaker and partner conversations. Your job is
to say what each value actually refers to.

For each input value return one object with:
- raw: the input, copied exactly
- kind: one of
    person         — names a specific human contact
    organisation   — names a company, fund, or firm, not a person
    linkedin_url   — is (or contains) a LinkedIn profile URL
    not_a_contact  — a place, event track, status note, or the operator's own initials
    unclear        — genuinely cannot tell
- personName: the human's name only, or null. Strip action verbs ("messaged Leo" -> "Leo",
  "ping Adam" -> "Adam", "via Santi" -> "Santi"). Strip trailing "& co" / "& other leads".
- organisationName: the firm, or null. Also fill this when a person value names their employer
  ("James @ Rivan" -> personName "James", organisationName "Rivan").
- linkedinUrl: the URL if present, else null.
- routeVia: the intermediary when the value describes a warm route ("Tobias (via Jojo)" -> "Jojo"),
  else null.
- confidence: 0-1.
- reason: at most 12 words.

Domain notes that matter:
- "LC" is Lachlan Chavasse, the operator himself — not_a_contact.
- Singular, Wilbe, IQ Capital (often written IQC), Hummingbird, Balderton, Earlybird, Ignite,
  Orrick are firms, not people.
- Bristol, Glasgow, London are places — not_a_contact.
- "Energy Stage", "Akash Roundtable" are event tracks — not_a_contact.
- A leading "?" means the operator was unsure. Keep the name, lower the confidence.
- "LC / Jai" means Lachlan and Jai — the contact is Jai.
- Lone lowercase first names ("chinedu", "pete") are still people.

Return ONLY a JSON array, one object per input value, in the same order. No prose.`

export async function classifyContacts(values: string[]): Promise<ClassifiedContact[]> {
  const fallback = (reason: string): ClassifiedContact[] =>
    values.map((raw) => ({
      raw,
      kind: 'unclear' as const,
      personName: null,
      organisationName: null,
      linkedinUrl: null,
      routeVia: null,
      confidence: 0,
      reason,
    }))

  if (!values.length) return []
  if (!process.env.ANTHROPIC_API_KEY) return fallback('ANTHROPIC_API_KEY not set')

  const client = new Anthropic()

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: values.map((value, index) => `${index + 1}. ${JSON.stringify(value)}`).join('\n') }],
    })

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')

    const match = text.match(/\[[\s\S]*\]/)
    if (!match) return fallback('no JSON array in response')

    const parsed = JSON.parse(match[0]) as Array<Partial<ClassifiedContact>>
    const byRaw = new Map(parsed.filter((row) => typeof row.raw === 'string').map((row) => [row.raw as string, row]))

    return values.map((raw) => {
      const row = byRaw.get(raw)
      if (!row) return { raw, kind: 'unclear' as const, personName: null, organisationName: null, linkedinUrl: null, routeVia: null, confidence: 0, reason: 'missing from response' }
      return {
        raw,
        kind: (['person', 'organisation', 'linkedin_url', 'not_a_contact', 'unclear'] as const).includes(row.kind as ContactKind)
          ? (row.kind as ContactKind)
          : 'unclear',
        personName: row.personName ?? null,
        organisationName: row.organisationName ?? null,
        linkedinUrl: row.linkedinUrl ?? null,
        routeVia: row.routeVia ?? null,
        confidence: typeof row.confidence === 'number' ? row.confidence : 0,
        reason: typeof row.reason === 'string' ? row.reason : '',
      }
    })
  } catch (error) {
    console.error('[contact-classifier]', error)
    return fallback(error instanceof Error ? error.message : 'classification failed')
  }
}
