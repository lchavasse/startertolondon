// Fit weighting for DeepTech London events, shared by the shortlist, the export and the explorer so
// they can never drift apart.
//
// Calibrated on Rivan Industries, the dinner host: modular synthetic fuel plants, industrial-process,
// is_physical=1, industrial_score 76, Series A. The room is people who build physical things, so
// pillars split into Rivan's own world and adjacent fields, and the scanner's verdict on a company
// outranks the classifier's inferred pillar — it has actually looked at what the company builds.

export const CORE = new Set([
  'manufacturing', 'materials', 'energy', 'hardware_other', 'robotics', 'space', 'defence', 'autonomy', 'lab_automation',
])
export const ADJACENT = new Set(['compute', 'science'])

export interface FitInput {
  seniority?: string | null
  location?: string | null
  confidence?: number | null
  is_physical?: number | null
  industrial_score?: number | null
  company_norm?: string | null
  is_connection?: number | boolean | null
  last_message_at?: string | null
}

export function fitScore(r: FitInput, pillars: string[]): { fit: number; why: string[] } {
  const why: string[] = []
  let fit = 0

  const core = pillars.filter((p) => CORE.has(p)).length
  const adj = pillars.filter((p) => ADJACENT.has(p)).length
  if (core) { fit += 100 + (core - 1) * 25; why.push(`${core} core pillar${core > 1 ? 's' : ''}`) }
  else if (adj) { fit += 45; why.push('adjacent field') }
  else { fit += 10 }

  if (r.is_physical === 1) { fit += 120; why.push('builds physical things') }
  else if (r.is_physical === 0) { fit -= 60; why.push('not a physical company') }
  if (typeof r.industrial_score === 'number') { fit += Math.round(r.industrial_score * 0.8); why.push(`industrial ${r.industrial_score}`) }
  if (r.company_norm && r.is_physical == null) fit -= 15

  if (r.seniority === 'exec' || r.seniority === 'senior') fit += 25
  if (/London/i.test(r.location ?? '')) { fit += 40; why.push('London') }
  else if (/United Kingdom|England|Scotland|Wales/i.test(r.location ?? '')) fit += 15
  else if (r.location) fit -= 30

  fit += Math.round((r.confidence ?? 0) * 20)

  // Reachability breaks ties only.
  if (r.last_message_at) { fit += 35; why.push('already talking') }
  else if (r.is_connection) { fit += 20; why.push('connected') }

  return { fit, why }
}
