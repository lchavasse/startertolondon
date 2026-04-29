/**
 * Review queue CLI for non-allowlisted EB/Meetup events.
 *
 * Two phases:
 *
 *   1. Rank (default):
 *      npm run review-events
 *      npm run review-events -- --limit 30
 *
 *      Prints ranked candidates as JSON to stdout. The chat agent reads this,
 *      walks the user through each event, and collects decisions.
 *
 *   2. Apply:
 *      npm run review-events -- --apply /tmp/decisions.json
 *
 *      Reads a JSON array of decisions and persists them.
 *      Decision JSON shape:
 *        [
 *          { "id": "meetup-123", "decision": "feature" | "list" | "reject" | "trust-organiser", "reason"?: "..." }
 *        ]
 *
 *      Effects per decision:
 *        feature          → events:manual (curated: true, pending: false), remove from pending, append to decisions log
 *        list             → events:manual (curated: false, pending: false), remove from pending, append to decisions log
 *        reject           → events:blocklist, remove from pending, append to decisions log
 *        trust-organiser  → sources:eb-meetup-allowlist (event's calendarSlug), then treated as 'list'
 */
import { readFileSync } from 'node:fs'
import {
  getPendingReview,
  removeFromPendingReview,
  getRecentDecisions,
  appendDecision,
  addManualEvent,
  addToBlocklist,
  addToEbMeetupAllowlist,
} from '../src/lib/kv'
import { rankEvents, type RankedEvent } from '../src/lib/llm/event-ranker'
import type { LondonEvent, ReviewDecision, EventDecision } from '../src/lib/types'

interface DecisionInput {
  id: string
  decision: ReviewDecision | 'trust-organiser'
  reason?: string
}

const RECENT_DECISIONS_FOR_FEW_SHOT = 30

async function runRank(limit: number) {
  const [pending, recentDecisions] = await Promise.all([
    getPendingReview(),
    getRecentDecisions(RECENT_DECISIONS_FOR_FEW_SHOT),
  ])

  if (pending.length === 0) {
    console.log(JSON.stringify({ events: [], message: 'Nothing to review.' }, null, 2))
    return
  }

  // Take up to `limit` events. Order: chronological (closest first) — gives natural priority.
  const slice = pending.slice(0, limit)
  const ranked = await rankEvents(slice, recentDecisions)
  const rankedById = new Map(ranked.map((r) => [r.eventId, r]))

  // Sort by score desc, falling back to chronological for ties.
  const annotated = slice
    .map((event) => {
      const r = rankedById.get(event.id) ?? fallback(event)
      return { ...r, event }
    })
    .sort((a, b) => b.score - a.score)

  const output = {
    pendingTotal: pending.length,
    presented: annotated.length,
    decisionsInContext: recentDecisions.length,
    events: annotated.map(({ event, score, reason, suggestedDecision }) => ({
      id: event.id,
      name: event.name,
      url: event.url,
      organiser: event.organiserName || event.calendarSlug || '',
      calendarSlug: event.calendarSlug,
      source: event.source,
      startAt: event.startAt,
      timezone: event.timezone,
      locationName: event.locationName,
      coverUrl: event.coverUrl,
      tags: event.tags,
      score,
      reason,
      suggestedDecision,
    })),
  }
  console.log(JSON.stringify(output, null, 2))
}

function fallback(event: LondonEvent): RankedEvent {
  return { eventId: event.id, score: 0.5, reason: '(no ranker output)', suggestedDecision: 'list' }
}

async function runApply(decisionsPath: string) {
  const raw = readFileSync(decisionsPath, 'utf8')
  const decisions = JSON.parse(raw) as DecisionInput[]
  if (!Array.isArray(decisions)) throw new Error('Decisions file must be a JSON array')

  const pending = await getPendingReview()
  const pendingById = new Map(pending.map((e) => [e.id, e]))

  let featured = 0
  let listed = 0
  let rejected = 0
  let trusted = 0
  const skipped: string[] = []

  for (const d of decisions) {
    const event = pendingById.get(d.id)
    if (!event) {
      console.log(`  [skip ${d.id}] not in pending queue (already decided?)`)
      skipped.push(d.id)
      continue
    }

    let finalDecision: ReviewDecision
    let trustedThisEvent = false

    if (d.decision === 'trust-organiser') {
      const slug = event.calendarSlug
      if (!slug) {
        console.log(`  [refuse ${d.id}] no calendarSlug — cannot allowlist this organiser`)
        skipped.push(d.id)
        continue
      }
      await addToEbMeetupAllowlist(slug)
      trusted++
      trustedThisEvent = true
      finalDecision = 'list' // implicitly listed (visible, no badge)
    } else {
      finalDecision = d.decision
    }

    const decisionRecord: EventDecision = {
      id: event.id,
      name: event.name,
      organiser: event.organiserName || event.calendarSlug || '',
      decision: finalDecision,
      reason: d.reason,
      timestamp: new Date().toISOString(),
    }

    if (finalDecision === 'feature') {
      await addManualEvent({ ...event, curated: true, pending: false })
      featured++
    } else if (finalDecision === 'list') {
      await addManualEvent({ ...event, curated: false, pending: false })
      if (!trustedThisEvent) listed++
    } else if (finalDecision === 'reject') {
      await addToBlocklist(event.id)
      rejected++
    }

    await Promise.all([
      removeFromPendingReview(event.id),
      appendDecision(decisionRecord),
    ])

    const tag = trustedThisEvent
      ? '[trust+list]'
      : finalDecision === 'feature'
        ? '[feature]'
        : finalDecision === 'list'
          ? '[list]'
          : '[reject]'
    console.log(`  ${tag} ${event.name}${d.reason ? ` — ${d.reason}` : ''}`)
  }

  console.log(`\n${featured} featured · ${listed} listed · ${rejected} rejected · ${trusted} trusted${skipped.length ? ` · ${skipped.length} skipped` : ''}`)
}

async function main() {
  const args = process.argv.slice(2)
  const applyIdx = args.indexOf('--apply')
  if (applyIdx !== -1) {
    const path = args[applyIdx + 1]
    if (!path) throw new Error('--apply requires a file path')
    await runApply(path)
    return
  }

  const limitIdx = args.indexOf('--limit')
  const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1] ?? '20', 10) : 20
  await runRank(limit)
}

main().catch((err) => {
  console.error(err.message ?? err)
  process.exit(1)
})
