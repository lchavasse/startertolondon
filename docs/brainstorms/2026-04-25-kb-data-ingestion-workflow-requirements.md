---
date: 2026-04-25
topic: kb-data-ingestion-workflow
---

# KB Data Ingestion Workflow

## Problem Frame

The Supabase KB has tables for spaces, communities, vcs, programmes, companies, people, event_series, accommodation + 16 join tables, but most rows are either empty or seeded thinly from March 2026. The user is the domain authority on the London tech ecosystem and wants to populate the KB with high-quality, hand-curated data. We need a repeatable workflow — not a one-off — because batches will keep coming and the long-term plan is to codify the workflow into a reusable skill.

## Requirements

- **R1.** Source-of-truth artifact per batch: a single human-readable markdown file in `docs/kb-seeds/YYYY-MM-DD-<topic>.md` that fully specifies all entities and their joins. The file is reviewed in PRs, lives in git, and is the durable record of what was claimed about the world.
- **R2.** Entity sections use `## kind: slug` headings followed by a fenced ```yaml block. Slug refs (`lives_at`, `led_by`, `hosted_at`, `hosted_by`, `under`) inside an entity body resolve to the right join table.
- **R3.** A single `scripts/seed-kb.ts` script reads a batch file and performs idempotent upserts via the Supabase service-role key. Re-running the same batch is a no-op (slugs are the conflict key; joins delete-then-insert scoped to the parent entity id).
- **R4.** `--dry-run` mode prints the planned upserts and join writes without touching the DB. Default is dry-run-friendly: errors are loud, missing slug refs fail before any DB write.
- **R5.** Each new entity in a batch goes through this loop: (a) user provides name + minimal notes, (b) Claude does targeted web search per entity, (c) Claude drafts the YAML block + flags schema gaps, (d) user confirms/corrects, (e) batch file is committed, (f) script runs.

## Success Criteria

- Three real London spaces (Ramen Space, Plugged, Encode Hub) plus their communities, leads, and anchor events live in Supabase by the end of batch #1.
- A second batch (any topic — VCs, programmes, more spaces) can be added by copying the template, filling YAML blocks, and running `npm run seed:kb -- <new-batch>.md` — no script changes needed unless a new entity kind appears.
- `/explore` shows the new entries without code changes.

## Scope Boundaries

- No automated scraping or LLM-extraction from random URLs. Claude does targeted web searches *to enrich entries the user has already named*; user remains the authority on what goes in.
- No Luma cal-id / Meetup group-id reconciliation between KB rows and `src/lib/scrapers/sources.ts` in this workflow. Deferred — both systems can store IDs independently for now.
- No new join tables added in batch #1. The community-space-person-event_series triangle is sufficient for the first batches. If a "space ↔ vc" or "space ↔ company" relationship surfaces in a future batch, we revisit then.
- No vector embeddings populated by the seed script. The `embedding` column stays null until we wire pgvector use.
- No admin UI changes — the existing `/admin` + `KBEditModal` is for one-off post-seed tweaks, not bulk ingestion.

## Key Decisions

- **Markdown + YAML over pure SQL or pure TS data file.** Reviewable, diffable, lets you skim a batch and understand it. SQL is hard to review; TS data files mix data with code.
- **Slug refs over inline IDs.** Authors don't deal with UUIDs; the script resolves `led_by: [charlie-ward]` to a `community_people` row keyed on real ids at write time.
- **Idempotency via slug-upsert + delete-then-insert joins.** Re-running a batch produces the same DB state. No migration table, no version history beyond git.
- **Service-role key for the script, anon key for the app.** RLS protects the live app; the seed script bypasses it intentionally because it's run from a trusted dev machine.
- **One batch = one file = one PR.** Captures intent atomically and keeps git log meaningful ("Seeded 3 east London spaces" rather than "lots of inserts").

## Dependencies / Assumptions

- `SUPABASE_SERVICE_ROLE_KEY` is in `.env.local` (confirmed).
- `slug` columns on every entity table are unique (per `database.types.ts`).
- Join tables have composite PKs that tolerate delete-then-insert per parent (no cascading harm — joins carry no useful state of their own beyond the relation + optional role/notes).
- Users running the script have permission to write to the live Supabase project (no separate staging environment exists yet).

## Outstanding Questions

### Deferred to Planning
- [Affects R3][Technical] If a future batch needs to *delete* an entity, the current script has no path for that. Likely solved by adding a `tombstone:` field per entity or a separate `delete-kb.ts` script.
- [Affects R3][Technical] If the same slug appears in two batches with conflicting fields, the second batch silently wins. Acceptable today; revisit if collaboration scales.
- [Affects scope][Needs research] Whether `space ↔ people` (lead/manager not via a community) deserves its own join table. Today we route through `community_people` + `community_spaces`, which works for community-led spaces but breaks down for pure commercial coworking.
- [Affects R5][Workflow] When to codify this loop into a Claude skill — probably after batch 3 once edge cases stabilize.

## Next Steps

→ Review `docs/kb-seeds/2026-04-24-east-london-spaces.md`, then run `npm run seed:kb -- docs/kb-seeds/2026-04-24-east-london-spaces.md` (without `--dry-run`) to write batch #1.
→ After batch #1 lands cleanly, propose batch #2 topic (more spaces? VCs? programmes?).
