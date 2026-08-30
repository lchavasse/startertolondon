# DeepTech London CRM Enrichment Framework Plan

> For Hermes: use subagent-driven-development if implementing this in multiple passes. Do not keep bolting ad hoc fields onto opportunities. That road leads to a very ugly swamp.

Goal: replace one-off manual enrichment with a systematic, extensible import → search → scrape → extract → connect → review pipeline that can take a rough target list and steadily turn it into useful sponsor/speaker/network intelligence.

Architecture: keep `crm_opportunities`, `crm_people`, `crm_organisations`, and `crm_source_links` as the operator-facing core, but add a separate enrichment layer that stores raw evidence, search runs, extraction results, and candidate connections before promoting anything into the primary CRM record. This keeps the CRM clean, makes provenance first-class, and avoids spraying half-trusted scraped fluff directly onto important records.

Tech stack: Next.js app router, Supabase Postgres, TypeScript scripts, browser-first research workflows, explicit review queues, and deterministic promotion into core CRM tables.

---

## 1. What is wrong with the current shape

Right now we have:
- imported opportunities
- imported orgs/people
- some source provenance
- a decent manual workbench

What we do not have:
- a systematic way to search for better information per opportunity
- a place to store raw fetched pages and search results
- a distinction between raw evidence, extracted claims, and accepted CRM facts
- a way to model likely contacts/relationships before we trust them
- a proper enrichment queue with statuses and retries

So every new bit of info risks becoming:
- duplication
- undocumented manual interpretation
- more notes on the opportunity page
- more brittle importer special-casing

That is not a framework. That is just artisanal chaos.

---

## 2. Product principles for the enrichment layer

1. Core CRM records stay relatively clean.
2. Scraped data never silently overwrites user-entered notes.
3. Every enrichment fact must point back to source evidence.
4. Search, scrape, extract, and promotion are separate stages.
5. Each stage should be rerunnable and idempotent.
6. The framework should work for sponsor targets, speaker candidates, topic research, and useful network mapping.
7. Browser-first research should remain the default for tricky/manual cases.

---

## 3. Conceptual model

We need three layers.

### Layer A: operator CRM
The records humans work from every day.
- `crm_opportunities`
- `crm_people`
- `crm_organisations`
- `crm_tasks`
- `crm_interactions`
- `crm_contact_points`
- `crm_outreach_entries`

### Layer B: enrichment workspace
The machine room where we gather and assess evidence.
- enrichment jobs
- search queries/runs
- search hits
- fetched source documents
- extracted facts
- candidate entities
- candidate connections

### Layer C: reviewed/promoted knowledge
The subset of enrichment outputs that have been accepted into the operator CRM.
- accepted people/org/contact points
- accepted relationship links
- accepted notes/facts backfilled into core CRM
- accepted provenance rows in `crm_source_links`

This separation matters. Otherwise every scrape becomes a vandalism pass on production data.

---

## 4. Proposed data model additions

These should be added as new `crm_*` tables, because they belong to the CRM domain, but clearly separated from the operator-facing core.

### 4.1 `crm_enrichment_jobs`
One job per target enrichment run.

Purpose:
- represent “enrich this opportunity/org/person/topic” as a queued/retryable unit
- track status across stages

Fields:
- `id`
- `scope_type` enum: `opportunity | organisation | person | topic | list_import`
- `scope_id` uuid nullable
- `job_type` enum: `discover_contacts | org_research | speaker_research | topic_research | list_import`
- `status` enum: `queued | searching | scraping | extracting | review | promoted | failed | cancelled`
- `priority`
- `requested_by_user_id`
- `assigned_to_user_id` nullable
- `input_payload` jsonb
- `result_summary` text nullable
- `error_log` text nullable
- `started_at`
- `completed_at`
- timestamps

### 4.2 `crm_search_runs`
Each search attempt made for a job.

Purpose:
- log search prompts/queries and source provider used
- keep multiple search attempts over time

Fields:
- `id`
- `job_id` fk
- `provider` enum/string: `browser`, `manual`, `google`, `linkedin`, `company_site`, `notion`, etc.
- `query`
- `status`
- `notes`
- timestamps

### 4.3 `crm_search_hits`
Results returned by a search run.

Purpose:
- hold candidate URLs/targets before fetching and extracting

Fields:
- `id`
- `search_run_id` fk
- `title`
- `url`
- `snippet`
- `domain`
- `rank`
- `hit_type` enum/string: `company_site | linkedin_profile | linkedin_company | team_page | article | directory | event_page | other`
- `selected_for_fetch` boolean
- timestamps

### 4.4 `crm_source_documents`
Fetched/raw pages or documents.

Purpose:
- preserve raw evidence and extracted text separately from CRM notes

Fields:
- `id`
- `job_id` fk nullable
- `search_hit_id` fk nullable
- `source_system`
- `url`
- `title`
- `document_type`
- `fetched_at`
- `raw_text`
- `metadata` jsonb
- `content_hash`
- `parse_status`
- timestamps

### 4.5 `crm_extracted_facts`
Atomic extracted claims from source documents.

Purpose:
- store machine- or human-extracted facts before they are trusted

Fields:
- `id`
- `job_id` fk
- `source_document_id` fk
- `subject_type` enum: `organisation | person | opportunity | topic`
- `subject_temp_key` text nullable
- `fact_type` enum/string: `website | linkedin_url | person_name | person_role | contact_email | contact_phone | location | market | sponsor_fit | speaker_topic | relationship_claim | other`
- `fact_value` text
- `confidence` numeric
- `evidence_excerpt` text
- `status` enum: `proposed | accepted | rejected | superseded`
- timestamps

### 4.6 `crm_entity_candidates`
Potential people/orgs found during enrichment, before promotion.

Purpose:
- avoid immediately creating low-quality real CRM entities

Fields:
- `id`
- `job_id` fk
- `entity_type` enum: `person | organisation`
- `name`
- `headline_or_role`
- `website`
- `linkedin_url`
- `location`
- `summary`
- `confidence`
- `status` enum: `proposed | accepted | rejected | merged`
- `promoted_entity_id` uuid nullable
- timestamps

### 4.7 `crm_connection_candidates`
Potential relationships discovered during enrichment.

Purpose:
- model “this person works at this org”, “this person is likely relevant to this opportunity”, “this org is connected to this space”, etc.

Fields:
- `id`
- `job_id` fk
- `from_entity_type`
- `from_entity_id` uuid nullable
- `from_candidate_id` uuid nullable
- `to_entity_type`
- `to_entity_id` uuid nullable
- `to_candidate_id` uuid nullable
- `connection_type` enum/string: `works_at | sponsor_target | speaker_candidate | founder_of | partner_at | knows_space | likely_buyer | warm_route`
- `label` text nullable
- `confidence`
- `evidence_excerpt`
- `status` enum: `proposed | accepted | rejected`
- timestamps

### 4.8 `crm_import_batches`
Tracks list imports before/alongside enrichment.

Purpose:
- import a rough CSV/list and process it systematically

Fields:
- `id`
- `source_system`
- `name`
- `source_url`
- `import_type` enum: `sponsor_targets | speaker_longlist | topic_seed | people_seed | organisation_seed`
- `row_count`
- `status`
- `metadata` jsonb
- timestamps

### 4.9 `crm_import_rows`
Each imported row from a list.

Purpose:
- preserve row-level provenance and support staged normalization

Fields:
- `id`
- `batch_id` fk
- `row_index`
- `raw_payload` jsonb
- `normalized_name`
- `normalized_type`
- `linked_opportunity_id` nullable
- `linked_candidate_id` nullable
- `linked_entity_id` nullable
- `status` enum: `pending | normalized | queued_for_enrichment | promoted | skipped | failed`
- timestamps

---

## 5. The pipeline we actually want

### Stage 0: import a list
Input examples:
- sponsor target account list
- speaker longlist
- list of companies from a topic/theme
- names dumped from notes

Behaviour:
- create `crm_import_batch`
- create `crm_import_rows`
- create or link minimal `crm_opportunities` only where appropriate
- queue enrichment jobs per row or per linked opportunity

### Stage 1: search
For each job:
- run one or more targeted searches
- store runs in `crm_search_runs`
- store hits in `crm_search_hits`
- mark best candidates for fetch

Search heuristics by job type:
- sponsor org: company site, team page, leadership, partnerships, marketing, developer relations, events, startup programmes
- speaker org/person: founder profile, personal site, LinkedIn, talks, podcast appearances, technical writing
- topic research: relevant companies, labs, researchers, founders, operators, repeat speakers, adjacent communities

### Stage 2: scrape/fetch
For selected hits:
- fetch page text
- store in `crm_source_documents`
- dedupe by `content_hash` + URL
- preserve raw text and metadata

### Stage 3: extract
From source documents, derive:
- candidate people
- candidate organisations
- contact points
- factual attributes
- candidate connections

Store these in:
- `crm_extracted_facts`
- `crm_entity_candidates`
- `crm_connection_candidates`

### Stage 4: review
Human or agent review surface should answer:
- which candidates look real?
- which contacts are useful?
- which relationships matter?
- what should be promoted into core CRM?

### Stage 5: promote
Promotion writes into core CRM tables:
- `crm_people`
- `crm_organisations`
- `crm_person_organisations`
- `crm_opportunity_people`
- `crm_opportunity_organisations`
- `crm_contact_points`
- `crm_source_links`
- maybe summary notes on opportunity/org/person

Promotion must be explicit and idempotent.

---

## 6. Connections model: what matters

The user explicitly wants search and connections, not just more scraped paragraphs.

So connection types need to be first-class.

Important connection families:
- person → organisation: works at / founder of / partner at / investor at
- person → opportunity: relevant contact / warm route / speaker candidate / sponsor buyer
- organisation → opportunity: target sponsor / possible partner / speaker company / expo company
- person → concept/topic: relevant to topic / potential speaker on topic
- organisation → concept/topic: credible in topic / likely sponsor for topic
- person → person: knows / introduced by / warm route via

Do not force all of these straight into one giant blessed table on day one.
Start with `crm_connection_candidates` in enrichment, then promote the ones we actually use into existing relation tables or a later stable graph layer.

---

## 7. Search framework rules

The search framework should be declarative, not a pile of special-case spaghetti.

Add a config-like module, e.g.:
- `src/lib/crm/enrichment/playbooks.ts`

Each playbook defines:
- scope type
- job type
- search query templates
- preferred source types
- extraction goals
- ranking heuristics
- promotion rules

Example playbooks:
- sponsor target enrichment
- speaker candidate enrichment
- topic expansion
- network/contact discovery

Each playbook should say things like:
- for sponsor targets, prioritise company site + team pages + LinkedIn company + leadership pages
- for speaker candidates, prioritise personal site + founder bio + talk/video pages + podcast appearances
- for topic expansion, prioritise company lists, labs, researchers, founders, communities, and prior event pages

That makes the framework extensible without rewriting the whole thing every time Lachlan wants one more workstream. A shocking concept, I know.

---

## 8. Operator UX we should build around it

### 8.1 Enrichment queue page
Add `/crm/enrichment`

Views:
- queued jobs
- in review
- failed jobs
- promoted jobs

Filters:
- sponsor
- speaker
- topic
- org research
- missing contacts
- stale research

### 8.2 Opportunity enrichment panel
On each opportunity page show:
- enrichment status
- last search run
- candidate contacts found
- candidate relationships found
- raw evidence count
- button to “run enrichment”
- button to “review candidates”

### 8.3 Import page v2
Current import page should evolve into:
- import batch history
- upload/list ingestion
- normalize preview
- queue enrichment jobs
- review/promotion summary

---

## 9. Implementation plan

## Phase 1 — build the enrichment substrate

### Task 1: Add new enrichment tables
Create migration(s) for:
- `crm_enrichment_jobs`
- `crm_search_runs`
- `crm_search_hits`
- `crm_source_documents`
- `crm_extracted_facts`
- `crm_entity_candidates`
- `crm_connection_candidates`
- `crm_import_batches`
- `crm_import_rows`

Objective: create a proper workspace layer without touching operator records yet.

### Task 2: Extend TS constants and types
Files:
- `src/lib/crm/constants.ts`
- `src/lib/crm/types.ts`

Add enums and interfaces for:
- enrichment job statuses/types
- source document types
- fact types/statuses
- candidate statuses
- connection types/statuses
- import batch/row statuses

### Task 3: Add core enrichment server module
Create:
- `src/lib/crm/enrichment/server.ts`
- maybe `src/lib/crm/enrichment/playbooks.ts`

Responsibilities:
- queue jobs
- create search runs
- record hits
- store documents
- store extracted facts/candidates/connections
- promote accepted candidates into CRM

---

## Phase 2 — list import framework

### Task 4: Introduce import batch abstraction
Create:
- `scripts/import-crm-list.ts`
- maybe `src/lib/crm/enrichment/importers.ts`

Objective: accept a list/CSV/JSON and write:
- `crm_import_batches`
- `crm_import_rows`
- minimal linked opportunities/entities where appropriate
- queued enrichment jobs

### Task 5: Refactor existing DeepTech imports to use shared plumbing where sensible
Files:
- `scripts/import-deeptech-sheet.ts`
- `scripts/import-deeptech-notion.ts`

Objective:
- keep them working
- move common source-link/idempotency/import-batch logic into shared helpers
- stop every importer being its own homemade religion

---

## Phase 3 — search and scrape framework

### Task 6: Add search-run orchestration
Create:
- `scripts/run-crm-enrichment.ts`
- or `scripts/run-crm-job.ts`

Objective:
- pull queued jobs
- choose playbook
- create search queries
- store hits
- mark good URLs for fetch

For now, start with deterministic search seeds:
- official website
- LinkedIn/company pages when already known
- team/about/leadership/contact URLs inferred from official site
- curated/manual URLs from source links

Later, layer broader web discovery on top.

### Task 7: Add document fetch + extraction pipeline
Create:
- `src/lib/crm/enrichment/fetch.ts`
- `src/lib/crm/enrichment/extract.ts`

Objective:
- fetch pages
- clean text
- store raw evidence
- extract structured facts and candidates

Initial extraction targets:
- organisation website
- LinkedIn/company URL
- named people
- roles/titles
- contact emails
- obvious relationship claims
- sponsor fit notes
- speaker-topic fit notes

---

## Phase 4 — review and promotion UI

### Task 8: Add `/crm/enrichment`
Create pages/components for:
- job queue
- review surface
- candidate promotion actions

### Task 9: Add opportunity-level enrichment panel
Modify opportunity workbench to show:
- latest enrichment status
- candidate contact count
- candidate connection count
- run/review actions

### Task 10: Add promotion actions to `/api/crm`
Add actions like:
- `queue-enrichment-job`
- `promote-entity-candidate`
- `promote-connection-candidate`
- `accept-extracted-fact`
- `reject-*`

Promotion rules must:
- create or merge core CRM records safely
- create `crm_source_links`
- preserve provenance
- avoid clobbering trusted human notes

---

## 10. What to import first once framework exists

Priority order:
1. sponsor target organisations
2. speaker/company longlists
3. topic seed lists
4. “important people” network lists

Why:
- sponsor and speaker sourcing are the highest-value repeated workflows
- topic work becomes much better once sponsor/speaker enrichment exists
- people/network routing is valuable, but it benefits from the same framework rather than needing a separate bespoke snowflake

---

## 11. Verification

After implementation of the substrate:
- `npm run build`
- `supabase db push`
- run a small import batch of 3–5 rows
- verify batch rows and jobs were created
- run one sponsor enrichment job
- verify search hits, source docs, extracted facts, candidates, and connections appear
- promote one candidate person and one contact point
- verify they show up on the linked opportunity/org/person pages

Success criteria:
- importing a rough list does not directly dump noise into core CRM
- each opportunity can accumulate reviewed evidence over time
- search/scrape outputs are systematic and provenance-backed
- candidates and connections can be promoted cleanly
- the same framework can support sponsors, speakers, topics, and network mapping

---

## 12. Recommended immediate next build slice

Do next:
1. enrichment substrate tables
2. shared enrichment server module
3. import batch abstraction
4. one sponsor-target enrichment playbook
5. simple review queue page

That gives us a real framework.

Anything else before that is just inventing more tasteful-looking duplication.
