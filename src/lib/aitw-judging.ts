// Judging criteria for Agents in the Wild — four equally-weighted axes, each
// scored 0–25 (100 total), mirroring the criteria on the landing page.
// Kept free of the Supabase client so it can be imported by client components.

export const JUDGING_CRITERIA = [
  { key: 'innovation', label: 'Innovation', desc: 'Novel, inspired, weird in the right way?' },
  { key: 'impact', label: 'Impact', desc: 'A real, hard, or civilisational problem?' },
  { key: 'progress', label: 'Progress', desc: 'What did they actually achieve in two weeks?' },
  { key: 'deployment', label: 'Deployment', desc: 'Did it get out of the lab into the world?' },
] as const

export type CriterionKey = (typeof JUDGING_CRITERIA)[number]['key']

export const CRITERION_KEYS: readonly string[] = JUDGING_CRITERIA.map((c) => c.key)

export const MAX_SCORE = 25

export function judgeSlug(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}
