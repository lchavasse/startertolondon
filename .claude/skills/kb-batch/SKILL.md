---
name: kb-batch
description: Ingest a new batch of KB entries (spaces, communities, vcs, programmes, people, event_series) into the starter-london Supabase. Use when the user wants to add real London tech ecosystem data — "add some spaces", "seed more communities", "create a KB batch", "let's ingest [entities]", "add events". Walks through the full workflow from raw notes → committed live data.
---

# KB Batch Ingestion Workflow

The user is the authority on what goes in the KB. You enrich, validate, and write — they decide. Pair with the `kb-copy` skill when writing description/strapline fields.

## Where things live

- `docs/kb-seeds/YYYY-MM-DD-<topic>.md` — one markdown file per batch, source of truth, lives in git.
- `scripts/seed-kb.ts` — parser + idempotent upserter. Run: `npm run seed:kb -- <file> [--dry-run]`.
- `supabase/migrations/` — schema changes (CHECK enums, new tables, new join tables). Apply with `SUPABASE_DB_PASSWORD=<pw> supabase db push --yes`. CLI is linked to project ref `yexvsmicvmbyfthdiixa` (frontier-tower).
- `.claude/skills/kb-copy/SKILL.md` — voice/tone rules for description + strapline fields.
- Reference batch: `docs/kb-seeds/2026-04-24-east-london-spaces.md`.

## The 5-step loop

1. **Gather.** User shares names + minimal notes for 3–10 entities. Don't go bigger in one batch — depth beats breadth.
2. **Research.** Per entity: WebSearch for missing facts (address, website, lead full names, founding year, etc.). For every `space`, geocode the address via Nominatim and capture `lat` + `lng`:
   ```bash
   curl -s -A "starter-london-seed/0.1 (lachlan.chavasse@gmail.com)" \
     "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=<URL_ENCODED_ADDRESS>"
   ```
   No API key needed. If the unit-level address fails, retry with the building or street-only.
3. **Draft.** Create the batch markdown. One `## kind: slug` heading per entity (kebab-case slug), fenced `yaml` block with fields. Slug refs (`lives_at`, `led_by`, `hosted_at`, `hosted_by`, `under`) connect to other entities by slug — the script resolves at write time.
4. **Confirm + dry-run.** Show the user the draft, get sign-off (especially copy and connections). Then `npm run seed:kb -- <file> --dry-run` validates parsing + slug-ref resolution without DB writes.
5. **Live + verify.** Drop `--dry-run`. Then a quick Supabase query to confirm row counts and that any `venue-only`-tagged spaces are still excluded by the `/explore` filter.

## Schema cheat sheet — DON'T trip on these

CHECK constraints reject anything not in the list. These are the four I tripped on in batch #1:

| Table.field | Allowed values |
|---|---|
| `spaces.access_type` | `open`, `members`, `invite`, `mixed` |
| `spaces.cost_type` | `free`, `paid`, `membership`, `variable` |
| `communities.exclusivity` | `open`, `application`, `invite` |
| `event_series.format` | `talk`, `workshop`, `social`, `panel`, `demo`, `hackathon`, `coworking`, `mixed` |
| `event_series.frequency` | `weekly`, `biweekly`, `monthly`, `quarterly`, `adhoc` |
| `event_series.free_or_paid` | `free`, `paid`, `mixed` |
| `programmes.cost_type` | `free`, `paid`, `equity`, `stipend` |

Source: `supabase/migrations/20260325202926_initial_schema.sql`. To verify live state:
```sql
SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname LIKE '%_check';
```

If a value you need isn't in the enum, write a widening migration (see `20260425120000_add_coworking_event_format.sql` as a template) — it's a CHECK widening so it's safe and forward-compatible.

## Entity tables + slug-ref vocab

**Tables:** `spaces`, `communities`, `vcs`, `programmes`, `companies`, `people`, `event_series`, `accommodation` (plus join tables).

**Slug refs** (declared in `REF_FIELDS` in `scripts/seed-kb.ts`):

| Entity | Field | Resolves to |
|---|---|---|
| `community` | `lives_at: [<space-slug>]` | `community_spaces` |
| `community` | `led_by: [<person-slug>]` | `community_people`, role=`lead` |
| `event_series` | `hosted_at: [<space-slug>]` | `event_series_spaces` |
| `event_series` | `hosted_by: [<person-slug>]` | `event_series_people`, role=`host` |
| `event_series` | `under: [<community-slug>]` | `community_event_series` |

If you need a join not listed (e.g. `vc.invests_in: [<company-slug>]`), add it to `REF_FIELDS` and re-run.

## Modelling rules

- **Community-led space**: model as TWO entities — a `space` for the venue, a `community` for the group identity. Link via `lives_at`. The lead goes in `community_people` (no `space_people` table exists).
- **Pub / cafe / external venue that hosts events**: add as a `space` with `tags: [venue-only, ...]`. The `venue-only` tag hides it from `/explore` and `/guide` browse surfaces (the filter is in `src/lib/kb.ts`, constant `HIDDEN_FROM_BROWSE_TAG`). Lat/lng still gets captured for future map use.
- **Recurring meetup / coworking session**: add an `event_series` row. `hosted_at` for the venue, `hosted_by` for the organiser, `under` for the umbrella community.
- **Lat/lng on every `space`** — required. Always geocode (Nominatim cmd above).
- **Area labels are normalized.** Always use a `display_name` from `docs/kb-reference/london-regions.md` for the `area` / `primary_area` field. If the user says "Hoxton", check `aliases` and store `Shoreditch`. If a label isn't in that file, ask the user before inventing one.
- **One-off events** (a single hackathon, a single conference): don't add. The Luma + Meetup + Eventbrite scrapers cover those.
- **Person rows**: only add people who lead/host/found something we're already modelling. Don't bulk-import contacts.

## Commands

```bash
npm run seed:kb -- docs/kb-seeds/<file>.md --dry-run    # validate
npm run seed:kb -- docs/kb-seeds/<file>.md              # write live
SUPABASE_DB_PASSWORD=<pw> supabase db push --yes        # apply migrations
```

Quick verify counts after a batch:
```ts
// scripts/verify-kb.ts (one-off, delete after)
import { createClient } from '@supabase/supabase-js'
async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  for (const t of ['spaces','communities','people','event_series']) {
    const { count } = await sb.from(t as any).select('*', { count: 'exact', head: true })
    console.log(t, count)
  }
}
main()
```
Run with `npx tsx --env-file=.env.local scripts/verify-kb.ts`.

## Workflow gotchas

- **Dry-run doesn't hit the DB**, so it can't catch CHECK enum mismatches. Validate values against the table above before running live.
- **Re-running a batch is safe** (idempotent on slug; joins delete-then-insert per parent). But: an explicit `null` field value wipes the live value. An empty `[]` for a slug-ref is a silent no-op (doesn't delete prior joins).
- **Adding a new entity kind**: update `TABLE_NAME` and `REF_FIELDS` in `scripts/seed-kb.ts`. The heading regex is derived from `TABLE_NAME` so the parser auto-picks it up.
- **Migration applied to prod must also be committed** — don't leave the SQL file uncommitted after `supabase db push`.
- **`/api/admin/kb` doesn't yet handle `person` or `event_series` rows.** If a quick post-seed fix is needed for those kinds, edit the batch file and re-run rather than the admin UI.

## After the batch

1. `npm run dev` → visit `/explore`, spot-check new entries appear in the right sections.
2. If you wrote any description/strapline fields, run them through `kb-copy` skill rules — short, punchy, casual.
3. Commit (batch file + any migration + any seed-kb.ts changes), push, open PR. The batch markdown IS the diff that explains what was claimed about the world.

## Backlog / open items (as of 2026-04-25)

- `companies` + `accommodation` tables exist in schema but not yet seeded.
- `regions` table not yet in schema. `docs/kb-reference/london-regions.md` is reference-only for now; promote to a real table by adding `region` to `Kind` + `TABLE_NAME` in seed-kb.ts and writing a migration.
- `/api/admin/kb` `ALLOWED_TABLES` should be expanded to include `person` and `event_series` so post-seed fixes don't require re-running batches.
- Per-table field validation in `seed-kb.ts` (currently typo'd field names surface as opaque Postgres errors).
- See `docs/brainstorms/2026-04-25-kb-data-ingestion-workflow-requirements.md` for the full deferred list.
