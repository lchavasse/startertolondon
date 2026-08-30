# CRM runbook

How to run and maintain the DeepTech London CRM and the event sourcing pool.

Branch `feat/crm`, worktree `.claude/worktrees/crm`. 29 commits ahead of `main`, which has not moved,
so it merges cleanly whenever you want it.

## Run it

```bash
cd ~/code/starter-london/.claude/worktrees/crm
npm run dev
```

Then `localhost:3000/crm` and log in with `ADMIN_SECRET`.

**Use pnpm, not npm, for installs.** `pnpm-lock.yaml` pins `@supabase/supabase-js` to 2.100.0;
`npm install` resolves `^2.100.0` to a newer minor whose stricter types break two unrelated admin
routes. If you see type errors in `src/app/api/admin/kb/route.ts` or `src/app/api/aitw/projects/route.ts`,
you have the wrong version — run `pnpm install`, don't edit those files.

## The pages

| Page | What it is |
|---|---|
| `/crm` | Today — overdue follow-ups, tasks due, opportunities with no next action or contact route |
| `/crm/opportunities` | 176 opportunities, workbench per opportunity |
| `/crm/people` · `/crm/organisations` | 109 people, 171 orgs — the older Notion/sheet import, linked to opportunities. Not yet merged with `crm_contacts`. |
| `/crm/contacts` | **Active leads** — every `crm_contacts` row whatever its source, with status, labels, note, timeline and resurface date |
| `/crm/expo` | **Expo applications** — the 7 public form submissions, reviewed through the same working layer |
| `/crm/volunteers` | **Volunteers** — signups from the public volunteer form, with shift coverage per window |
| `/crm/people-pool` | **Sourcing** — 2,631 classified people, fit-ranked, shortlist and export |
| `/crm/enrichment` | Enrichment job queue (built, unused) |

## Logging a contact from one line

`/crm-log` in Claude Code, or the primitive directly:

```bash
echo '{"full_name":"Jason Kelly","company":"Ginkgo Bioworks","role":"CEO",
       "log":"emailed, keen to hear about next year","kind":"outreach",
       "resurface_in":"6 months","labels":["sponsor"]}' | npm run crm:log -- -

npm run crm:log -- entry.json --dry-run    # says CREATE or UPDATE without writing
```

Identity resolves on id → source_system+source_ref → linkedin_url → email → name+company.
Name alone never matches. Re-running the same entry updates the contact and appends another
timeline entry rather than creating a second person.

`resurface_in` takes "6 months" / "2 weeks" / "10 days" / "1 year" and is parsed by the script,
never by the model. Due contacts appear in **Due to resurface** on `/crm`, and at
`GET /api/crm?entity=due&days=30` for an agent or cron.

## Reviewing a source table

`/crm/expo` and `/crm/volunteers` are the same grid over two different source tables. The source row
is owned elsewhere — both forms live in the `deeptech-ldn` repo — and nothing in the CRM writes back
to it. The verdict, labels, note, resurface date and timeline all live in `crm_contacts`, linked by
`(source_system, source_ref)`, so a resubmission cannot wipe a decision.

Adding a third one is a page, a row type and a grid: read the table, pass the rows plus
`fetchCrmContacts({ source_system })` into a component that calls `useContactReview`
(`src/lib/crm/use-contact-review.ts`) and renders the shared cells from
`src/components/crm/ReviewCells.tsx`. Only the source columns and filters are new.

The volunteer grid's `SHIFT_WINDOWS` mirrors `deeptech-ldn/lib/config.ts`. Windows outside that list
still render — it just means the form changed and the constant has not caught up.

## Exporting CSVs

From the Sourcing page, or directly:

```
/api/crm/people/export                          everything (2,631)
/api/crm/people/export?group=top_founder        one profile
/api/crm/people/export?group=senior_engineer
/api/crm/people/export?shortlisted=1            only what you ticked
/api/crm/people/export?pillar=materials
/api/crm/people/export?flagged=1                only rows with a note
```

Groups: `rivan`, `top_founder`, `early_eng_founder`, `senior_engineer`, `postdoc`, `recent_grad`,
`policy_misc`, `vc`, `deeptech_operator`, `deeptech_ic`.

## Refreshing the pool

The pipeline runs on local SQLite in `scripts/.staging/` (gitignored, never committed — it holds
LinkedIn message bodies). Only derived fields reach Supabase.

```bash
# 1. re-enrich LinkedIn profiles (resumable, skips anything already fetched)
npx tsx scripts/enrich-connections-brightdata.ts --batch 100 --timeout-min 10

# 2. rebuild the candidate pool from all sources
npx tsx scripts/build-candidates.ts

# 3. classify (resumable; priority 1-3 is the evidence-bearing pool, 4 is wider discovery)
npx tsx --env-file=.env.local scripts/classify-candidates.ts --min-priority 1 --max-priority 3 --batch 40

# 4. push to Supabase — never overwrites shortlisted, note, or corrected rows
npm run crm:import-pool -- --commit
```

Step 4 is safe to re-run: rows you have shortlisted, annotated or hand-corrected keep those values,
and corrected rows keep their group and pillars too.

**`BRIGHT_DATA_API_KEY` lives in `.env`, not `.env.local`.** The `bd` wrapper reads `.env`; the npm
scripts read `.env.local`. Don't be surprised when one works and the other doesn't.

## Adjusting the ranking

`scripts/lib/fit.ts` holds the fit weights, currently tuned for Rivan Industries — modular synthetic
fuel plants, so physical-industry pillars score highest and London is weighted up. For the expo,
where compute and biotech are legitimately in scope, loosen `CORE`/`ADJACENT` there rather than
hand-correcting hundreds of rows.

Changing weights means re-running `npm run crm:import-pool -- --commit` to push new scores.

## Traps worth remembering

- **Supabase truncates at 1,000 rows** and says nothing. Use `fetchAllRows` from
  `src/lib/crm/fetch-all.ts` for anything that can exceed that, and always end the sort on a unique
  column — paging a sort with ties duplicates some rows and drops others.
- **Middleware must live at `src/middleware.ts`**, not the project root, because the app is in
  `src/`. It was at the root and inert, which left the whole CRM unauthenticated.
- **`deeptech.db` is read-only** from this repo, except `scripts/queue_companies_from_people.py`,
  which appends to `company_candidates` and backs the file up first.

## Deploying it

It has never been deployed. Before it is:

1. Merge `feat/crm` into `main`.
2. Add `ADMIN_SECRET` and `CRM_AGENT_TOKEN` to Vercel env.
3. **Lengthen `ADMIN_SECRET` first.** It is currently 8 characters, which is fine on localhost and
   not fine on the public internet guarding 171 organisations, 109 people and the outreach history.
4. Decide whether `/crm` should be internet-facing at all, or stay local.

## Outstanding

- **3,164 people unclassified** — the Anthropic credit balance ran out mid-run. All are priority-4
  adjacents, so the dinner groups are unaffected and the expo pool is thinner than it should be.
  Top up, then re-run step 3 with `--min-priority 4 --max-priority 4`.
- **300 LinkedIn profiles** skipped on Bright Data timeouts; re-run step 1 to pick them up.
- **953 scanner founders have no LinkedIn URL.** The cheap resolution path found 9. Anything more
  needs a web search per founder.
- **30 companies** sit in `company_candidates` in deeptech-scanner as `triage='new'`, discovered via
  people classification. Triage them with the scanner's own flow.
- **Bright Data key was pasted into a chat transcript** — worth rotating.
