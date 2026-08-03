// Shared name normalisation for the CRM staging join. The scanner loader and the LinkedIn loader
// each build their own SQLite table, then match on name_norm / name_tokens across them — so the two
// sides must normalise identically or the join silently under-matches. Keep this the single
// implementation; do not inline a variant in a loader.

const LEGAL_SUFFIXES = new Set([
  'ltd',
  'limited',
  'inc',
  'llc',
  'plc',
  'gmbh',
  'sa',
  'bv',
  'ag',
  'co',
  'corp',
  'corporation',
  'holdings',
  'group',
  'uk',
])

const STOPWORDS = new Set([
  'the',
  'and',
  'of',
  'for',
  'labs',
  'technologies',
  'tech',
  'systems',
  'solutions',
  'ai',
])

function tokenise(value: string | null | undefined): string[] {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
}

// Suffixes are only stripped from the end, and only while something meaningful remains — otherwise
// "Group Ltd" normalises to nothing and collides with every other empty key.
function stripLegalSuffixes(tokens: string[]): string[] {
  const kept = [...tokens]
  while (kept.length > 1 && LEGAL_SUFFIXES.has(kept[kept.length - 1])) kept.pop()
  return kept
}

export function normaliseName(value: string | null | undefined): string {
  return stripLegalSuffixes(tokenise(value)).join('')
}

export function nameTokens(value: string | null | undefined): string {
  const tokens = stripLegalSuffixes(tokenise(value))
  const significant = tokens.filter((token) => !STOPWORDS.has(token))
  return (significant.length ? significant : tokens).join(' ')
}
