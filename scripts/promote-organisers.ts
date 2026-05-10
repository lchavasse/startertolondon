/**
 * Promote orphan organisers (LLM-tagged events with no KB match) into
 * `event_series` rows.
 *
 * Two phases (mirrors `review-events`):
 *
 *   1. List (default):
 *      npm run promote-organisers
 *      npm run promote-organisers -- --limit 30
 *
 *      Prints ranked candidates as JSON to stdout (most-observed first).
 *      The chat agent reads this, walks the user through each, collects
 *      acceptances + slugs/names/sectors.
 *
 *   2. Apply:
 *      npm run promote-organisers -- --apply /tmp/promotions.json
 *
 *      Reads a JSON array of decisions and:
 *        - accepts → append YAML block to a fresh `docs/kb-seeds/<date>-promoted-event-series.md`
 *          (or merge into an existing path with --out)
 *        - rejects → add key to `kb:event-series-rejected`
 *        - skips   → leave in queue for next session
 *
 *      Decision JSON shape:
 *        [
 *          {
 *            "key": "cal-ABC...",
 *            "decision": "accept" | "reject" | "skip",
 *            "slug": "london-ai",                    // required for accept
 *            "name": "London AI",                    // required for accept
 *            "sectors": ["ai", "science"],           // required for accept
 *            "strapline": "...",                     // optional
 *            "description": "...",                   // optional
 *            "frequency": "monthly",                 // optional
 *            "format": "talks",                      // optional
 *            "website": "https://...",               // optional
 *            "extraIds": {                            // optional override
 *              "luma_cal_ids": ["cal-XXX"],
 *              "luma_user_ids": [],
 *              "eventbrite_organiser_ids": [],
 *              "meetup_group_ids": []
 *            }
 *          }
 *        ]
 */
import { writeFileSync, existsSync, appendFileSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  listCandidates,
  rejectCandidate,
  removeCandidate,
  type Candidate,
} from '../src/lib/kv-candidates'
import { isSector, type Sector } from '../src/lib/sectors'

interface Decision {
  key: string
  decision: 'accept' | 'reject' | 'skip'
  slug?: string
  name?: string
  sectors?: string[]
  strapline?: string
  description?: string
  frequency?: string
  format?: string
  website?: string
  extraIds?: {
    luma_cal_ids?: string[]
    luma_user_ids?: string[]
    eventbrite_organiser_ids?: string[]
    meetup_group_ids?: string[]
  }
}

function inferIds(c: Candidate, override?: Decision['extraIds']) {
  const ids = {
    luma_cal_ids: override?.luma_cal_ids ?? (c.lumaCalId ? [c.lumaCalId] : []),
    luma_user_ids: override?.luma_user_ids ?? [],
    eventbrite_organiser_ids: override?.eventbrite_organiser_ids ?? [],
    meetup_group_ids: override?.meetup_group_ids ?? [],
  }
  // If the source kind tells us which array to populate from the candidate key,
  // use it as a default — caller can still override via decision.extraIds.
  if (!override) {
    if (c.sourceKind === 'luma-user' && c.key.startsWith('usr-')) {
      ids.luma_user_ids.push(c.key)
    } else if (c.sourceKind === 'meetup' && !c.key.startsWith('cal-')) {
      ids.meetup_group_ids.push(c.key)
    } else if (c.sourceKind === 'eventbrite' && !c.key.startsWith('cal-')) {
      ids.eventbrite_organiser_ids.push(c.key)
    }
  }
  return ids
}

function topSectors(c: Candidate, limit = 3): Sector[] {
  const entries = Object.entries(c.suggestedSectors)
    .filter(([s]) => isSector(s))
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, limit)
    .map(([s]) => s as Sector)
  return entries
}

async function runList(limit: number) {
  const candidates = await listCandidates()
  if (candidates.length === 0) {
    console.log(JSON.stringify({ candidates: [], message: 'No candidates to promote.' }, null, 2))
    return
  }

  const presented = candidates.slice(0, limit).map((c) => ({
    key: c.key,
    organiserName: c.organiserName,
    organiserAvatarUrl: c.organiserAvatarUrl,
    sourceKind: c.sourceKind,
    lumaCalId: c.lumaCalId,
    eventCount: c.eventCount,
    firstSeenAt: c.firstSeenAt,
    lastSeenAt: c.lastSeenAt,
    sampleEventIds: c.sampleEventIds,
    sampleEventNames: c.sampleEventNames,
    suggestedSectors: c.suggestedSectors,
    topSectors: topSectors(c),
  }))

  console.log(
    JSON.stringify(
      {
        candidatesTotal: candidates.length,
        presented: presented.length,
        candidates: presented,
      },
      null,
      2
    )
  )
}

function renderYamlBlock(c: Candidate, d: Decision): string {
  const slug = d.slug!
  const ids = inferIds(c, d.extraIds)
  const sectors = (d.sectors ?? topSectors(c)).filter(isSector)

  const lines: string[] = []
  lines.push(`## event_series: ${slug}`)
  lines.push('')
  lines.push('```yaml')
  lines.push(`name: ${d.name!}`)
  if (d.strapline) lines.push(`strapline: ${JSON.stringify(d.strapline).slice(1, -1)}`)
  if (d.description) {
    lines.push('description: |')
    for (const line of d.description.split('\n')) lines.push(`  ${line}`)
  }
  if (d.frequency) lines.push(`frequency: ${d.frequency}`)
  if (d.format) lines.push(`format: ${d.format}`)
  if (d.website) lines.push(`website: ${d.website}`)
  if (sectors.length > 0) lines.push(`sectors: [${sectors.join(', ')}]`)
  if (ids.luma_cal_ids.length > 0) lines.push(`luma_cal_ids: [${ids.luma_cal_ids.join(', ')}]`)
  if (ids.luma_user_ids.length > 0) lines.push(`luma_user_ids: [${ids.luma_user_ids.join(', ')}]`)
  if (ids.eventbrite_organiser_ids.length > 0) {
    lines.push(`eventbrite_organiser_ids: [${ids.eventbrite_organiser_ids.join(', ')}]`)
  }
  if (ids.meetup_group_ids.length > 0) {
    lines.push(`meetup_group_ids: [${ids.meetup_group_ids.join(', ')}]`)
  }
  lines.push('```')
  lines.push('')
  return lines.join('\n')
}

function defaultOutPath(): string {
  const today = new Date().toISOString().slice(0, 10)
  return resolve(process.cwd(), `docs/kb-seeds/${today}-promoted-event-series.md`)
}

async function runApply(decisionsPath: string, outPath: string) {
  const raw = readFileSync(decisionsPath, 'utf8')
  const decisions = JSON.parse(raw) as Decision[]
  if (!Array.isArray(decisions)) throw new Error('Decisions file must be a JSON array')

  const candidates = await listCandidates()
  const candidatesByKey = new Map(candidates.map((c) => [c.key, c]))

  const fileExists = existsSync(outPath)
  const fileBlocks: string[] = []
  let accepted = 0
  let rejected = 0
  let skipped = 0
  const refused: string[] = []

  for (const d of decisions) {
    const c = candidatesByKey.get(d.key)
    if (!c) {
      console.log(`  [skip ${d.key}] not in candidate queue (already promoted?)`)
      refused.push(d.key)
      continue
    }
    if (d.decision === 'skip') {
      skipped++
      continue
    }
    if (d.decision === 'reject') {
      await rejectCandidate(d.key)
      rejected++
      console.log(`  [reject] ${c.organiserName} (${c.eventCount} events)`)
      continue
    }
    if (d.decision === 'accept') {
      if (!d.slug || !d.name) {
        console.log(`  [refuse ${d.key}] accept requires slug + name`)
        refused.push(d.key)
        continue
      }
      const block = renderYamlBlock(c, d)
      fileBlocks.push(block)
      await removeCandidate(d.key)
      accepted++
      console.log(`  [accept] ${c.organiserName} → event_series: ${d.slug}`)
    }
  }

  if (fileBlocks.length > 0) {
    const header = fileExists
      ? '\n'
      : `# Promoted event series — ${new Date().toISOString().slice(0, 10)}\n\nGenerated by \`promote-organisers\`. Run \`npm run seed:kb -- ${outPath}\` to apply, then \`npm run retag-events\` to flip past events to KB inheritance.\n\n`
    const payload = header + fileBlocks.join('\n')
    if (fileExists) {
      appendFileSync(outPath, payload, 'utf8')
    } else {
      writeFileSync(outPath, payload, 'utf8')
    }
    console.log(`\nWrote ${fileBlocks.length} block(s) to ${outPath}`)
    console.log(`Next: npm run seed:kb -- ${outPath} && npm run retag-events`)
  }

  console.log(
    `\n${accepted} accepted · ${rejected} rejected · ${skipped} skipped${refused.length ? ` · ${refused.length} refused` : ''}`
  )
}

async function main() {
  const args = process.argv.slice(2)
  const applyIdx = args.indexOf('--apply')
  if (applyIdx !== -1) {
    const path = args[applyIdx + 1]
    if (!path) throw new Error('--apply requires a file path')
    const outIdx = args.indexOf('--out')
    const outPath = outIdx !== -1 ? resolve(args[outIdx + 1]!) : defaultOutPath()
    await runApply(path, outPath)
    return
  }

  const limitIdx = args.indexOf('--limit')
  const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1] ?? '20', 10) : 20
  await runList(limit)
}

main().catch((err) => {
  console.error(err.message ?? err)
  process.exit(1)
})
