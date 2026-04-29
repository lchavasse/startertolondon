---
date: 2026-04-29
topic: events-quality-curator
---

# Eventbrite/Meetup Quality Curator

## Problem Frame

`/events` is polluted with low-signal Eventbrite and Meetup events: spam (MLM, generic networking, yoga-with-a-tech-tag), corporate vendor pitches, and on-topic-but-low-quality events that have nothing to offer active builders. Many also have no cover image, which makes the feed look ugly. Real gems do exist on those platforms but get lost in the long tail.

The user wants to be a curator. Hand-pick highlights from EB/Meetup, follow trusted recurring series the way Luma calendars work today, and use an LLM as an assistant that surfaces candidates and learns from accept/reject decisions over time. Luma sources stay untouched — they're already well-curated.

## Requirements

- **R1.** **No-image filter**: any Eventbrite/Meetup event with `coverUrl: null` is dropped at scrape time. Cheap baseline cleanup, no LLM needed.
- **R2.** **Two-track ingestion** for EB/Meetup:
  - **Allowlist track** — a list of trusted Meetup groups + Eventbrite organisers (mirrors the existing `CALENDAR_SOURCES` pattern for Luma). Events from allowlisted sources are auto-published with `curated: false` (visible on `/events` without a badge).
  - **Review-queue track** — every other EB/Meetup event lands in a new `events:pending-review` KV path instead of `events:london`. They never reach `/events` until a human reviews them.
- **R3.** **Cross-platform dedup**: if the same event appears on both Luma and Eventbrite/Meetup (matched by name + start date + venue), the Luma version wins and the EB/Meetup duplicate is dropped before review.
- **R4.** **Review skill**: `/review-events` (a Claude Code skill, mirroring `add-events`). Pulls 10–20 candidates from `events:pending-review`, ranks them with an LLM (batched), presents one at a time inline with a 1-line reason. User replies with one of:
  - `feature` → promote to `events:london` with `curated: true`
  - `list` → promote to `events:london` with `curated: false`
  - `reject` → add to `events:blocklist`
  - `skip` → leave in queue for next session
  - Any of the above can include an optional one-line user reason.
- **R5.** **Decision log**: every review action is appended to a new `events:decisions` KV path with `{id, name, organiser, decision, reason?, timestamp}`. The log is durable and decoupled from event records, so blocked events can still be referenced by old decisions.
- **R6.** **Learning loop**: when the LLM ranks new candidates, the prompt includes the last ~30 decisions as few-shot examples ("you previously [accepted/rejected] *X* — *reason*"). Quality improves naturally as decisions accumulate; no separate training step or aggregation logic.
- **R7.** **Allowlist promotion shortcut**: during review, the user can reply `trust-organiser` (or include the verb in their reason) to add the candidate's source to the EB/Meetup allowlist. Future events from that source skip the review queue entirely.
- **R8.** **Pending queue maintenance**: events in `events:pending-review` whose `startAt` is in the past are pruned automatically on the next scrape run. No backlog accretion.

## Success Criteria

- Within 1–2 weeks of regular use, the user feels comfortable letting the LLM auto-promote events from familiar organisers — i.e. they trust the suggestions enough that the queue becomes mostly fast `feature`/`list` confirmations.
- The visual feed on `/events` looks dramatically less spammy: zero images-missing events, zero MLM/recruiter mixers.
- A typical review session takes ~5 minutes, not 30.
- No EB/Meetup event ever reaches `/events` without either (a) being from an allowlisted source, or (b) being explicitly accepted in review.

## Scope Boundaries

- **In scope**: changes to `src/lib/scrapers/eventbrite.ts`, `meetup.ts`, `index.ts` (no-image filter + route to pending queue + dedup against Luma); two new KV paths (`events:pending-review`, `events:decisions`); allowlist storage; `/review-events` skill; a `scripts/review-events.ts` primitive.
- **Out of scope (v1)**:
  - Per-organiser aggregated score table (the few-shot decision log carries enough signal; aggregation can come in v2 if needed).
  - Auto-rejection of events from known-bad organisers (soft signal via LLM context only — keep human in the loop).
  - Admin UI / `/admin` page changes — review happens entirely in Claude Code.
  - LLM filtering of Luma events.
  - Image-content quality assessment (presence vs. absence is enough; we're not judging image quality).
  - Surfacing rejected events anywhere ("just want to know it exists" was about the *listed* tier, not rejected — rejected = blocklist = invisible).

## Key Decisions

- **3-tier model** (`featured` / `listed` / `rejected`) maps cleanly onto existing state: `curated: true` / `curated: false` / `events:blocklist`. No new fields on `LondonEvent`.
- **Hide-by-default** for non-allowlist EB/Meetup events: they land in `events:pending-review`, not `events:london`. This is the cleanest guarantee that nothing reaches the public feed without explicit approval.
- **Skill-driven review, not admin UI** (per user's choice in this brainstorm).
- **Learning loop = few-shot decision log, not aggregated scores** — minimum complexity, naturally extensible. Prompt caching keeps the growing context cheap.
- **Allowlist seeding via the skill** — the `trust-organiser` reply lets the user grow the allowlist organically as they discover good sources, without needing to edit code.
- **LLM model: Haiku, batched (~20 events per call)**, JSON-structured output (rank + 1-line reason). Expected cost <$0.10 per review session at projected volume.
- **Cadence is on-demand** — no cron-driven LLM calls. The user runs `/review-events` whenever they want a review session. Background cron just keeps the pending queue populated and pruned.

## Dependencies / Assumptions

- Eventbrite scraper reliably populates `organiserName` (confirmed: `eventbrite.ts:mapEvent` line 167). Meetup scraper to be verified during planning.
- `@anthropic-ai/sdk` is **not yet** in `package.json` — needs to be added, plus `ANTHROPIC_API_KEY` env var. (Tracked under Deferred to Planning.)
- Volume estimate: ~200–400 EB+Meetup events per daily scrape today; after R1 (no-image) ~100–200; after R2 (allowlist routing) → ~50–100 land in pending-review per week. To be confirmed in planning Phase 1 by sampling actual data.

## Outstanding Questions

### Resolve Before Planning

*(None — user has resolved enough at the product level.)*

### Deferred to Planning

- **[Affects R2][Technical]** Where does the EB/Meetup allowlist live? Extending `src/lib/scrapers/sources.ts` codifies it (requires a PR per addition), or a new mutable KV path like `sources:eb-allowlist` (writeable from the skill, mirrors `sources:community`). Lean toward KV for skill-driven additions.
- **[Affects R3][Technical]** Cross-platform dedup signature: `name`-similarity + same-day + same-venue is a fuzzy match. Define the matching algorithm during planning, or accept imperfection and let the user blocklist duplicates manually for now.
- **[Affects R4, R6][Needs research]** Anthropic SDK setup: exact model, prompt-caching strategy (cache the few-shot decision log?), structured output via `tool_use` or `response_format`. The `claude-api` skill should be consulted.
- **[Affects R6][Technical]** Decision log retention — keep all forever, or window to last N? At ~5 review sessions/month, even 1k decisions is fine for context. Probably no cap in v1.
- **[Affects R7][User-facing]** Some Eventbrite events have generic / blank organiser names. What does `trust-organiser` do then? Skill needs to handle gracefully (probably refuses with a "no usable organiser to allowlist" message).
- **[Affects R1][Technical]** Confirm Meetup's `coverUrl` field is reliably populated when an image exists vs. needing a fallback to the group's default avatar.

## Next Steps

→ `/ce:plan` for structured implementation planning.
