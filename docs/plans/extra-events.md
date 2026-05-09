---
title: "feat: Manual / non-Luma event ingestion path"
type: feat
status: done
date: 2026-04-28
worktree: .claude/worktrees/extra-events
branch: worktree-extra-events
---

# Manual / non-Luma event ingestion path

## Overview

Add a YAML-seed → CLI pipeline so events from non-Luma platforms (AI Tinkerers London, Venture Café London, and any future ad-hoc source) can be ingested into the same KV store the live scrapers feed. Pipeline is purely additive: it leverages the `events:manual` KV path that already exists and is already merged into `getEvents()` server-side. Ship Path 1 first (manual YAML → KV); Path 2 (per-site fetch helpers that produce that YAML) builds on it.

## Problem Frame

The existing four-scraper system covers Luma + Eventbrite + Meetup + Cerebral Valley. Two valuable London tech-event sources sit outside that envelope:

- `london.aitinkerers.org` — Cloudflare bot-challenge wall, returns 403 to plain `fetch`. (Underlying platform is a custom Luma calendar.)
- `community.venturecafelondon.org` — Returns 200 but runs on a non-Luma stack; needs bespoke HTML parsing.

Vercel-cron scrape is the wrong tool for either: CF challenge needs a real browser, and bespoke parsing risks brittleness at the worst time. The user wants a **local-only** ingestion path they can run weekly: paste-or-fetch → review → publish. Ideally one workflow, two source types — manual transcription *and* per-site helpers — so the structure is reusable for whatever site shows up next.

## Requirements Trace

- **R1** Allow new events to land in KV from sources outside the cron pipeline.
- **R2** Manual entries must survive subsequent cron scrapes (cannot be overwritten by `saveEvents()`).
- **R3** YAML seed format covers the limiting case: `name + startAt + url + coverUrl + locationName`. Other fields optional.
- **R4** Re-running the seed CLI on the same file is idempotent (safe upsert).
- **R5** Admin still has the final say — seeded events default to `pending: true` so they appear in `/admin` review queue before going public. A `--auto-approve` flag exists for trusted batches.
- **R6** Per-site fetch helpers emit YAML that conforms to R3, never write to KV directly.
- **R7** Path 2 helpers run *only* locally; they are explicitly out of scope for Vercel cron.

## Scope Boundaries

**In scope**

- New YAML schema + parser
- `scripts/seed-events.ts` CLI + `npm run seed:events`
- Two per-site fetcher scripts (Venture Café first via cheerio, AI Tinkerers via Playwright OR Luma cal-id fallback)
- Tiny CLAUDE.md / docs update so the workflow is discoverable
- Sample seed file (`docs/event-seeds/_example.yaml`) for onboarding

**Out of scope**

- Schema validation library beyond the lightweight type-narrowing the script needs (no zod/io-ts unless the existing repo uses one — it does not)
- Per-site cron jobs / Vercel-side automation for bot-walled sites
- New admin UI affordances for manual events (admin already has `/admin` workflow)
- Tag auto-derivation, image hosting, or backfill scripts
- Migrating existing `addManualEvent` API endpoint (`/api/admin` POST) — keep untouched
- A new value on `LondonEvent.source` union (re-use `'other'`)

## Context & Research

### Major finding — most of the infra already exists

`src/lib/kv.ts` already implements the entire manual-event read/write surface:

- `events:manual` is a separate Redis key from `events:london` — **scrapes never touch it.**
- `getEvents()` (kv.ts:24-59) merges `auto + manual + curated-overrides`; manual wins on ID collision.
- Manual events default to `pending: true` (line 45) unless explicitly set to `false`.
- Helpers `getManualEvents`, `addManualEvent`, `updateManualEvent`, `removeManualEvent` already exist.
- Admin route `/api/admin` (POST) already supports `approve-event`, `delete-event` (which adds to `events:blocklist` so deletions stick across re-seeds).

This dramatically reduces the work: the seed CLI just composes `LondonEvent` objects and calls existing helpers. **No KV-layer changes needed.**

### Relevant code and patterns

- `scripts/seed-kb.ts` — model for: YAML parsing via `yaml`, `--dry-run` flag, idempotent upsert. The KB script targets Supabase, but the CLI shape transfers cleanly to KV.
- `scripts/scrape.ts` — model for: `--force` flag, `npx tsx --env-file=.env.local`, structured logging.
- `src/lib/types.ts:LondonEvent` — target shape; `source: 'other'` is the union member to use.
- `src/lib/scrapers/eventbrite.ts:mapEvent` — model for: shaping a raw payload into a `LondonEvent` with sensible defaults (e.g., `tags ?? []`, fallback `locationName`).
- `src/app/api/admin/route.ts:117-141` — confirms the admin-side review/delete loop. Plan must align with it: deleted events live in `events:blocklist`; the seed script must consult that set so a "delete" sticks.

### Institutional learnings

- CLAUDE.md feedback memory: *"Bare minimum + strong extensible core — default to smallest change; defer test infra, speculative hardening, while-we're-here cleanups."* → No new dependencies for Path 1; `yaml` is already in the package. Cheerio joins only for Path 2a; Playwright only if Path 2b actually requires it.
- CLAUDE.md feedback memory: *"KB additions via kb-batch workflow"* → mirror exactly: `docs/event-seeds/*.yaml` + `npm run seed:events`. Do not create legacy per-source scripts inside `src/lib/scrapers/`.
- CLAUDE.md feedback memory: *"Main branch parity"* → no UI changes. Seeded events render via existing EventCard with no special treatment.

### External references

None needed for Path 1 (everything is local). Path 2 (deferred until Path 1 lands):

- AI Tinkerers London is a Luma-hosted calendar behind a vanity domain. Cheaper alternative to Playwright: locate the underlying `cal-XXXX` ID and add it to `CALENDAR_SOURCES` so the existing `LumaCalendarScraper` does the work. Investigate this **before** committing to Playwright.
- Venture Café London markup not yet surveyed; cheerio + a tight CSS selector pass should suffice for the listing page.

## Key Technical Decisions

| Decision | Rationale |
|---|---|
| **Re-use `events:manual` KV key, not `events:london`.** | `getEvents()` already merges them; manual wins on ID collision; survives every cron run. Zero risk of overwrite by `saveEvents()`. |
| **ID format: `manual-<sha1(url + '|' + startAt).slice(0,12)>`** | Stable across re-seeds (same input → same id), so YAML re-runs upsert cleanly. No collision with existing prefixes (`evt-`, `cv-`, `eb-`, `meetup-`). |
| **Re-use `source: 'other'`; do NOT add `'manual'` to the union.** | Avoids touching the type union, the `dedup-utils` source ranking, and the admin UI. The seed source slug lives in the file path (`docs/event-seeds/<slug>.yaml`) and on `LondonEvent.calendarSlug` for traceability. |
| **Default `pending: true`, `curated: true`.** | Mirrors existing manual-event behaviour: appears in `/admin` review queue, but with curation badge once approved. `--auto-approve` flag flips `pending` to `false` for trusted batches. |
| **Upsert semantics in seed CLI.** | `addManualEvent` only inserts; need: `if (exists) updateManualEvent(id, fields-except-pending) else addManualEvent`. Never overwrite `pending` on update — preserves admin approvals across re-seeds. |
| **Honour `events:blocklist` in seed CLI.** | If an admin deleted an event via `/admin`, the seed script must skip its ID — otherwise the next `npm run seed:events` resurrects it. |
| **YAML format = top-level array of events under a `source:` header object.** | Single document per file; one file per source (e.g. `aitinkerers.yaml`, `venturecafe.yaml`). Keeps seed → fetcher symmetry tidy. |
| **Path 2 helpers emit YAML to stdout or `--out <path>`; never write KV directly.** | Forces the human-review step and keeps the two paths composable. |
| **No new dependencies for Path 1.** | `yaml` is already in the repo. `crypto` (sha1) is built-in. |

## Open Questions

### Resolved during planning

- *KV strategy?* — Use existing `events:manual`. (kv.ts already merges.)
- *ID prefix collisions?* — None. New `manual-<sha1>` is unique.
- *Add `'manual'` to source union?* — No, re-use `'other'`. See decisions table.
- *Default visibility?* — `pending: true`, `curated: true`. `--auto-approve` flips pending.
- *UI badge / source label?* — None. Renders identically to other curated events. (Decision: identity > novelty.)

### Deferred to implementation

- *Exact YAML field set for optional fields* — finalise during Unit 1 once we test against a sample event from each source.
- *AI Tinkerers approach* — try cal-id discovery first (no new deps); fall back to Playwright only if the page genuinely requires JS rendering. Decision happens inside Unit 4.
- *Venture Café selector strategy* — the right cheerio selectors come from inspecting the live page during Unit 3.
- *Whether to log seed runs to KV* — defer; current scrape pipeline already has its own logging; seed CLI can just stdout.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
Path 2 (optional, local-only)              Path 1 (primary)
┌──────────────────────┐                   ┌──────────────────────────┐
│ scripts/             │                   │ docs/event-seeds/        │
│   fetch-venturecafe  │ ── emits ─────►   │   aitinkerers.yaml       │
│   fetch-aitinkerers  │     YAML          │   venturecafe.yaml       │
└──────────────────────┘                   │   _example.yaml          │
                                           └────────────┬─────────────┘
                                                        │ user reviews
                                                        ▼
                                           ┌──────────────────────────┐
                                           │ npm run seed:events      │
                                           │  scripts/seed-events.ts  │
                                           └────────────┬─────────────┘
                                                        │
                              skip if in blocklist ─────┤
                              upsert by manual-<sha1>   ▼
                                           ┌──────────────────────────┐
                                           │ events:manual (Redis)    │
                                           └────────────┬─────────────┘
                                                        │ getEvents()
                                                        │ merges with auto + overrides
                                                        ▼
                                           ┌──────────────────────────┐
                                           │ /events page             │
                                           └──────────────────────────┘
```

YAML schema sketch (one file per source):

```yaml
# docs/event-seeds/<source-slug>.yaml
source:
  slug: aitinkerers           # used as LondonEvent.calendarSlug
  label: "AI Tinkerers London"  # used as LondonEvent.organiserName fallback
  curated: true               # default true unless overridden per-event

events:
  - name: "AI Tinkerers Demo Night #14"
    startAt: "2026-05-08T18:00:00+01:00"   # ISO 8601, required
    endAt:   "2026-05-08T21:00:00+01:00"   # optional, defaults to startAt + 2h
    url: "https://london.aitinkerers.org/p/demo-night-14"   # required
    coverUrl: "https://.../hero.jpg"        # optional, null if missing
    locationName: "Newspeak House"          # required
    organiserName: "AI Tinkerers London"    # optional, falls back to source.label
    tags: ["ai", "demo-night"]              # optional, [] default
    timezone: "Europe/London"               # optional, default Europe/London
    pending: false                          # optional, override default (rare)
    curated: false                          # optional, override default
```

## Implementation Units

- [ ] **Unit 1 — Schema, ID helper, sample seed file**

**Goal:** Establish the YAML contract and the ID-minting helper that the CLI will consume. No CLI yet — just the foundation. Validate the schema against one transcribed event from each target site so we discover field gaps before writing the parser.

**Requirements:** R3, R4, R6

**Dependencies:** None.

**Files:**
- Create: `docs/event-seeds/_example.yaml` — fully-commented template; users copy-paste this when adding a new source.
- Create: `docs/event-seeds/aitinkerers.yaml` — one real transcribed event for end-to-end testing in Unit 2.
- Create: `docs/event-seeds/venturecafe.yaml` — one real transcribed event.
- Create: `scripts/lib/manual-event.ts` — small helper module, exports `mintManualId(url, startAt): string` and `shapeManualEvent(input, sourceMeta): LondonEvent`. Keep it under ~80 lines.

**Approach:**
- `mintManualId` uses `crypto.createHash('sha1')`, joins inputs with `'|'`, slices to 12 hex chars, prefixes `manual-`. Document collision risk (vanishing for SHA-1 truncated to 12 chars at our scale).
- `shapeManualEvent` applies defaults: `endAt = startAt + 2h`, `tags = []`, `coverUrl = null`, `timezone = 'Europe/London'`, `pending: true`, `curated: true`, `source: 'other'`, `calendarSlug: <source.slug>`, `organiserName ??= source.label`.
- Throw with a precise field-path message on missing required fields (`name`, `startAt`, `url`, `locationName`).

**Patterns to follow:**
- `src/lib/scrapers/eventbrite.ts:mapEvent` for raw → `LondonEvent` defaulting style.
- `scripts/seed-kb.ts:parseBatch` for YAML parse + clear error messages.

**Test scenarios:**
- Valid event → returns a `LondonEvent` with all fields set.
- Missing `name` → throws with field path mentioned.
- Missing `endAt` → defaults to `startAt + 2h`.
- Same input twice → identical `id`.
- Different `url` or `startAt` → different `id`.

**Verification:**
- Importing `mintManualId` from a Node REPL with the same args twice returns identical strings.
- The two real seed files parse without error using `import { parse } from 'yaml'`.

---

- [ ] **Unit 2 — `scripts/seed-events.ts` CLI + `npm run seed:events`**

**Goal:** End-to-end pipeline: read all `docs/event-seeds/*.yaml`, shape into `LondonEvent`, upsert into `events:manual`, respecting blocklist and admin approvals. Path 1 is shippable after this unit.

**Requirements:** R1, R2, R4, R5, R7

**Dependencies:** Unit 1.

**Files:**
- Create: `scripts/seed-events.ts`
- Modify: `package.json` — add `"seed:events": "npx tsx --env-file=.env.local scripts/seed-events.ts"`.

**Approach:**

CLI flags:
- `[paths...]` — optional explicit YAML files; default = glob `docs/event-seeds/*.yaml` (skip files starting with `_`).
- `--dry-run` — parse + shape + report counts; no KV writes.
- `--auto-approve` — set `pending: false` on inserts (existing approvals never overwritten on update).
- `--prune` — for each seed file's `source.slug`, find any existing `events:manual` rows where `calendarSlug === source.slug` AND id not in current YAML AND startAt is in future → soft-remove (i.e. call `removeManualEvent`). Off by default; opt-in for users who treat the YAML as source-of-truth for that source. Document the trade-off in CLAUDE.md.

Algorithm per file:
1. Parse YAML; validate `source` block + `events` array.
2. Read once at start: `existing = await getManualEvents()`, `blocklist = await getBlocklist()`.
3. Build a map `existingById = new Map(existing.map(e => [e.id, e]))`.
4. For each YAML event:
   - `event = shapeManualEvent(yaml, sourceMeta)`
   - If `blocklist.includes(event.id)` → log "skipped (blocked): <name>", continue.
   - If `existingById.has(event.id)` → call `updateManualEvent(event.id, { ...event, pending: existingById.get(event.id).pending })` (preserve admin's pending decision).
   - Else → call `addManualEvent(event)` (using `--auto-approve` to flip `pending`).
5. Print summary: `N added / M updated / K skipped (blocked) / J pruned`.

Use `--dry-run` for the first run on each new file.

**Patterns to follow:**
- `scripts/seed-kb.ts` — argv parsing, dry-run, summary log shape.
- `scripts/scrape.ts` — env loading via `--env-file=.env.local`, top-level `main().catch(...)` error wrapping.

**Test scenarios:**
- Empty `docs/event-seeds/` → exits 0 with "no seed files found".
- Bad YAML in one file → fails fast with file path + line number, no partial writes.
- Re-run on same file → 0 added, N updated.
- Re-run with one entry removed from YAML AND `--prune` → 1 pruned.
- Event ID present in blocklist → skipped, never resurrected.
- `--dry-run` → no KV mutation observable (verify by running getManualEvents before/after).
- `--auto-approve` flips `pending` on insert; second run does NOT flip back to `true` (update preserves field).

**Verification:**
- After `npm run seed:events`, `npm run dev` shows the seeded event on `/events`.
- `/admin` lists the same event with the right pending state.
- Running `npm run scrape` after seeding leaves the manual event in place (visible on `/events` post-scrape).

---

- [ ] **Unit 3 — Venture Café fetcher (Path 2a)**

**Goal:** Local-only helper that scrapes `community.venturecafelondon.org` and emits a YAML file ready for `npm run seed:events`. First Path 2 helper because the site responds 200 without bot-challenge.

**Requirements:** R6, R7

**Dependencies:** Unit 1 (uses the schema), Unit 2 (so the user has a place to send the YAML).

**Files:**
- Create: `scripts/fetch-venturecafe.ts`
- Modify: `package.json` — add `"fetch:venturecafe": "npx tsx --env-file=.env.local scripts/fetch-venturecafe.ts"` (env file optional but matches convention).
- Modify: `package.json` (devDependencies) — add `cheerio` (lightweight, well-maintained).

**Approach:**
- Single `fetch()` against the events-listing URL of `community.venturecafelondon.org`. No retry orchestration; this is a tool the user runs by hand.
- Parse with cheerio. Extract per-event: title, start datetime, link, image, venue.
- Write to `docs/event-seeds/venturecafe.yaml` (overwrite). Print a diff summary if file already exists (lines added/removed). Optional `--out <path>` overrides destination.
- Treat the YAML as a draft — print a 1-line reminder: "Review then: npm run seed:events".

**Patterns to follow:**
- `src/lib/scrapers/eventbrite.ts:fetchCsrfToken` for headers / `User-Agent`.
- Defensive: if a selector returns 0 hits, fail with the URL + the selector that missed, so the user can fix the script when the site changes.

**Test scenarios:**
- Live run produces a non-empty YAML that parses cleanly.
- Selector mismatch → script exits with descriptive error.
- Re-run produces the same YAML (deterministic).

**Verification:**
- Manually inspect generated YAML; run `npm run seed:events docs/event-seeds/venturecafe.yaml --dry-run` and confirm shaping succeeds.

---

- [ ] **Unit 4 — AI Tinkerers fetcher (Path 2b)**

**Goal:** Same shape as Unit 3 but for `london.aitinkerers.org`, which is Cloudflare-walled. Decide approach during execution.

**Requirements:** R6, R7

**Dependencies:** Unit 1, Unit 2.

**Files:**
- Create: `scripts/fetch-aitinkerers.ts`
- Modify: `package.json` — add `"fetch:aitinkerers": ...`.
- Possibly modify: `src/lib/scrapers/sources.ts` — IF cal-id discovery succeeds, prefer adding `aitinkerers` to `CALENDAR_SOURCES` and SKIP the fetcher entirely (delete this unit's deliverable).

**Approach (decision tree):**

1. **First**: investigate whether `london.aitinkerers.org` is a thin wrapper over a Luma calendar. Methods:
   - View page source via curl with realistic headers; look for `cal-` ID.
   - Visit the site in a browser, open the network tab, look for `api2.luma.com/calendar/get-items` calls — copy the cal-id.
2. **If cal-id found** → easiest path. Add `{ slug: 'calendar/cal-XXXX', curated: true }` to `CALENDAR_SOURCES` (the existing scraper supports this `calendar/cal-XXXX` direct-id form per `LumaCalendarScraper`). Delete the fetcher; close this unit.
3. **If no cal-id** → write the fetcher with Playwright (`playwright` devDep). Use the `chromium.launch({ headless: true })` flow, wait for the events list to render, extract via `page.$$eval`. Output YAML same shape as Unit 3.
4. **Last resort** → "manual paste mode": fetcher reads HTML from `--input <path>` (a file the user saves from their browser via View Source) and parses with cheerio. Doc-cost: low; user-friction: medium.

**Execution note:** Run discovery (step 1) before adding any new dependency. The cheapest outcome is a one-line addition to `CALENDAR_SOURCES`.

**Patterns to follow:**
- If Playwright route: keep launch/teardown in a small wrapper; do not import Playwright into anything Vercel-side ever.

**Test scenarios:**
- Discovery script (step 1) produces either a cal-id or a clear "no cal-id, falling back to Playwright" message.
- Fetcher (if needed) produces non-empty YAML.

**Verification:**
- If cal-id route: a normal `npm run scrape` picks up AI Tinkerers events with no Path-2 work needed.
- If Playwright route: `npm run fetch:aitinkerers` produces a YAML the user can review and seed.

---

- [ ] **Unit 5 — Documentation update**

**Goal:** Make the workflow discoverable so the next person (or the user 3 weeks from now) finds it without re-reading code.

**Requirements:** R3, R5, R7

**Dependencies:** Units 1-2 minimum; Units 3-4 if shipped together.

**Files:**
- Modify: `CLAUDE.md` — append a "Manual / non-Luma events" section under "Scraper System". Cover: directory layout, `npm run seed:events`, default flags, the blocklist interaction, the local-only constraint of fetchers.
- Optional: `docs/event-seeds/README.md` — copy of the YAML contract for at-a-glance reference. Skip if `_example.yaml` already covers it.

**Approach:**
- Keep the CLAUDE.md addition under 30 lines.
- Cross-link from the existing "Scraper System" table by adding a manual row.

**Verification:**
- A second engineer (or fresh agent session) can add a new event source by reading only CLAUDE.md and `_example.yaml`.

## System-Wide Impact

- **Interaction graph:** None new. Hooks into existing `getEvents()` merge path. Admin route `/api/admin` already manages manual events; no changes needed there.
- **Error propagation:** Seed CLI exits non-zero on any per-file parse error (no partial writes). Fetcher scripts exit non-zero on selector-missing; user re-runs after fixing.
- **State lifecycle risks:** **Important** — seed CLI must consult `events:blocklist` (as per Decision Table) so admin deletions don't get resurrected. Tested in Unit 2.
- **API surface parity:** No API or type changes. `LondonEvent.source = 'other'` is reused.
- **Integration coverage:** `getEvents()` already exercises the auto+manual+overrides merge in production. Seed CLI's only new logic is the upsert dance, covered by Unit 2's manual test plan.

## Risks & Dependencies

| Risk | Mitigation |
|---|---|
| Re-seeding overwrites an admin's pending=false approval | Update path explicitly preserves existing `pending` field (Unit 2). |
| ID collision with future scrapers | `manual-` prefix is reserved; document in CLAUDE.md. SHA-1[:12] collision odds are negligible at our event count. |
| User commits a typo in a seed file → bad event in production | `pending: true` default forces admin review before public visibility. |
| Path 2 sites change their markup | Fetchers fail loudly with selector-not-found errors; user re-points selectors. Path 1 always remains as the fallback (manual transcription). |
| Playwright dep bloats install for everyone | Only if Unit 4 needs it AND the cal-id route fails. Keep as `optionalDependencies` or document a `npm install --include=optional` flow if it lands. |
| New `cheerio` dep | Trivial size; widely used. Acceptable. |

## Documentation / Operational Notes

- The seed pipeline is **local-only**. Vercel cron remains untouched (`vercel.json` not modified).
- Suggested cadence (per user request): run `npm run seed:events` weekly after refreshing the YAML files (manually or via the Path 2 fetchers). Could be turned into a scheduled Claude routine later via `/schedule`.
- No migration needed — `events:manual` already exists and is empty-or-populated by the existing `/admin` form.

## Sources & References

- Origin worktree: `.claude/worktrees/extra-events` (branch `worktree-extra-events`)
- Major code references:
  - `src/lib/kv.ts:24-59` — `getEvents` merge logic (auto+manual+overrides)
  - `src/lib/kv.ts:91-119` — manual events helpers (already exist)
  - `src/app/api/admin/route.ts:117-141` — admin approve/delete loop
  - `scripts/seed-kb.ts` — pattern for the new CLI
  - `scripts/scrape.ts` — pattern for env loading
  - `src/lib/scrapers/eventbrite.ts:mapEvent` — pattern for shaping raw → `LondonEvent`
- External targets:
  - `https://london.aitinkerers.org/` (CF-walled)
  - `https://community.venturecafelondon.org/` (open)
