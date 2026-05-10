---
name: promote-organisers
description: Drain the KB candidate queue — orphan event organisers (not yet in `event_series`) accumulated by the sector tagger. Walks user through ranked candidates and writes accepted ones to `docs/kb-seeds/<date>-promoted-event-series.md` for `npm run seed:kb`. Triggers on "promote organisers", "drain candidate queue", "/promote-organisers", "let's add some event series", "go through KB candidates", or any request to grow the event_series KB from observed events.
---

# Promote Organisers

Drains `kb:event-series-candidates` — Redis bucket the cron sector tagger writes to whenever it LLM-tags an orphan event (one whose source has no `event_series` or `community` row in the KB yet). The skill walks the user through the highest-volume orphans and turns them into real KB rows.

Think of it as the right half of the event-tagging loop:

```
cron tags orphan event → upserts candidate
                                ↓
                      [you, periodically]
                                ↓
        /promote-organisers → docs/kb-seeds/*.md → seed:kb
                                ↓
                    retag-events → events flip to KB inheritance
                                ↓
                  cron stops calling LLM for that source
```

## How it works (under the hood)

Each cron run:
1. Curated events that don't match an `event_series` luma_cal_ids / luma_user_ids / eventbrite_organiser_ids / meetup_group_ids array (or a community by events_url) are sent to the LLM tagger.
2. Whatever the LLM returns is cached under `event:sectors:<id>` (no re-spend on next cron) AND the organiser is upserted into `kb:event-series-candidates` with running `eventCount`, `sampleEventIds`, and a `suggestedSectors` tally.

The candidate queue is the inbox you drain here.

## The two-phase flow

### Phase 1 — list

```bash
npm run promote-organisers              # default limit 20
npm run promote-organisers -- --limit 30
```

Outputs JSON with each candidate's organiser name, source kind, observed cal-id (if any), event count, sample event IDs/names, and a `topSectors` array (the LLM's most-frequent suggestions for this organiser, majority-voted).

If the queue is empty: `{"candidates": [], "message": "No candidates to promote."}` — tell user "Nothing to promote" and stop.

### Phase 2 — apply

```bash
npm run promote-organisers -- --apply /tmp/promotions.json
# or with explicit output file:
npm run promote-organisers -- --apply /tmp/promotions.json --out docs/kb-seeds/2026-05-09-promoted.md
```

`/tmp/promotions.json` is a JSON array of decisions:

```json
[
  {
    "key": "cal-AbCdEf",
    "decision": "accept",
    "slug": "london-ai",
    "name": "London AI",
    "strapline": "Monthly applied AI talks at Newspeak House",
    "frequency": "monthly",
    "format": "talks",
    "website": "https://london.ai",
    "sectors": ["ai"]
  },
  { "key": "usr-XYZ123", "decision": "reject" },
  { "key": "cal-OldOne", "decision": "skip" }
]
```

Effects per decision:
- `accept` → appends a `## event_series: <slug>` YAML block to `docs/kb-seeds/<today>-promoted-event-series.md` (or `--out`). Removes the candidate from the queue. **Does not run `seed:kb` automatically** — the user runs that next.
- `reject` → adds `key` to `kb:event-series-rejected` (won't re-prompt) and removes from queue.
- `skip` → leaves the candidate in the queue for next session.

If `accept` is missing required fields (`slug`, `name`), the script prints `[refuse <key>] accept requires slug + name` and skips that decision.

## Workflow

1. Run `npm run promote-organisers` (or `--limit N`). Read the JSON.
2. If `candidates: []` → tell user "Nothing to promote" and stop.
3. For each candidate (already sorted by `eventCount` desc):
   - Show the user: `organiserName`, `sourceKind` + key (cal-id, usr-id, or platform group), `eventCount`, the last 2-3 `sampleEventNames`, and `topSectors`.
   - Look up additional context if useful: `WebFetch` the organiser's Luma calendar (`https://lu.ma/<slug>` or `https://lu.ma/calendar/<cal-id>`) to find a website, name, frequency, format. **Don't make up data — leave fields blank if unsure.**
   - Prompt the user with their options: `accept` / `reject` / `skip` (+ proposed slug, name, sectors, optional strapline/website/frequency).
   - Wait for the user's reply. They can override any field.
4. Write the collected decisions to `/tmp/promote-organisers-<timestamp>.json`.
5. Run `npm run promote-organisers -- --apply /tmp/promote-organisers-<timestamp>.json`.
6. After the apply step prints the seed path, run:
   ```
   npm run seed:kb -- <seed path>
   npm run retag-events
   ```
   This flips all past events from those organisers from LLM-derived to deterministic KB tags.
7. Report the summary back to the user (`N accepted · M rejected · K skipped`).

## Things to watch

- **Slug conflicts**: existing `event_series.slug` values must be unique. Before suggesting a slug, search past `docs/kb-seeds/*.md` for `## event_series: <candidate-slug>` to avoid collisions.
- **Cal-id auto-fill**: if the candidate has a `lumaCalId`, the YAML block will include `luma_cal_ids: [cal-XXX]` automatically. For `usr-XXX` keys we add `luma_user_ids` instead. The user can override via `decision.extraIds`.
- **Sectors default to `topSectors`**: if the user doesn't override `sectors` on `accept`, the script uses the candidate's top 3 LLM-suggested sectors. Always show these to the user and ask them to confirm.
- **Don't accept blindly**: if the LLM was guessing (sample events all unrelated, mixed sectors with low counts), prefer `skip` over `accept` with bad sectors. A bad KB row poisons all future events from that source.
- **`reject` is permanent in this session**: rejected keys are stored in `kb:event-series-rejected` and never resurface as candidates. Reserve for genuinely off-topic organisers (recruiter mixers, pyramid schemes that snuck through curation).
- **Recurring batches**: re-running the skill is safe — already-promoted candidates are gone, rejected ones are filtered, only new orphans surface. Run weekly after a few cron cycles have built up signal.

## Rough chat shape

```
1/12 · 6 events · suggested sectors: ai, devtools
"Voice AI Space"
key: cal-VYz8aB1c (luma-cal)
recent: "ElevenLabs voice AI workshop", "Voice agents demo night", "Voice tools deep dive"
LLM thinks: ai (5), devtools (3)

reply: accept | reject | skip
  accept slug=voice-ai-space sectors=[ai, devtools] frequency=monthly format=talks website=https://lu.ma/voiceaispace
```

End-of-session summary:
```
done — 4 accepted, 2 rejected, 1 skipped
next: npm run seed:kb -- docs/kb-seeds/2026-05-09-promoted-event-series.md && npm run retag-events
```
