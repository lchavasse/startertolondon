---
title: "feat: Event sector tagging + KB ingestion loop"
type: feat
status: in-progress
date: 2026-05-09
branch: feat/event-sector-tagging
---

# Event sector tagging + KB ingestion loop

## Overview

Tag every curated event against a fixed 12-sector taxonomy so `/events` can be filtered (ai, bio, hardware, etc.). Use the tagging work as a **KB ingestion loop**: events from organisers already in the KB inherit sectors deterministically; events from unknown organisers are tagged by an LLM and surface their organiser as a candidate for promotion into `event_series`. Once promoted, all past + future events from that source flip to deterministic inheritance — the loop compounds.

## Problem Frame

`LondonEvent.tags` today is just the calendar name (`["Superteam"]`). It powers a degenerate filter chip on `/events` that nobody uses. There is no way to say "show me only bio events" or "only AI hackathons", and there is no link between events and the KB (`event_series`, `communities`, `people`) that already carries `sectors[]` columns.

We want both:

- **User-visible**: a sector filter on `/events`.
- **Data-side**: a virtuous loop where tagging events teaches us about the organisers, and the KB grows toward full coverage of the curated source list. Once an organiser is in `event_series`, future events inherit for free — no LLM call, no drift.

## Requirements Trace

- **R1** Curated events get `sectorTags: Sector[]` (1–3 from the fixed list, or empty).
- **R2** `/events` exposes multi-select sector chips; events with no tag bucket under "uncategorised" (off by default).
- **R3** KB-first: if event source matches an `event_series` row (via `luma_cal_ids`, `luma_user_ids`, `eventbrite_organiser_ids`, `meetup_group_ids`) or a `community` row, tags inherit deterministically — no LLM call.
- **R4** LLM fallback: orphan events (no KB match) are tagged by Haiku using `name + organiser + description`. Description is fetched once from the Luma event API and cached in Redis.
- **R5** Every LLM-tagged event upserts a row into `kb:event-series-candidates` keyed by `calendarSlug || organiserName` — accumulating `eventCount`, `sampleEventIds`, `suggestedSectors` (majority vote).
- **R6** A `/promote-organisers` skill walks the candidate queue ranked by `eventCount`, lets the user accept/skip/reject, writes `docs/kb-seeds/<date>-event-series.md` entries on accept (mirrors `/review-events`).
- **R7** After `npm run seed:kb`, `npm run retag-events` re-applies KB inheritance over all curated events in Redis — past events from a newly-promoted organiser flip from LLM to deterministic without re-spending LLM tokens.
- **R8** Re-running the cron on the same event is idempotent: tagging results cache by `event_id` so we don't double-spend.
- **R9** The taxonomy is a single source of truth (`src/lib/sectors.ts`) used by the tagger prompt, the UI chips, and any future KB tooling.

## Scope Boundaries

**In scope**

- 12-sector taxonomy constant
- `LondonEvent.sectorTags` field (additive; existing `tags` left alone for backwards compat)
- KB inheritance matcher (Supabase one-shot load → in-memory map → per-event lookup)
- Luma event description fetcher with Redis cache
- Haiku sector tagger (mirrors `event-ranker.ts`)
- Cron orchestration: inherit → fallback → upsert candidates
- Per-event sector cache (idempotency)
- `/events` sector chip filter UI
- `kb:event-series-candidates` Redis structure
- `/promote-organisers` skill
- `npm run retag-events` CLI

**Out of scope**

- `/explore` entity → events linking ("upcoming events on this community page")
- Sector landing pages (`/explore?sector=ai`)
- NL search / embedding-based matching (we ignore the existing `event_series.embedding` column for now)
- Auto-promoting candidates without human review
- Event description storage on every event (only orphans get descriptions cached)
- Migrating events to Supabase
- Re-tagging via Supabase trigger or scheduled cron (manual `retag-events` only)

## Decisions (locked)

| Decision | Choice |
|---|---|
| Taxonomy | Fixed 12: `ai, bio, hardware, robotics, climate, fintech, crypto, creative, devtools, science, healthtech, deeptech` |
| Storage | Redis JSON (existing pattern) — `LondonEvent.sectorTags: Sector[]` |
| Tag source | KB-first (deterministic) → Haiku LLM fallback for orphans |
| Description fetch | Only for orphan events that hit the LLM; cached in Redis (`event:desc:<id>`, 60d TTL) |
| Promotion path | New `kb:event-series-candidates` Redis bucket + `/promote-organisers` skill → `docs/kb-seeds/*.md` → `npm run seed:kb` |
| First-pass UI scope | `/events` sector chips only — no `/explore` wiring this round |

## Architecture

```
Vercel Cron (daily)
  → runAllScrapers()
  → dedup + cross-platform reconciliation
  → split: curated vs non-curated
  │
  └── for each curated event:
       ├── KB inheritance lookup (in-memory map, single supabase load)
       │     hit  → event.sectorTags = event_series.sectors (or community.sectors)
       │     miss ↓
       │
       ├── check event:sectors:<id> cache → if cached, use it (idempotency)
       │
       ├── fetch + cache event description (Luma API)
       │
       ├── batch into Haiku sector-tagger (size 20)
       │     → event.sectorTags + confidence
       │     → cache event:sectors:<id>
       │
       └── upsertCandidate({ key, eventCount++, sampleEventIds, suggestedSectors })
  │
  → saveEvents() to events:london

Manual loop:
  /promote-organisers
    → listCandidates() ranked by eventCount
    → user accepts → write to docs/kb-seeds/<date>-event-series.md
    → npm run seed:kb (existing)
    → npm run retag-events (new) → re-applies KB inheritance over events:london
```

## File-level changes

**New:**

| File | Purpose |
|---|---|
| `src/lib/sectors.ts` | `SECTORS` constant + `Sector` type + per-sector descriptions (consumed by tagger prompt + UI) |
| `src/lib/scrapers/sector-inheritance.ts` | `loadInheritanceMap()` → `match(event) → Sector[] \| null` |
| `src/lib/scrapers/luma-event-fetch.ts` | `fetchEventDescription(eventId)` with Redis cache |
| `src/lib/llm/sector-tagger.ts` | Haiku tagger, batched, prompt-cached, fail-soft (mirrors `event-ranker.ts`) |
| `src/lib/kv-candidates.ts` | `upsertCandidate / listCandidates / rejectCandidate / removeCandidate` |
| `src/lib/scrapers/sector-pipeline.ts` | Glue that runs inheritance → fallback → candidates and stamps `sectorTags` |
| `scripts/retag-events.ts` | CLI re-runs KB inheritance over `events:london` |
| `.claude/skills/promote-organisers/SKILL.md` | Skill instructions |
| `.claude/skills/promote-organisers/script.ts` | Interactive runner (mirrors `review-events`) |

**Modified:**

| File | Change |
|---|---|
| `src/lib/types.ts` | Add `sectorTags?: Sector[]` to `LondonEvent` |
| `src/lib/scrapers/index.ts` | Wire `sector-pipeline.ts` after dedup, before save |
| `src/lib/kv.ts` | (only if needed) ensure `getEvents()` round-trips `sectorTags` |
| `src/components/EventGrid*` | Replace tag chips with `SECTORS`-driven multi-select |
| `src/app/events/page.tsx` | Drop `flatMap(e.tags)`, pass `SECTORS` |
| `package.json` | `"retag-events": "tsx scripts/retag-events.ts"` |

## Tagger prompt shape

Mirrors `src/lib/llm/event-ranker.ts`:

- Model: `claude-haiku-4-5-20251001`
- System prompt (cached): 12 sector definitions, "1–3 tags max, default to fewer", "if confidence < 0.5 return empty array", behavioural examples ("AI Demo Day" → `[ai]`, "Longevity London Hack" → `[bio, ai]` if AI is involved).
- Few-shot block (cached): hand-written examples mapping `name + organiser + description` → sectors. Maintained as part of the repo and refreshed when we see misclassification.
- Tool: `tag_events({ tagged: [{ eventId, sectors: Sector[], confidence: number }] })`.
- Batch size: 20.
- Fail-soft: API error → `sectorTags: []`, candidate still upserted with empty `suggestedSectors`.

## /events UI

- Top of grid: chip row ordered by `SECTORS` constant.
- Click `ai` → filters; click `bio` → adds (union: events matching ≥1 selected chip).
- Empty `sectorTags` → events appear under a separate "uncategorised" pseudo-chip, off by default during rollout (avoids cluttering the feed before tagging coverage is good).
- Drop existing calendar-name chips entirely — they were never useful.

## KB candidate record shape

Stored as a Redis hash keyed by `kb:event-series-candidates`:

```ts
type Candidate = {
  key: string                   // calendarSlug || organiserSlug || organiserName-normalised
  organiserName: string
  organiserAvatarUrl: string | null
  lumaCalId: string | null      // populated if we resolved cal-XXXX
  firstSeenAt: string           // ISO
  lastSeenAt: string            // ISO
  eventCount: number
  sampleEventIds: string[]      // last ~5
  sampleEventNames: string[]    // last ~5
  suggestedSectors: Record<Sector, number>  // tally → majority on display
}
```

A separate `kb:event-series-rejected` set holds keys the user has dismissed so we don't re-prompt.

## Phasing

The work ships as three PRs — one branch (`feat/event-sector-tagging`), three commits. Each commit is independently revertable.

### PR 1 — Foundation: deterministic path

- `src/lib/sectors.ts`
- `LondonEvent.sectorTags` type
- `sector-inheritance.ts` matcher
- `sector-pipeline.ts` running KB-only path (LLM stub returns `[]` for orphans)
- `/events` chip UI driven by `SECTORS`
- `scripts/retag-events.ts` (KB-only re-run)

**Result**: events from KB-known organisers tag immediately; rest are "uncategorised". Validates the matcher logic against real KB rows. Zero LLM spend.

### PR 2 — LLM fallback + candidate queue

- `luma-event-fetch.ts` description fetcher with Redis cache
- `sector-tagger.ts` Haiku tagger
- `kv-candidates.ts`
- Wire LLM into `sector-pipeline.ts` and candidate upsert
- Per-event idempotency cache (`event:sectors:<id>`)

**Result**: orphan events get LLM tags + their organisers populate the candidate queue.

### PR 3 — Promotion skill

- `.claude/skills/promote-organisers/SKILL.md` + `script.ts`
- `kb:event-series-rejected` set
- `retag-events.ts` extended to refresh post-promotion

**Result**: closes the loop end to end. User can drain the candidate queue weekly.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| KB coverage low → many "uncategorised" after PR 1 | Expected and informative — surfaces exactly which sources need promotion in PR 3 |
| LLM tagger drift / miscategorisation | Confidence threshold + curated few-shot block. Re-run `retag-events` after editing prompt to re-tag all orphans |
| Description fetch rate-limited by Luma | Limited concurrency in fetcher (3 parallel max); cache TTL = 60d so we only fetch each event once |
| `event_series` rows missing matching IDs (e.g. `luma_cal_ids` not populated) | Matcher is strict on the configured arrays; promotion skill explicitly captures these IDs at accept time |
| Existing `tags` field semantics churn | We add `sectorTags` rather than repurpose `tags` — old field stays, no migration |
| Cron job time bloats | LLM only on orphans; first cron after deploy will be slowest, then drops as KB grows |

## Cost estimate

- ~50 orphan events/day × 1 Haiku call (batched 20) = ~3 API calls/day
- ~200 input tokens + ~150 output per event = pennies per day
- Description fetches: ~50/day, cached. Within Luma scrape patterns we already use.

## Out of band notes

- `event_series.embedding` exists but unused — leaves the door open for semantic-match v2 later.
- The matcher's precedence is `luma_cal_ids → luma_user_ids → eventbrite_organiser_ids → meetup_group_ids → community.events_url`. First hit wins.
- Sectors live on both `event_series.sectors` and `communities.sectors`. Series wins when both match (tighter scope).
