---
title: "chore: Extract the CRM into its own repo"
type: chore
status: proposed
date: 2026-08-30
branch: feat/crm → new repo
---

# Extracting the CRM into its own repo

## Overview

Move the CRM out of `starter-london` into its own Next app, pointing at the **same Supabase project**.
The database stays the integration layer — that is already how `deeptech-ldn` and `deeptech-scanner`
work — so the split is about deploy boundary, auth posture and room to grow, not about data.

The cut is unusually clean: the CRM has **one** import reaching outside its own directories, and
**nothing** outside the CRM imports it.

## Problem Frame

The CRM is 40 commits on `feat/crm` that have never merged, because merging means the public events
site's repo carries a private admin tool: a Supabase **service-role key** and the outreach history for
171 organisations and 109 people, separated from the public site by one middleware file — the same
middleware that once sat at the repo root, inert, leaving the whole CRM unauthenticated.

Two things follow. The branch is a holding pen nobody wants to merge, and the tool cannot be deployed
without deploying the events site with it. Separating dissolves both, and removes any risk that a CRM
change touches `/events`, `/explore` or `/guide`.

## Requirements Trace

- **R1** New repo runs the CRM against the same Supabase project, same `crm_*` tables, no data migration.
- **R2** Real auth before anything is deployed — the 8-character `ADMIN_SECRET` cookie does not go public.
- **R3** The agent/CLI path (`Bearer CRM_AGENT_TOKEN`, `npm run crm:log`, `GET /api/crm?entity=due`) keeps working.
- **R4** The running tool is never the thing under the knife: the current worktree stays usable until the new repo is proven.
- **R5** One owner per table prefix, written down, so two repos never race on one database.
- **R6** `starter-london` ends up with no CRM code, no `crm:*` npm scripts, and no CRM branch in flight.
- **R7** The `crm-log` skill keeps working from the new repo.

## Scope Boundaries

**In scope**

- New repo with the 42 CRM app files, the CRM-only scripts, the `crm_*` migrations, the CRM plan docs
- Replacement auth
- Its own minimal stylesheet (see Styling — it is ~30 lines, not a 2,779-line copy)
- Deleting the CRM from `starter-london`
- Table-ownership convention across the four repos

**Out of scope**

- Any schema change, any data move — the database is untouched
- The sourcing pipeline's staging layer (`scripts/.staging`, `deeptech.db`, Bright Data) — see Decisions
- New CRM features; this is a move, not a rewrite
- Merging `crm_people` into `crm_contacts` (still outstanding, still a separate decision)

## Decisions (locked)

1. **One Supabase project.** No new project, no data copy. `NEXT_PUBLIC_SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY` are the same values in both repos.
2. **Plain copy, not `git filter-repo`.** The 40 commits stay readable in `starter-london`, which is not
   going anywhere. Carrying history across would mean path-filtering a repo that currently has live
   worktrees, for a record we already keep. The new repo starts with one honest initial commit that
   names its origin.
3. **The pool pipeline moves with the CRM, the staging layer does not.** `crm-log`, `import-people-pool`,
   `export-people` and `scripts/lib/{fit,normalise}.ts` are CRM-only and travel. The local SQLite in
   `scripts/.staging` and the read-only `deeptech.db` stay where their data lives; the enrichment scripts
   that read them move only once they have a home that makes sense.
4. **The new repo owns `crm_*` migrations.** The nine existing files move; `starter-london` stops carrying
   them. Neither repo uses `supabase db push` — the history table is out of sync with what was hand-applied,
   and that stays true after the move.
5. **`feat/crm` merges to `main` first.** Forty commits including every migration and plan doc should not
   live only on a branch. The branch diff is 97 files changed with **one** deletion — no public page moves,
   so byte-for-byte parity on `/events`, `/explore` and `/guide` is preserved. Delete the CRM from `main`
   in a later, separate commit.
6. **Repo name and location: `~/code/ft/deeptech-crm`**, alongside `deeptech-ldn`. Confirm before Phase 1.

## What moves

| | Detail |
|---|---|
| App | 42 files: `src/app/crm/**`, `src/app/api/crm/**`, `src/lib/crm/**`, `src/components/crm/**` |
| Scripts | `crm-log`, `import-people-pool`, `export-people`, `import-deeptech-{sheet,notion}`, `backfill-crm-activity`, `crm-dedupe`, `crm-warm-routes`, `crm-extract-next-action-contacts`, `crm-fix-notion-interactions`, `test-crm-*`, `scripts/lib/{fit,normalise}.ts` |
| Migrations | the 9 `*_crm_*` / `*_people_pool*` files |
| Docs | `docs/crm-runbook.md`, `docs/plans/*crm*`, `docs/plans/2026-08-04-people-sourcing.md`, this file |
| Skill | `.claude/skills/crm-log/` |
| npm scripts | the 6 `crm:*` entries |

## What stays

`scrape`, `seed:kb`, `review-events`, `promote-organisers`, `add-events`, the KB seeds and every
KB/events skill. No script straddles the line — verified, not assumed.

## The one coupling

`src/components/crm/CrmShell.tsx` imports `@/components/AppNav` — the public site's nav, which links to
`/events` and `/explore`. In a standalone CRM it is dead weight. Replace it with the CRM's own header;
that is the entire severance.

## Styling

The CRM renders on six CSS variables — `--muted`, `--line`, `--muted-strong`, `--accent-yellow`,
`--accent-bright`, `--line-strong` — and exactly one class from `globals.css`: `.terminal-panel`. Copying
2,779 lines would be wrong. Write ~30 lines of tokens plus that one class into the new repo's `globals.css`
and let it diverge freely; nothing else in `globals.css` is reachable from a CRM page.

Fonts: `layout.tsx` loads Geist + IBM Plex Mono + Press Start 2P. The CRM uses mono and sans; the pixel
font is the public site's. Take two of the three.

## Auth — the gate before any deploy

Today: `ADMIN_SECRET` (8 chars) compared against a cookie or `x-admin-key` header in `src/middleware.ts`,
plus `Bearer CRM_AGENT_TOKEN` for agents. Localhost-grade.

Target: **Supabase Auth magic link with an email allowlist** for humans, session checked in middleware;
`CRM_AGENT_TOKEN` kept as-is for the CLI and agent routes, but lengthened and rotated. Service-role key
stays server-side only, never in a client component.

This is R2 and it gates Phase 5. Phases 1–4 can run before it because nothing is public yet.

## Table ownership (write it into both READMEs)

| Repo | Owns (writes) | Reads |
|---|---|---|
| `starter-london` | KB: `spaces`, `communities`, `vcs`, `programmes`, `people`, `event_series`; `aitw_*` | — |
| `deeptech-ldn` | `deeptech_expo`, `deeptech_volunteers`, `deeptech_waitlist`, `applications` | — |
| `deeptech-scanner` | `deeptech_scraper_*`, `founder_candidates`, `company_candidates` | — |
| `deeptech-crm` (new) | `crm_*` | all of the above, read-only |

The CRM's expo and volunteer grids read tables another repo writes, with no contract between them. Generate
types from the database in the new repo (`supabase gen types`) so a column rename over there fails a build
here instead of blanking a page.

## Phasing

### Phase 0 — Tidy the current tree (do now)
Commit the volunteers work sitting uncommitted. Merge `feat/crm` → `main`. Nothing else changes; the CRM
still runs where it runs.

### Phase 1 — New repo, read-only proof
`create-next-app` at Next 16 / React 19 / Tailwind 4, current `@supabase/supabase-js` (the 2.100.0 pin exists
only for two `starter-london` admin routes that stay behind). Copy the 42 app files, swap `AppNav` for a local
header, write the token stylesheet. Point `.env.local` at the same Supabase. Success: every page — Today,
Opportunities, Contacts, Expo, Volunteers, Tasks, People, Sourcing, Organisations — loads real data.

### Phase 2 — Writes and the agent path
Copy `src/app/api/crm/**` and the scripts. Success: a status change from the Contacts grid persists;
`npm run crm:log -- entry.json --dry-run` resolves identity; `GET /api/crm?entity=due&days=30` answers;
the CSV exports download.

### Phase 3 — Auth
Replace the shared-secret middleware per the section above. Success: an allowlisted email gets in by magic
link, a non-allowlisted one does not, and the bearer-token path still works headless.

### Phase 4 — Cut over (after 8 October)
Delete from `starter-london`: the 42 app files, the CRM scripts, the `crm:*` npm scripts, the CRM block in
`src/middleware.ts`, the `crm-log` skill, the CRM migrations and plan docs. Update `CLAUDE.md` in both repos.
This is the only destructive step and it happens once the new repo has been the tool people actually use.

### Phase 5 — Deploy
New Vercel project. Env: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRM_AGENT_TOKEN`, plus
whatever auth needs. Gated on Phase 3.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Deployed with weak auth | Phase 3 gates Phase 5. Not negotiable; the service-role key bypasses RLS on a database serving four projects. |
| Breaking the tool mid-expo | Phases 1–3 are additive in a separate directory. Phase 4 waits until after 8 October. |
| Two repos, one database, racing migrations | Ownership table above, in both READMEs. |
| `deeptech-ldn` renames a column | Generated types + a smoke check that selects one row from each source table. |
| `crm-log` silently breaks | Move the skill in the same commit as the scripts; the runbook's invocation lines change repo. |
| `.env` split confusion | The `BRIGHT_DATA_API_KEY`-in-`.env` trap travels with the enrichment scripts. New repo uses one `.env.local` and documents any exception. |

## Verification checklist (run at the end of Phase 2 and again after Phase 4)

- [ ] All ten CRM pages render with real rows
- [ ] Status / labels / note / timeline write and survive a reload
- [ ] Expo and volunteer grids resolve their source rows and sign logo URLs
- [ ] `npm run crm:log` creates and updates without duplicating
- [ ] `/api/crm?entity=due` returns the resurface queue
- [ ] `/api/crm/people/export` variants download
- [ ] Unauthenticated request to a CRM page redirects; to a CRM API returns 401
- [ ] `starter-london` builds green with zero CRM references

## Out of band notes

- `crm_people` (109 rows, Notion import, wired to opportunities) and `crm_contacts` are still two tables.
  The move does not fix that and should not try to.
- The Bright Data key was pasted into a chat transcript at some point; rotate it whenever the enrichment
  scripts next move.
