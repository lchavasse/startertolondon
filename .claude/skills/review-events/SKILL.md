---
name: review-events
description: Review the Eventbrite/Meetup pending-review queue. The cron scrape routes non-allowlisted EB/Meetup events into events:pending-review; this skill walks the user through them with LLM-suggested rankings and persists their feature/list/reject/trust-organiser decisions. Triggers on "review events", "drain the review queue", "/review-events", "let's curate eventbrite", "go through pending events", or any request to clear the EB/Meetup review queue.
---

# Review Events

Drains the EB/Meetup review queue. The agent ranks 10–20 candidates with the LLM, walks the user through each, collects their decisions, and applies the batch.

## How it works (under the hood)

The scraper (`runAllScrapers`) splits EB/Meetup events into two paths:
- **Allowlisted sources** (in `sources:eb-meetup-allowlist`) → `events:london`, visible immediately.
- **Everything else** → `events:pending-review`, hidden from `/events` until reviewed.

Past-startAt events auto-prune from pending each scrape. Already-reviewed events (in `events:manual` or `events:blocklist`) never re-enter the queue.

This skill drives the review.

## The two-phase flow

### Phase 1 — rank

```bash
npm run review-events                # default limit 20
npm run review-events -- --limit 30
```

Outputs JSON with the full event records plus per-event `score`, `reason`, and `suggestedDecision`. The ranker uses the user's last 30 decisions as few-shot context, so quality improves with use.

If `ANTHROPIC_API_KEY` is missing or the API fails, every event comes back with `score: 0.5` and `reason: '(LLM unavailable)'` — review still works, just without sorting/suggestions.

### Phase 2 — apply

```bash
npm run review-events -- --apply /tmp/decisions.json
```

`/tmp/decisions.json` is a JSON array of decision records:

```json
[
  { "id": "meetup-12345", "decision": "feature", "reason": "great vibe, builders" },
  { "id": "eb-67890",     "decision": "reject",  "reason": "MLM-adjacent" },
  { "id": "meetup-99999", "decision": "trust-organiser" }
]
```

Effects per decision:
- `feature` → event lands in `events:manual` with `curated: true`, `pending: false` (visible on `/events` with badge)
- `list` → event lands in `events:manual` with `curated: false`, `pending: false` (visible, no badge)
- `reject` → event id added to `events:blocklist` (never resurrected by future scrapes)
- `trust-organiser` → event's `calendarSlug` (e.g. `meetup:tech-startups-in-the-pub`) added to `sources:eb-meetup-allowlist`. The event itself is treated as `list` (visible but unbadged). Future events from that source skip the queue entirely.

Skipped events (no decision in the file) stay in the queue for next session.

## Workflow

1. Run `npm run review-events` (or `--limit N`). Read the JSON output.
2. If `events: []` → tell user "Nothing to review" and stop.
3. For each event in the output (already sorted by score desc):
   - Show the user: `name`, `organiser`, `startAt` (formatted human-readable), `locationName`, `coverUrl` (note if `null`), and the LLM's `reason` + `suggestedDecision`.
   - Prompt the user with their options: `feature` / `list` / `reject` / `skip` / `trust-organiser` / `quit` (+ optional reason).
   - Wait for the user's reply. Parse the first word as the action; the rest is their reason (if any).
   - On `quit`: stop walking, proceed to apply with whatever decisions you've got.
   - On `skip`: don't include this event in the decisions array.
4. Write the collected decisions to `/tmp/review-events-<timestamp>.json`.
5. Run `npm run review-events -- --apply /tmp/review-events-<timestamp>.json`.
6. Report the summary line back to the user (`N featured · M listed · K rejected · T trusted`).

## Things to watch

- **Always present the LLM's `reason` and `suggestedDecision`** — that's the whole point of the ranker. Default the user's choice to the suggestion if they reply `y` / `yes` / `ok`.
- **Cover image: if `coverUrl` is null**, mention it explicitly. Meetup's image scraper sometimes misses real images, so `null` ≠ "this is a low-quality event". Still surface it as a soft signal — events with no images look messy in the feed.
- **`trust-organiser` is powerful**: it allowlists the entire source. Confirm with the user: "Sure you want all future events from `<calendarSlug>` to auto-publish?"
- **`trust-organiser` on an event with no `calendarSlug`** → script refuses with `[refuse <id>] no calendarSlug`. Rare; mention to user and offer `feature` / `list` / `reject` instead.
- **Mid-session crash**: if the apply step fails, the decisions file is still on disk. Re-run `--apply <file>` and the script picks up where it left off (already-applied events show as `[skip] not in pending queue`).
- **No reason needed for most decisions** — capture one only if the user volunteers it. Reasons feed the few-shot context for next session, so substantive ones ("not a builders crowd", "great recurring series") help the model learn taste.

## Rough chat shape

Aim for tight, scannable per-event prompts. Example:

```
1/15 · score 0.82 · suggested: feature
"Tech Startups in the Pub — Relaxed Networking"
organiser: meetup:tech-startups-in-the-pub-relaxed-networking
when: Wed 7 May · 18:30 BST
where: The Bridge Pub, Bermondsey
image: yes
LLM: Recurring builder-aimed networking; matches your past 'feature' decisions for similar pub-format events.

reply: feature | list | reject | skip | trust-organiser | quit
```

Give the user a one-line summary at the end ("done — 3 featured, 5 listed, 4 rejected, 1 trusted, 2 skipped"), then offer to run `npm run scrape` if they want to see the next batch immediately.
