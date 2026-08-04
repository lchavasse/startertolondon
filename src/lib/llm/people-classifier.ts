/**
 * Classifies people candidates on two orthogonal axes.
 *
 * `pillar` is durable — it describes what someone actually works on, and is reusable across the
 * expo, speaker sourcing, weekly content and every future event. `rivanGroup` is disposable — it
 * is one dinner's staffing plan. Keeping them separate means a new event needs a new grouping
 * pass over cached pillars, not a full re-classification.
 *
 * Batched with a cached system prompt. Fail-soft: an API error returns every candidate unclassified
 * so the caller creates nothing.
 */
import Anthropic from '@anthropic-ai/sdk'

export const PILLARS = [
  'energy',
  'compute',
  'manufacturing',
  'biotech',
  'lab_automation',
  'space',
  'defence',
  'robotics',
  'autonomy',
  'materials',
  'hardware_other',
  'science',
] as const

export const ROLE_TYPES = ['founder', 'engineer', 'researcher', 'investor', 'policy', 'operator', 'student', 'other'] as const

export const RIVAN_GROUPS = [
  'rivan',
  'top_founder',
  'early_eng_founder',
  'senior_engineer',
  'postdoc',
  'recent_grad',
  'policy_misc',
  'vc',
  'deeptech_operator',
  'deeptech_ic',
  'none',
] as const

export type Pillar = (typeof PILLARS)[number]
export type RoleType = (typeof ROLE_TYPES)[number]
export type RivanGroup = (typeof RIVAN_GROUPS)[number]

export interface CandidateInput {
  slug: string
  name?: string | null
  headline?: string | null
  company?: string | null
  scannerSector?: string | null
  location?: string | null
  about?: string | null
  education?: string | null
  followers?: number | null
}

export interface ClassifiedPerson {
  slug: string
  pillars: Pillar[]
  roleType: RoleType
  seniority: 'junior' | 'mid' | 'senior' | 'exec'
  rivanGroup: RivanGroup
  isDeeptech: boolean
  confidence: number
  evidence: string
}

const MODEL = 'claude-haiku-4-5-20251001'

const SYSTEM_PROMPT = `You classify people for DeepTech London — an events organisation running an expo, a
speaker programme, and invite-only dinners for the UK deeptech ecosystem.

For each person return one object with these fields.

pillars: 0-3 from this fixed list, describing what they ACTUALLY work on:
  energy          power generation/storage, batteries, fusion, nuclear, grid, hydrogen
  compute         semiconductors, chips, photonics, quantum computing, HPC, AI infrastructure
  manufacturing   factories, industrial process, CNC, machining, production engineering
  biotech         drug discovery, synbio, genomics, therapeutics, medtech, diagnostics
  lab_automation  automating experiments, self-driving labs, lab robotics, AI scientists
  space           launch, satellites, propulsion, in-orbit
  defence         defence, security hardware, dual-use, sovereign capability
  robotics        physical robots, humanoids, manipulation, industrial automation
  autonomy        self-driving, drones, UAV, marine/aerial autonomy
  materials       novel materials, composites, coatings, critical minerals, metallurgy
  hardware_other  physical/electronic hardware not covered above
  science         academic research, instrumentation, fundamental science

  Be precise, not generous. An empty list is correct for recruiters, generic SaaS, consultants,
  marketers, finance and retail. Software alone is NOT deeptech — a backend engineer at a fintech
  gets []. An ML engineer at a chip company gets [compute].

roleType: founder | engineer | researcher | investor | policy | operator | student | other
seniority: junior | mid | senior | exec

rivanGroup — staffing for one dinner. Exactly one, or "none":
  rivan             works at Rivan Industries
  top_founder       founder/CEO of an established, funded, credible deeptech company
  early_eng_founder founder of a very early (pre-seed/seed) company with a hands-on engineering role
  senior_engineer   senior/staff/principal/lead engineer, NOT a founder
  postdoc           holds or is completing a doctorate AND in a research role
  recent_grad       finished study in the last ~2 years, early-career
  policy_misc       government, regulator, research council, think tank, policy or public-sector
                    innovation. Judge by EMPLOYER as much as title — someone at UKRI, Innovate UK,
                    DSIT, the Royal Academy of Engineering, Onward or a think tank counts even if
                    their title never says "policy".
  vc                investor at a fund, angel, or venture capital firm
  deeptech_operator commercial, ops, BD, product or general management at a deeptech company —
                    a COO of a robotics firm or a country director at a nuclear company is a
                    serious ecosystem contact even though they are not an engineer or founder
  deeptech_ic       individual-contributor engineer or scientist at a deeptech company who is not
                    senior enough for senior_engineer — the body of the expo, and future speakers
  none              genuinely not of interest — not deeptech, or too little to tell

  "none" must mean uninteresting, NOT merely "does not fit a dinner row". Anyone doing real
  deeptech work belongs in one of the groups above.

isDeeptech: true if they work in or directly on a deeptech field, else false.
confidence: 0-1. Be honest — thin input deserves a low score.
evidence: at most 12 words citing what drove the call.

Judgement notes:
- Distinguish postdoc from recent_grad by whether the doctorate is done/near-done and whether the
  role is research. A 2025 master's graduate in a junior job is recent_grad, not postdoc.
- A founder who is also an engineer at a seed-stage company is early_eng_founder, not senior_engineer.
- Prefer "none" and low confidence over a flattering guess. A wrong invite costs more than a miss.

Return ONLY a JSON array, one object per input, each including the "slug" you were given, in order.
No prose.`

export async function classifyPeople(candidates: CandidateInput[]): Promise<ClassifiedPerson[]> {
  const fallback = (reason: string): ClassifiedPerson[] =>
    candidates.map((c) => ({
      slug: c.slug,
      pillars: [],
      roleType: 'other' as const,
      seniority: 'mid' as const,
      rivanGroup: 'none' as const,
      isDeeptech: false,
      confidence: 0,
      evidence: reason,
    }))

  if (!candidates.length) return []
  if (!process.env.ANTHROPIC_API_KEY) return fallback('ANTHROPIC_API_KEY not set')

  const client = new Anthropic()

  const payload = candidates.map((c) => ({
    slug: c.slug,
    name: c.name ?? null,
    headline: c.headline ?? null,
    company: c.company ?? null,
    sector: c.scannerSector ?? null,
    location: c.location ?? null,
    about: c.about ?? null,
    education: c.education ?? null,
    followers: c.followers ?? null,
  }))

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: JSON.stringify(payload) }],
    })

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) return fallback('no JSON array in response')

    const parsed = JSON.parse(match[0]) as Array<Partial<ClassifiedPerson>>
    const bySlug = new Map(parsed.filter((r) => typeof r.slug === 'string').map((r) => [r.slug as string, r]))

    return candidates.map((c) => {
      const r = bySlug.get(c.slug)
      if (!r) return { ...fallback('missing from response')[0], slug: c.slug }
      const pillars = (Array.isArray(r.pillars) ? r.pillars : []).filter((p): p is Pillar => PILLARS.includes(p as Pillar))
      return {
        slug: c.slug,
        pillars: pillars.slice(0, 3),
        roleType: ROLE_TYPES.includes(r.roleType as RoleType) ? (r.roleType as RoleType) : 'other',
        seniority: (['junior', 'mid', 'senior', 'exec'] as const).includes(r.seniority as any) ? (r.seniority as any) : 'mid',
        rivanGroup: RIVAN_GROUPS.includes(r.rivanGroup as RivanGroup) ? (r.rivanGroup as RivanGroup) : 'none',
        isDeeptech: Boolean(r.isDeeptech),
        confidence: typeof r.confidence === 'number' ? r.confidence : 0,
        evidence: typeof r.evidence === 'string' ? r.evidence : '',
      }
    })
  } catch (error) {
    console.error('[people-classifier]', error)
    return fallback(error instanceof Error ? error.message : 'classification failed')
  }
}
