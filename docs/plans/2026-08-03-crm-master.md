# CRM Master Coordination Doc

Created 2026-08-03. Branch `feat/crm`, worktree `.claude/worktrees/crm`.

**This doc is the plan, not the state.** Shared state lives in Supabase `crm_*`. Agents write
candidates, facts and documents there — never to this file. Update the status table below when a
chunk lands; don't accumulate findings here.

---

## Decisions taken (2026-08-03)

| Question | Decision |
|---|---|
| Where the CRM lives | **Extend starter-london.** Not Attio, not me.sh. We own the schema; agents get direct Supabase access. |
| First build | **Chase loop + agent bridge.** Not the 26 Jul intake PRD. |
| Enrichment vendor | **Bright Data now** (skill already wired). Exa deferred. |
| Orchestration | Coordination doc + chunked Claude Code prompts. Supabase is the shared state. |

---

## Where things actually stand

Committed at `7d683e3` — 50 files, 6,735 lines, previously untracked since 11 Jul.

Live data in Supabase:

| Table | Rows |
|---|---|
| `crm_organisations` | 191 |
| `crm_opportunities` | 196 (all `active`; 122 sponsor, 29 community_partner, 22 expo, 19 speaker, 4 week_ops) |
| `crm_people` | 51 |
| `crm_tasks` | 44 (41 todo) |
| `crm_interactions` | 55 |
| `crm_contact_points` | **0** |
| `crm_outreach_entries` | **0** |
| all 9 enrichment substrate tables | **0** |

Field completeness on `crm_opportunities`:

- `next_action` — 100/196
- `owner_user_id` — 86/196
- `next_followup_at` — **0/196**
- `last_activity_at` — **0/196**
- `stage` — **0/196**

### The core problem

`src/app/crm/page.tsx` already renders Overdue follow-ups, Overdue tasks, Due today, and Needs next
action. The chase loop **is built**. It renders empty because nothing populates the date fields it
ranks on, and nothing has ever written an outreach entry.

So this is not a UI project. It is a data-and-plumbing project.

### The second problem

`/api/crm` is write-only — 8 upsert/add actions. Every read happens in a server component via
`src/lib/crm/server.ts`, behind a browser cookie (`middleware.ts`, `ADMIN_SECRET`). **Hermes cannot
read the CRM today.** Nothing else parallelises safely until that's fixed.

### The asset nobody has used

The enrichment substrate (`20260711143000_crm_enrichment_substrate.sql`) is migrated to prod and
completely unused: `crm_enrichment_jobs`, `crm_search_runs`, `crm_search_hits`,
`crm_source_documents`, `crm_extracted_facts`, `crm_entity_candidates`,
`crm_connection_candidates`, `crm_import_batches`, `crm_import_rows`.

`crm_source_documents.source_system` already permits `granola | gmail | whatsapp | linkedin | notion
| sheet | manual`. `crm_connection_candidates.connection_type` already includes `warm_route`. The
schema was designed for exactly the three directions below. **Do not add tables.** Feed these.

---

## Chunk status

| # | Chunk | Depends on | Where | Status |
|---|---|---|---|---|
| 0 | Agent bridge + chase loop | — | Claude Code | not started |
| 1 | LinkedIn graph import | — | Claude Code | not started |
| 2 | deeptech-scanner join + warm routes | 1 | Claude Code | not started |
| 3 | Conversation ingest (Granola/Notion) | 0 | Hermes | not started |
| 4 | Bright Data enrichment | 2 | Claude Code | not started |
| 5 | Manual target wrap (the 26 Jul PRD) | 0 | Claude Code | deferred |

Chunks 0 and 1 are independent — run them in parallel. Chunk 1 writes to Supabase directly via a
`tsx` script and needs no API.

---

## Source data inventory

**LinkedIn export** — `~/Downloads/Complete_LinkedInDataExport_08-02-2026.zip.zip` (note the double
`.zip`). Relevant members:

| File | Rows | Columns that matter |
|---|---|---|
| `Connections.csv` | 3,932 | First Name, Last Name, URL, Email Address, Company, Position, Connected On. Header is on line 4 — three notes lines precede it. |
| `messages.csv` | 10,341 | CONVERSATION ID, FROM, SENDER PROFILE URL, TO, RECIPIENT PROFILE URLS, DATE, SUBJECT, CONTENT, FOLDER |
| `Invitations.csv` | 2,274 | From, To, Sent At, Message, Direction, inviterProfileUrl, inviteeProfileUrl |

**deeptech-scanner** — `~/code/deeptech-scanner/deeptech.db` (sqlite):

- `companies` — 3,331 (2,239 UK). Has `linkedin_company_url` on only 330; `founders` freetext on 2,675.
- `founder_candidates` — 1,060, `linkedin_match_status` **100% `unresolved`**
- `job_postings` 265, `company_candidates` 421, `pending_companies` 323

**Validated overlap.** Exact company-name match, no fuzzing: **184 of 3,331 scanner companies have
≥1 direct 1st-degree LinkedIn connection — 300 people.** Top: Imperial College London (26), Oxford
(9), ElevenLabs (8), Wayve (7), Automata (5), Dexory (4), Rivan Industries (4), Speechmatics (4),
Callosum (4), Dex (4), Proxima Fusion (3). Fuzzy matching will raise this.

**Hermes** — `~/.hermes/.env` holds `GRANOLA_API_KEY`, `NOTION_API_KEY`, `TELEGRAM_BOT_TOKEN`,
Browserbase. That's why chunk 3 belongs to Hermes.

---

## Chunk 0 — Agent bridge + chase loop (the MVP)

The one that unblocks everything. Keep it small.

**Design note.** Do not build a general read API. Supabase already exposes one — Hermes can hit
`$NEXT_PUBLIC_SUPABASE_URL/rest/v1/crm_*` with the service role key for arbitrary reads. Build only
(a) composed views raw REST can't express cheaply, and (b) writes that carry business logic.

```text
Work in the `feat/crm` worktree at /Users/lchavasse/code/starter-london/.claude/worktrees/crm.
Read docs/plans/2026-08-03-crm-master.md first for context, then ground yourself in:
- src/app/crm/page.tsx, src/lib/crm/server.ts (fetchCrmDashboardData), src/lib/crm/types.ts
- src/app/api/crm/route.ts, middleware.ts, src/lib/crm/constants.ts
- supabase/migrations/20260710190000_crm_outreach_tracking.sql
- supabase/migrations/20260711143000_crm_enrichment_substrate.sql

PROBLEM: the CRM dashboard renders Overdue follow-ups / Due today / Needs next action, but
crm_opportunities has next_followup_at=0/196, last_activity_at=0/196, stage=0/196, and
crm_outreach_entries is empty. The chase surface is built and starving. Separately, /api/crm is
write-only and gated on a browser cookie, so agents cannot read or write the CRM.

BUILD, in this order:

1. Agent auth. Add CRM_AGENT_TOKEN to the env contract. Accept `Authorization: Bearer
   <CRM_AGENT_TOKEN>` as an alternative to the existing cookie in BOTH middleware.ts and
   /api/crm. Do not weaken the cookie path. Document the new var in CLAUDE.md.

2. GET /api/crm — composed reads only, three resources:
   - `?resource=chase` — the work queue. Active opportunities ranked by: overdue next_followup_at,
     then no next_action, then no owner, then stalest last_activity_at. Include org name, owner,
     contact points, and the most recent outreach entry per opportunity.
   - `?resource=opportunity&id=<uuid>` — reuse fetchCrmOpportunityDetail.
   - `?resource=search&q=<text>` — name match across opportunities/orgs/people, so an agent can
     resolve "the Wayve thing" to a UUID.
   Return JSON. No pagination beyond a `limit` param.

3. Write actions on POST /api/crm, following the existing action-dispatch pattern exactly:
   - `log-outreach` — insert crm_outreach_entries AND set the parent opportunity's
     last_activity_at, plus next_followup_at/next_action when next_step/next_due_at are supplied.
     This coupling is the whole point; do not let a caller log outreach without touching the parent.
   - `set-next-step` — set next_action + next_followup_at + owner on an opportunity.
   - `ingest-document` — insert crm_source_documents (source_system, document_type, raw_text,
     url, metadata, content_hash). Dedupe on content_hash, which already has a unique index.
     This is the landing pad for chunks 1 and 3; get the shape right.

4. Backfill semantics. last_activity_at is null everywhere and that makes "stalest first" useless.
   Write scripts/backfill-crm-activity.ts to set last_activity_at from the newest of
   (crm_interactions.happened_at, crm_outreach_entries.happened_at, updated_at) per opportunity.
   Report what it changed; do not guess next_followup_at — that is Lachlan's call.

5. Dashboard. Add a "No contact route" panel (active opportunities whose org has zero
   crm_contact_points) — with 0 contact points that will initially list everything, which is the
   honest signal. Keep the existing terminal-panel styling; do not restyle.

CONSTRAINTS
- Extend existing files. No new tables, no new migration unless you can state exactly why the
  current schema is insufficient.
- Reuse CRM_* constants for every enum. Never inline a status string.
- Match surrounding code style — no comments unless the file already comments.
- Server components stay server components; do not convert pages to client fetching.

VERIFY
- `npm run build` passes.
- Write scripts/test-crm-agent-api.ts exercising each GET resource and each new POST action against
  the live Supabase, printing results. Run it. Show me real output, not a claim.
- Confirm a bearer-token request succeeds and a no-credential request still 401s.

Report: what you built, what the backfill changed, and anything in the plan that turned out wrong.
```

## Chunk 1 — LinkedIn graph import

Independent of chunk 0. Pure data, writes straight to Supabase.

```text
Work in the `feat/crm` worktree at /Users/lchavasse/code/starter-london/.claude/worktrees/crm.
Read docs/plans/2026-08-03-crm-master.md first. Ground yourself in
supabase/migrations/20260711143000_crm_enrichment_substrate.sql and src/lib/crm/constants.ts.

GOAL: load Lachlan's LinkedIn export into the CRM enrichment substrate so the CRM knows who he
already knows and who he has already talked to.

SOURCE: ~/Downloads/Complete_LinkedInDataExport_08-02-2026.zip.zip (yes, double .zip).
Extract to a gitignored scratch dir — never commit the export, it contains personal data.
- Connections.csv — 3,932 rows. Header is on LINE 4; three notes lines precede it. Columns:
  First Name, Last Name, URL, Email Address, Company, Position, Connected On.
- messages.csv — 10,341 rows. Columns include CONVERSATION ID, FROM, SENDER PROFILE URL, TO,
  RECIPIENT PROFILE URLS, DATE, SUBJECT, CONTENT, FOLDER.
- Invitations.csv — 2,274 rows, with Direction (OUTGOING/INCOMING) and Message.

BUILD scripts/import-linkedin-export.ts (npm script `crm:import-linkedin`), idempotent, re-runnable:

1. One crm_import_batches row, source_system='linkedin', import_type='people_seed'.
2. Each connection → a crm_import_rows row with the full raw record in raw_payload, and a
   crm_entity_candidates row (entity_type='person', linkedin_url, headline_or_role from Position,
   name, status='proposed'). Do NOT create crm_people — these are candidates until promoted.
3. Each connection with a Company → a crm_connection_candidates row, connection_type='works_at',
   from the person candidate to an org (match crm_organisations on normalised name; leave
   to_entity_id null when there's no match rather than inventing an org).
4. messages.csv → group by CONVERSATION ID. Per counterparty, derive:
   last_message_at, message_count, direction of the last message, and whether Lachlan sent the
   last message (i.e. he is awaiting a reply). Write ONE crm_source_documents row per conversation:
   source_system='linkedin', document_type='note', raw_text = the thread, metadata = the derived
   fields + counterparty profile URL. Set content_hash so re-runs dedupe.
5. Invitations.csv → metadata only; record outgoing invites with no resulting connection as a
   distinct signal in the batch metadata. Do not create candidates for these.

MATCHING: normalise names and company names (lowercase, strip punctuation/whitespace/legal suffixes
like Ltd/Limited/Inc). Where a connection's LinkedIn URL already appears on a crm_people row, link
the candidate to it via promoted_entity_id instead of duplicating.

TOKEN DISCIPLINE: this is 10k messages. Do all of it in TypeScript — no LLM calls anywhere in this
script. Derived fields only; never send message bodies to a model.

VERIFY: print a summary — candidates created, connections matched to existing orgs, conversations
ingested, how many threads are awaiting Lachlan's reply vs the counterparty's. Re-run it and show
the second run creates nothing new.
```

## Chunk 2 — deeptech-scanner join + warm routes

Depends on chunk 1 (needs the candidates loaded).

```text
Work in the `feat/crm` worktree. Read docs/plans/2026-08-03-crm-master.md first. Chunk 1 must have
run — crm_entity_candidates should hold ~3.9k LinkedIn people.

GOAL: for every deeptech-scanner company, find out whether Lachlan already has a route in.

SOURCE: ~/code/deeptech-scanner/deeptech.db (sqlite, read-only — open it read-only and do not
write to it). Tables: companies (3,331; 2,239 UK), founder_candidates (1,060, linkedin_match_status
all 'unresolved'). See its own CLAUDE.md.

ALREADY VALIDATED: exact company-name matching yields 184 companies / 300 people at 1st degree.
Beat that with fuzzy matching.

BUILD scripts/crm-scanner-join.ts (npm script `crm:scanner-join`), idempotent:

1. Read companies from sqlite. Normalise names (lowercase, strip punctuation and legal suffixes).
   Match against (a) crm_organisations and (b) the Company field on LinkedIn person candidates.
   Use exact-normalised first, then token-overlap fuzzy, and record which strategy matched so the
   fuzzy tier can be audited separately. Do not accept a fuzzy match below a threshold you state.
2. For each scanner company with a 1st-degree connection, write a crm_connection_candidates row,
   connection_type='warm_route', from the connected person to the org, with evidence_excerpt naming
   the person, their Position, and when they connected. status='proposed' — Lachlan reviews.
3. Second-degree: where a scanner company has founder_candidates but no direct connection, look for
   connections who share that company's *investors* or a prior employer named in the scanner
   `founders`/`source_context` fields. Write those as connection_type='warm_route' too, with lower
   confidence and evidence_excerpt spelling out the inferred hop. Be conservative: a bad warm route
   suggestion is worse than none.
4. Write one crm_enrichment_jobs row (scope_type='list_import', job_type='org_research',
   status='review') representing the join run, and hang everything off it.

DO NOT copy the scanner's 3,331 companies into crm_organisations. Only create/link an org when
there's a real route worth chasing. The scanner stays the system of record for company data;
the CRM records the relationship.

VERIFY: print the top 40 companies by route strength — company, UK location, sector, who connects
us, their role. Report the exact/fuzzy/2nd-degree split so we can see how much is inference.
```

## Chunk 3 — Conversation ingest (Hermes)

Depends on chunk 0's `ingest-document` action. Belongs to Hermes because it holds the keys.

Shape: Granola transcripts and the relevant Notion pages POST to `/api/crm` with
`action=ingest-document`, `source_system='granola'|'notion'`, `document_type='note'`, raw text
preserved verbatim, `content_hash` set for dedupe. Then a second pass proposes
`crm_extracted_facts` (`relationship_claim`, `contact_email`, `person_role`) and
`crm_connection_candidates` against existing opportunities — proposed, never auto-accepted.

Write the Hermes prompt once chunk 0 has landed and the endpoint shape is real rather than assumed.

## Chunk 4 — Bright Data enrichment

Depends on chunk 2. Use the `brightdata` skill.

Targets, in priority order:
1. The 1,060 `founder_candidates` with `linkedin_match_status='unresolved'` — resolve to profiles.
2. The scanner companies that matched a warm route but have no `linkedin_company_url` (only 330 of
   3,331 have one).
3. Headcount/stage/HQ for companies on the shortlist chunk 2 surfaces.

Land everything in `crm_source_documents` (`document_type='linkedin_profile'|'linkedin_company'`)
and propose `crm_extracted_facts`. Do not overwrite operator-entered values — user notes outrank
scraped data. Scope the spend to the shortlist, not all 3,331.

## Chunk 5 — Manual target wrap (deferred)

`docs/plans/2026-07-26-crm-manual-target-wrap-prd.md`, unimplemented. Good spec, still worth
building — but it is intake, and intake is less valuable than the chase loop while the chase loop
is empty. Two amendments when we do build it:

- Use an LLM extractor (copy the cached-Haiku pattern in `src/lib/llm/sector-tagger.ts`), not the
  deterministic bullet parser the PRD insists on. Raw text is preserved either way, so the
  downside is bounded.
- Route it through chunk 0's `ingest-document` rather than writing `crm_source_documents` directly.

---

## Conventions for every chunk

- Branch `feat/crm`, worktree `.claude/worktrees/crm`. Not `main`.
- Never commit the LinkedIn export or anything derived containing message bodies. Scratch dirs only.
- `deeptech.db` is read-only from here.
- Enums come from `src/lib/crm/constants.ts`. Never inline a status string.
- Uncertain claims land in `*_candidates` / `crm_extracted_facts` with `status='proposed'`.
  Nothing auto-accepts.
- Operator-entered data outranks scraped or inferred data, always.
- No new tables without stating why the existing schema is insufficient.
- Every import script is idempotent and prints a real summary.
