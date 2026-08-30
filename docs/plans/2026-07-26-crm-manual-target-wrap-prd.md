# DeepTech London CRM Manual Target Wrap PRD

> For Hermes: this is a product/implementation brief plus a copy-paste developer prompt. It is grounded in the existing starter-london CRM and should not invent a parallel system because life is short enough already.

Goal: let Lachlan manually paste rough sponsor/speaker/expo target notes like "here's a company / a person at the company / how we might get to them / an event they're doing / an event they're going to", then turn that into a useful CRM record plus an enrichment/research queue.

Architecture: extend the existing CRM and enrichment substrate in `starter-london` rather than creating a second app or a disconnected prompt toy. Use the current `crm_*` operator tables for trusted records, the current enrichment/import tables for raw intake and reviewable evidence, and add only the thinnest extra plumbing needed for a good manual-first workflow.

Tech stack: Next.js App Router, TypeScript, existing `/crm` pages and `/api/crm` route, Supabase-backed `crm_*` tables, existing enrichment layer (`crm_import_batches`, `crm_import_rows`, `crm_enrichment_jobs`, `crm_source_documents`, `crm_entity_candidates`, `crm_connection_candidates`, `crm_extracted_facts`).

---

## 1. Why this feature exists

The current CRM already has a solid base:
- dashboard at `src/app/crm/page.tsx`
- opportunity detail workbench at `src/app/crm/opportunities/[id]/page.tsx`
- workbench UI in `src/components/crm/OpportunityWorkbench.tsx`
- contact points and outreach log already implemented
- operator data layer in `src/lib/crm/server.ts`
- write API in `src/app/api/crm/route.ts`
- enrichment dashboard in `src/app/crm/enrichment/page.tsx`
- enrichment service layer in `src/lib/crm/enrichment/server.ts`
- foundation/enrichment schema already present in `supabase/migrations/*crm*.sql`

What is missing is the intake wrap between:
1. rough operator thinking
2. a real opportunity/company/person record
3. a queued research workflow

Right now the system is good once records exist. It is weaker at the moment when Lachlan says:
- here is a company we want
- here is someone there
- maybe we can get to them through X
- they are hosting this event during the week
- they are attending that event

That should become structured, reviewable work instead of another doomed note fragment.

---

## 2. User stories

### Primary story
As Lachlan, I want to paste rough target notes in natural language so the CRM creates a usable target wrap for a company/opportunity without forcing me to fill a giant form.

### Supporting stories
- As an operator, I want the system to preserve my raw note exactly, because my note is often more trustworthy than the machine's interpretation.
- As an operator, I want likely person/company/route/event claims split into reviewable pieces.
- As an operator, I want the result to land in the existing opportunity workbench, not in some side dungeon.
- As an operator, I want follow-up/research tasks queued automatically when contacts/routes/events are incomplete.

---

## 3. Example input contract

The intake flow should be designed around rough prompts like:

- These are the companies we want at the expo
- Here is a company
- A person at the company
- How we might get to them
- Here's an event they're doing during the week
- Here's an event they're going to
- What they're connected to
- Some information on them
- Some thoughts

The user will often add this manually, in partial form, and out of order.

Important rule:
- the raw operator text is first-class input, not something to aggressively "clean up" and overwrite

---

## 4. Product shape

Build a new manual-first intake surface inside the current CRM.

### 4.1 New surface
Preferred path:
- add a new page under `/crm/import/manual`

Alternative acceptable path:
- extend `/crm/import` with a "Manual target wrap" section and route from there

The page should support:
- a large textarea for raw notes
- optional workstream selector (`sponsor`, `speaker`, `expo`, etc. using `CRM_WORKSTREAMS`)
- optional owner selector (Lachlan / Barrett)
- optional import type selector based on the existing intent (`sponsor_targets`, `speaker_longlist`, etc.)
- submit button
- a preview/result state showing what was created and what still needs review

### 4.2 What the submission should create
A submission should fan out into existing structures:

1. `crm_import_batches`
- one batch representing the manual intake session

2. `crm_import_rows`
- one or more rows representing each target/company block parsed from the textarea
- preserve the raw parsed payload in `raw_payload`

3. Core CRM records where confidence is high enough
- `crm_organisations`
- `crm_opportunities`
- `crm_people` only when the user clearly named a real person
- `crm_source_links` with `source_system='manual'`

4. Enrichment/review records for uncertain claims
- `crm_enrichment_jobs` for follow-on research
- `crm_source_documents` containing the raw operator note as evidence (`document_type='note'`)
- `crm_entity_candidates` for possible people/orgs if not yet trusted
- `crm_connection_candidates` for warm routes and likely relevance links
- `crm_extracted_facts` for event/relationship claims if useful

This is the right split:
- obvious trusted facts can land in the core CRM
- uncertain or incomplete claims go through the enrichment layer first

---

## 5. The actual target wrap we want

For each manually seeded company/opportunity, the operator should end up with a useful "target wrap" view that answers:
- what company is this?
- what opportunity/workstream does it belong to?
- who at the company matters?
- how might we get to them?
- what event are they hosting during the week?
- what event are they attending?
- what spaces are they connected to?
- what do we think and what should we do next?
- what is user-provided vs inferred vs scraped?

In V1, do not build an entire new page type if the existing opportunity workbench can carry this.

Preferred V1 approach:
- extend `OpportunityWorkbench.tsx`
- add a new section like `Target map` or `Prospect wrap`
- show:
  - linked organisations
  - linked people
  - warm routes / connection candidates
  - week events (doing / attending)
  - operator note
  - source links / provenance
  - outstanding enrichment jobs

The page already has sections for:
- linked people and organisations
- contact points
- outreach log
- linked tasks
- recent interactions
- source links

So do not get clever and duplicate the workbench somewhere else.

---

## 6. Recommended implementation strategy

## Phase 1: manual intake wrap
Ship the smallest useful slice:
- textarea-based intake UI
- parser/normalizer for rough bullets
- import batch + row creation
- create/update organisation/opportunity records
- attach raw note as manual provenance
- queue follow-on enrichment jobs
- show success output with links to created opportunities

### Parsing rule
Keep parsing deliberately simple.

Expect bullets and headings such as:
- company
- person
- route / intro / connection
- event they are doing
- event they are going to
- notes / thoughts

Do not try to build a magical universal NLP parser in V1. That way lies theatre.

A good enough normalization output per target row is:
- `company_name`
- `workstream`
- `target_people[]`
- `warm_routes[]`
- `hosting_events[]`
- `attending_events[]`
- `connections[]`
- `notes`
- `raw_text`

Store this normalized shape in `crm_import_rows.raw_payload`.

## Phase 2: show the wrap in the opportunity workbench
Extend the existing opportunity detail fetch/render path so the workbench can display:
- accepted linked people/orgs from core CRM
- proposed warm routes from `crm_connection_candidates`
- manual note / raw note excerpt from `crm_source_documents`
- week-event claims from extracted facts or structured metadata
- queued enrichment jobs for that opportunity

## Phase 3: add review/promotion actions
Once the display exists, add light operator actions:
- accept proposed person
- accept proposed warm route
- promote event claim into notes/source links
- spawn `discover_contacts` or `org_research` jobs manually

Do not overbuild this in V1 if the intake pipe is not working yet.

---

## 7. Data-model guidance

Use the current schema first. Avoid gratuitous new tables.

### Reuse these existing tables directly
- `crm_organisations`
- `crm_people`
- `crm_opportunities`
- `crm_source_links`
- `crm_import_batches`
- `crm_import_rows`
- `crm_enrichment_jobs`
- `crm_source_documents`
- `crm_entity_candidates`
- `crm_connection_candidates`
- `crm_extracted_facts`

### Existing enums already helpful
From `src/lib/crm/constants.ts` we already have:
- `CRM_WORKSTREAMS`
- `CRM_SOURCE_SYSTEMS` including `manual`
- `CRM_ENRICHMENT_SCOPE_TYPES` including `list_import`
- `CRM_ENRICHMENT_JOB_TYPES` including `discover_contacts`, `org_research`, `speaker_research`, `list_import`
- `CRM_CONNECTION_TYPES` including `warm_route`, `likely_buyer`, `sponsor_target`, `speaker_candidate`
- `CRM_IMPORT_BATCH_TYPES` including `sponsor_targets`, `speaker_longlist`, `people_seed`, `organisation_seed`

### Avoid migrations if possible in V1
Do not add schema unless it clearly earns its keep.

Suggested V1 approach:
- represent "event doing" / "event going to" in `crm_extracted_facts` or `crm_source_documents.metadata`
- represent route suggestions in `crm_connection_candidates`
- represent raw user note in `crm_source_documents`
- represent parsed input blocks in `crm_import_rows.raw_payload`

Only add a migration if the UI becomes obviously painful without it.

If you must add one, keep it narrow. A tiny field beats a new cathedral.

---

## 8. API and server-layer changes

### 8.1 New server helper(s)
Add a dedicated manual intake helper in the CRM service layer or enrichment service layer.

Likely files:
- modify `src/lib/crm/enrichment/server.ts`
- optionally add `src/lib/crm/enrichment/manual-intake.ts`

Suggested responsibilities:
- parse raw manual note blocks
- create import batch
- create import rows
- create/update organisation and opportunity records
- create source document(s) for raw note evidence
- create connection candidates / entity candidates
- queue enrichment jobs
- return a concise result summary for the UI

### 8.2 API shape
Preferred approach:
- extend `src/app/api/crm/route.ts` with a new POST action, e.g. `ingest-manual-target-wrap`

The action should:
- require existing CRM auth, same as current write actions
- accept raw note text plus optional owner/workstream/import type
- call the server helper
- return created IDs and a human-readable summary

Do not create a totally separate admin auth pattern. The repo already has one. Use it.

---

## 9. UI changes

### 9.1 Intake page
Suggested file:
- create `src/app/crm/import/manual/page.tsx`

Suggested UI sections:
- intro text
- textarea for raw notes
- selectors for owner/workstream/import type
- submit button
- result panel listing:
  - created opportunities
  - created organisations
  - created people
  - queued enrichment jobs
  - unresolved rows / review-needed items

### 9.2 CRM import index page
Suggested file:
- modify `src/app/crm/import/page.tsx`

Add:
- link/button to the new manual target wrap flow
- brief explanation that scripts remain for bulk imports, while this surface is for operator-seeded prospect wraps

### 9.3 Opportunity workbench
Suggested file:
- modify `src/components/crm/OpportunityWorkbench.tsx`

Add a section such as:
- `Target map`

Show:
- warm routes
- proposed relevant people
- events they are hosting / attending during the week
- raw operator note
- queued enrichment jobs

Keep it visually consistent with the existing terminal-panel sections. No need for a separate design religion.

---

## 10. Functional requirements

1. Operator can paste rough target notes into a CRM page.
2. Submission creates a manual import batch and rows.
3. Submission preserves the raw note verbatim.
4. System creates or links an organisation and opportunity where confidently available.
5. System creates a person only if clearly named; otherwise it can create a candidate.
6. System stores warm routes and event claims as reviewable data, not silent gospel.
7. System queues enrichment jobs for incomplete sponsor/speaker follow-up.
8. Opportunity detail page can display the resulting wrap.
9. All new writes use current CRM auth and existing API/server patterns.
10. Build must pass and the flow must be testable end-to-end.

---

## 11. Non-goals

Not for this slice:
- fully autonomous web research orchestration
- fancy graph visualization
- multi-user enterprise permissions sludge
- AI-generated confidence theatre with no review path
- replacing the existing sheet/notion importers

This is about making manual prospect seeding actually operational.

---

## 12. Acceptance criteria

A good V1 is done when:
- Lachlan can paste a rough company/person/route/event note into the app
- the app creates a real opportunity record in the current CRM
- the raw note is preserved as provenance
- likely people/routes/events appear in a visible wrap on the opportunity page
- follow-on enrichment jobs are queued for missing data
- the result is obviously more useful than another note in a document

Concrete example of success:
- input: a company, one named person, one possible intro route, one hosted event, one attended event, some notes
- output:
  - organisation created or linked
  - opportunity created or linked
  - person created or proposed
  - raw note attached as manual source evidence
  - warm route shown on the opportunity
  - event claims shown with provenance
  - at least one enrichment job queued if contact details are still missing

---

## 13. Verification plan

Minimum verification:
1. `npm run build`
2. authenticate through `/api/crm/auth` as per current CRM flow
3. submit a manual target wrap through the new UI
4. verify rows in:
   - `crm_import_batches`
   - `crm_import_rows`
   - `crm_source_documents`
   - `crm_enrichment_jobs`
   - relevant core CRM tables
5. open the created opportunity page and verify the wrap sections render sensibly

If the UI works but the raw note vanishes, that is a failure.
If the parser invents facts and hides the original input, that is also a failure.

---

## 14. Copy-paste developer prompt

Use this prompt when handing the task to a developer or coding agent:

```text
Implement a new manual-first "target wrap" intake flow inside the existing CRM in `/Users/lchavasse/code/starter-london`.

Ground yourself in the current code before changing anything. The relevant existing files/areas are:
- `src/app/crm/page.tsx`
- `src/app/crm/import/page.tsx`
- `src/app/crm/opportunities/[id]/page.tsx`
- `src/components/crm/OpportunityWorkbench.tsx`
- `src/app/api/crm/route.ts`
- `src/lib/crm/server.ts`
- `src/lib/crm/enrichment/server.ts`
- `src/lib/crm/constants.ts`
- `src/lib/crm/types.ts`
- `supabase/migrations/20260709131500_crm_foundation.sql`
- `supabase/migrations/20260710190000_crm_outreach_tracking.sql`
- `supabase/migrations/20260711143000_crm_enrichment_substrate.sql`
- `docs/plans/2026-07-11-crm-enrichment-framework.md`
- `docs/plans/2026-07-10-crm-product-roadmap.md`
- `docs/plans/2026-07-26-crm-manual-target-wrap-prd.md`

What to build:
- a new CRM intake surface for rough manual prospect notes
- preferred route: `/crm/import/manual`
- input format should support notes like:
  - here's a company
  - a person at the company
  - how we might get to them
  - here's an event they're doing during the week
  - here's an event they're going to
  - what they're connected to
  - some information on them
  - some thoughts

Product requirements:
- preserve the raw operator note verbatim as provenance
- use the existing CRM and enrichment structure; do not build a parallel subsystem
- create/import through existing `crm_*` tables where sensible
- push uncertain claims into reviewable enrichment records rather than silently treating them as trusted facts
- make the result visible in the existing opportunity workbench

Implementation requirements:
1. Create a manual intake page under `/crm/import/manual` or extend the current import page with an equivalent manual flow.
2. Add a POST action to `/api/crm` for something like `ingest-manual-target-wrap` using the existing CRM auth pattern.
3. Add server-side logic to:
   - parse rough bullet-style input into normalized target rows
   - create a `crm_import_batches` row
   - create `crm_import_rows` rows with structured `raw_payload`
   - create/link `crm_organisations` and `crm_opportunities`
   - create `crm_people` only when clearly named and safe, otherwise use candidates
   - create `crm_source_documents` rows to preserve the raw note (`source_system='manual'`, `document_type='note'`)
   - create `crm_connection_candidates` for warm routes and likely relevance links
   - queue `crm_enrichment_jobs` for missing contact discovery / org research / speaker research
4. Extend `OpportunityWorkbench.tsx` to show a `Target map` or `Prospect wrap` section with:
   - linked organisations and people
   - warm routes / connection candidates
   - event claims for doing/attending during the week
   - raw operator note or note excerpt
   - queued enrichment jobs
5. Reuse existing constants/types/patterns. Avoid adding schema unless clearly necessary.
6. If you absolutely need a migration, keep it minimal and explain why the current schema was insufficient.
7. Keep the UI manual-first, fast, and ugly-in-a-useful-way rather than overengineered.

Important constraints:
- user-entered notes outrank scraped or inferred data
- provenance must remain first-class
- do not duplicate the opportunity detail surface in a new page if the existing workbench can be extended
- do not try to build a magical general NLP system; a simple deterministic parser for common bullets is enough for V1

Verification requirements:
- run `npm run build`
- verify the manual intake creates sensible rows in the CRM/enrichment tables
- verify the created opportunity page renders the wrap correctly
- verify the raw source note is still accessible after ingest

Deliverables:
- code changes
- any minimal migration(s), if needed
- brief notes explaining the parser assumptions and where uncertain data lands
```

---

## 15. Recommended implementation posture

The taste call here is simple:
- do not build a generic CRM ontology circus
- do not throw away rough operator text
- do not make manual prospecting depend on perfect structure
- do make the existing opportunity workbench the place where this becomes actionable

That is the right shape.
