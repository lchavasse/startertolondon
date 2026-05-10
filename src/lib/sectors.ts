/**
 * Canonical sector taxonomy for event tagging and KB entities.
 *
 * Single source of truth — used by:
 *   - the LLM tagger prompt (definitions guide the model)
 *   - the /events filter UI (chip ordering + label)
 *   - KB seeds (`event_series.sectors`, `communities.sectors` etc. should
 *     drift toward this list — values outside are tolerated but won't
 *     show up as filter chips)
 *
 * Add new sectors at the end. Renames require a backfill of stored
 * `LondonEvent.sectorTags` and KB rows.
 */

export const SECTORS = [
  'ai',
  'bio',
  'hardware',
  'robotics',
  'climate',
  'fintech',
  'crypto',
  'creative',
  'design',
  'devtools',
  'science',
  'healthtech',
  'deeptech',
] as const

export type Sector = (typeof SECTORS)[number]

const SECTOR_SET: ReadonlySet<string> = new Set(SECTORS)

export function isSector(value: string): value is Sector {
  return SECTOR_SET.has(value)
}

/**
 * Coerce a raw string array (e.g. KB `sectors` column, LLM output) into a
 * de-duplicated, lowercased Sector[] — drops anything outside the taxonomy.
 */
export function normaliseSectors(raw: readonly (string | null | undefined)[] | null | undefined): Sector[] {
  if (!raw) return []
  const seen = new Set<Sector>()
  for (const value of raw) {
    if (!value) continue
    const lower = value.toLowerCase().trim()
    if (isSector(lower)) seen.add(lower)
  }
  return [...seen]
}

/**
 * Per-sector descriptions used by the tagger prompt. Keep punchy — these
 * become part of the cached system prompt.
 */
export const SECTOR_DESCRIPTIONS: Record<Sector, string> = {
  ai: 'LLMs, agents, ML research, AI products, AI hackathons, applied AI talks',
  bio: 'biotech, synbio, longevity, neuro, life sciences',
  hardware: 'physical product, makerspace, IoT, electronics, prototyping',
  robotics: 'robots, autonomy, drones, embodied AI',
  climate: 'climate tech, energy, sustainability, decarbonisation',
  fintech: 'payments, banking, capital markets, embedded finance',
  crypto: 'web3, DeFi, blockchain, on-chain, zk',
  creative: 'media, gaming, art-x-tech, music tech, generative content',
  design: 'design engineering, industrial design, product design, UX, hardware-product design, design talks (Imperial DE, RCA, Granola-style)',
  devtools: 'infra, devex, databases, security, observability, dev platforms',
  science: 'frontier research, academic talks, lectures, named researchers',
  healthtech: 'clinical, digital health, medtech, care delivery',
  deeptech: 'frontier topics like quantum, space, materials, photonics, novel physics — NOT generic VC/founder events with "deep tech" in the title',
}

export const SECTOR_LABELS: Record<Sector, string> = {
  ai: 'AI',
  bio: 'Bio',
  hardware: 'Hardware',
  robotics: 'Robotics',
  climate: 'Climate',
  fintech: 'Fintech',
  crypto: 'Crypto',
  creative: 'Creative',
  design: 'Design',
  devtools: 'Devtools',
  science: 'Science',
  healthtech: 'Healthtech',
  deeptech: 'Deeptech',
}
