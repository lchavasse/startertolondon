# DeepTech London CRM / Outreach Ops Plan

> For Hermes: planning only. Do not implement from this file without a separate execution step.

## Goal
Create a pragmatic, shared CRM/admin system for DeepTech London that centralises sponsors, speakers, expo, attendees, partners and follow-ups; starts manual-first; syncs with the current Google Sheet, Notion and Supabase inputs; and can later grow into agent-assisted outreach and enrichment.

## What exists today

### 1) Google Sheet: `Deep Tech London`
Observed tabs:
- `Jobs List` — ad hoc tasks with `type`, `priority`, `notes`, `assignee`, `links`
- `Important People`
- `VCs`
- `Sponsors`
- `Speakers`
- `Expo`
- `Community Partners`
- `Launch`
- plus `Costs`, `Accelerators to get involved`

Sheet strengths:
- useful raw operating data
- ownership/status already appear in several tabs
- categories map reasonably well to real workflows

Sheet problems:
- same person/org can appear in multiple tabs
- status values are inconsistent (`warm`, `messaged`, `call 10.07`, `CHASE UP`, `pending intro`)
- no canonical person/org record
- tasks and relationships are mixed into notes fields
- no conversation timeline
- no proper follow-up engine

### 2) Notion: `DeepTech Week`
Observed structure includes:
- child pages: `Proposal`, `Sponsorship Plan`, `Side Events`, `Founders / Companies`, `Working.`, `Venues`, `Expo Form`, `Community Partner Email`, weekly pages like `08.07`
- rough outreach copy, sponsorship ideas, target lists, venue requirements, working notes, and weekly operating notes

Notion strengths:
- rich context and strategy notes
- useful raw text for relationship context and message drafting
- holds the “why” and narrative better than the sheet

Notion problems:
- information is buried in prose/to-do blocks
- duplicate lists exist both here and in the sheet
- no structured linkage between page notes and actual contacts/opportunities
- weekly notes are valuable but not connected to actionable CRM entities

### 3) `starter-london` repo / Supabase
Confirmed:
- existing Next.js app with an admin dashboard pattern already in place (`src/app/admin/page.tsx`, `src/app/api/admin/route.ts`)
- existing Supabase setup and generated DB types
- existing tables include general knowledge-base entities (`people`, `companies`, `communities`, `vcs`, etc.)
- existing event/application-style tables include:
  - `applications`
  - `deeptech_waitlist`
- current schema is not designed as a CRM for outreach ops

Repo strengths:
- working authenticated admin/dashboard pattern
- Next.js + Supabase is perfectly fine for this job
- API-first shape already exists, which is handy for agent access later

Repo problems:
- current schema is a London guide / event platform schema, not a relationship CRM
- `people` and `companies` are too thin for actual outreach tracking
- no interaction log
- no tasks / ownership workflow
- no opportunities / pipeline model
- no sync layer for sheet/notion ingestion

## Core design principle
Do not build Salesforce for three exhausted humans trying to run a festival.

Build a manual-first operating system with:
- one canonical record per person / organisation
- one place for status, ownership, next action, follow-up date
- append-only interaction history
- light pipelines by workstream
- a daily work queue
- source provenance back to sheet / notion / email / whatsapp / granola / supabase

## Proposed operating model

### Canonical objects
1. `people`
- one record per human
- name, title, contact details, LinkedIn URL, notes, relationship context

2. `organisations`
- sponsor targets, startups, communities, VCs, media, venues, etc.

3. `workstreams`
- sponsor
- speaker
- expo
- attendee / VIP
- community partner
- press / ecosystem

4. `opportunities`
- the actual thing in motion
- examples:
  - “NatWest sponsorship conversation”
  - “Fractile speaker invite”
  - “Dogtooth expo outreach”
  - “Critical Mass community partner confirmation”

5. `interactions`
- timeline items from email / WhatsApp / Granola / manual notes
- immutable log of what happened

6. `tasks`
- assignable work with owner, due date, urgency, status
- what the team actually works from each day

7. `source_links`
- pointers back to sheet row, Notion page/block, email thread, WhatsApp chat/message, Granola note, Supabase application row

8. `organisational_roles` / link tables
- person ↔ organisation
- person ↔ opportunity
- organisation ↔ opportunity

## Minimal schema additions to Supabase
Keep the existing tables. Add CRM-specific ones.

### New tables
1. `crm_people`
- id
- full_name
- first_name
- last_name
- primary_email
- primary_phone
- linkedin_url
- title
- location
- notes_freeform
- relationship_summary
- last_contacted_at
- next_followup_at
- owner_user_id
- created_at / updated_at

2. `crm_organisations`
- id
- name
- org_type (`sponsor`, `startup`, `vc`, `community`, `media`, `venue`, `university`, `other`)
- website
- linkedin_url
- notes_freeform
- owner_user_id
- created_at / updated_at

3. `crm_person_organisations`
- person_id
- organisation_id
- role_label
- is_primary

4. `crm_opportunities`
- id
- title
- workstream (`sponsor`, `speaker`, `expo`, `attendee`, `community_partner`, `press`)
- stage
- status (`active`, `won`, `lost`, `paused`)
- priority
- owner_user_id
- person_id nullable
- organisation_id nullable
- source_of_lead
- ask_type
- value_notes
- next_action
- next_followup_at
- last_activity_at
- notes_freeform
- created_at / updated_at

5. `crm_interactions`
- id
- opportunity_id nullable
- person_id nullable
- organisation_id nullable
- interaction_type (`email`, `whatsapp`, `granola`, `meeting`, `linkedin`, `note`, `call`, `manual`)
- direction (`inbound`, `outbound`, `internal`)
- happened_at
- summary
- raw_excerpt
- source_url
- source_external_id
- source_system
- created_by
- created_at

6. `crm_tasks`
- id
- title
- description
- linked_opportunity_id nullable
- linked_person_id nullable
- linked_organisation_id nullable
- owner_user_id
- status (`todo`, `in_progress`, `blocked`, `done`, `cancelled`)
- priority (`urgent`, `high`, `medium`, `low`)
- due_at
- reminder_at
- generated_by_rule boolean
- created_at / updated_at

7. `crm_tags`
- id
- label
- colour
- category

8. `crm_entity_tags`
- tag_id
- entity_type
- entity_id

9. `crm_source_links`
- id
- entity_type
- entity_id
- source_system (`sheet`, `notion`, `supabase`, `gmail`, `whatsapp`, `granola`, `linkedin`, `manual`)
- source_ref
- source_url
- metadata jsonb
- last_synced_at

10. `crm_users` or use auth users + membership table
- needed for assignment / ownership / dashboards

### Optional but likely useful shortly after
11. `crm_daily_work_packages`
- date
- owner_user_id
- generated_summary
- status

12. `crm_saved_views`
- kanban/list view definitions by team or workstream

## Recommended stage models
Keep them human.

### Sponsors
- target
- intro needed
- contacted
- conversation
- proposal sent
- negotiating
- confirmed
- lost

### Speakers
- target
- intro needed
- contacted
- interested
- confirming logistics
- confirmed
- declined

### Expo
- target
- contacted
- applied
- reviewing
- accepted
- confirmed
- declined
- waitlist

### Community partners
- target
- contacted
- interested
- awaiting confirmation
- confirmed
- declined

## Sync strategy (manual-first, not clever-first)

### Phase 1 sync rules
The CRM becomes the operational home.
Other systems continue to exist.

#### Google Sheet
- import all tabs into staging tables / import jobs
- map rows to canonical people/orgs/opportunities/tasks
- preserve original row link in `crm_source_links`
- for now: support re-import, not perfect live bidirectional sync
- where possible, write back a CRM URL / canonical ID into the sheet later

#### Notion
- ingest selected pages / blocks as context notes
- parse child pages like `Sponsorship Plan`, `Founders / Companies`, `Working.`, weekly notes
- convert obvious to-dos and named targets into opportunities/tasks
- keep raw note references linked, but do not try to mirror all Notion structure back

#### Supabase existing tables
- `applications` and `deeptech_waitlist` stay authoritative for those inbound form datasets
- CRM links them to people/orgs/opportunities rather than replacing them

### Why not full two-way sync immediately?
Because it becomes a beautiful machine for corrupting data in three places at once.
Start with:
- import from sheet/notion
- selective write-back later
- clear source-of-truth rules per field

## Dashboard requirements

### MVP views
1. `Today`
- overdue follow-ups
- due today tasks
- urgent opportunities without next action
- recently active threads needing reply
- new inbound items from email / WhatsApp / Granola awaiting triage

2. `People / Organisations`
- searchable CRM records
- notes + relationship map + recent interactions

3. `Opportunities`
- filterable list + kanban by workstream/stage
- owner, next action, next follow-up, latest interaction

4. `Tasks`
- team task list
- by owner / due date / priority / workstream

5. `Inbox / Triage`
- imported interaction candidates from email / WhatsApp / Granola / sheet / Notion parsing
- convert to task / interaction / opportunity update

6. `Context`
- merged view of source material and timeline for a person/org/opportunity

### Agent/API requirements
Expose API endpoints for:
- search people / orgs / opportunities
- fetch full context pack for one target
- create interaction from an external message
- create/update tasks
- create/update next action / follow-up
- list today’s work package by owner

## Daily work package logic
Each morning or on demand, generate for each owner:
- follow-ups overdue or due today
- active opportunities with no next action
- warm leads with no contact in X days
- recent inbounds awaiting response
- high-priority targets missing contact details or research

Each work package item should include:
- who
- why now
- current status
- recommended next action
- suggested channel
- relevant context snippets
- draftable message hook

## Import / migration plan

### Work package 1 — audit + mapping
- export sheet tabs and define field mappings
- crawl the key Notion pages and identify recurring structures
- inspect `applications` and `deeptech_waitlist` rows
- define canonical status vocabulary
- define owner list / team membership

Deliverables:
- source inventory
- field mapping table
- status/stage dictionary
- dedupe rules

### Work package 2 — CRM schema + seed import layer
- add CRM tables to Supabase
- add import tables or ingestion scripts for sheet + notion
- seed canonical records from current sponsor/speaker/expo/community partner tabs

Deliverables:
- migrations
- import scripts
- first pass seeded CRM data

### Work package 3 — core admin dashboard
- build authenticated CRM dashboard in `starter-london`
- list/kanban for opportunities
- task board
- person/org detail pages
- follow-up dates and ownership editing

Deliverables:
- `/crm` section
- CRUD for people/orgs/opportunities/tasks
- views for sponsors/speakers/expo/partners

### Work package 4 — source context + timeline
- attach source references to entities
- add interactions timeline UI
- display linked Notion pages, sheet row refs, and inbound record refs

Deliverables:
- context panels
- source provenance
- manual interaction logging

### Work package 5 — inbound enrichment adapters
- Gmail ingestion for selected threads / labels / searches
- Granola note ingestion to interactions
- WhatsApp read-only ingest into triage
- optional LinkedIn URL capture/manual notes only at first

Deliverables:
- inbound triage queue
- auto-created interaction candidates
- suggested follow-ups from recent messages/meetings

### Work package 6 — daily work packages + agent API
- generate daily work packages
- API endpoints for agents
- support “give me people to nudge today” / “draft replies for sponsor leads” workflows

Deliverables:
- work package generator
- agent-facing JSON endpoints
- prompt-ready context bundles

### Work package 7 — selective write-back / deprecation
- optionally write CRM status/owner back to the sheet for compatibility
- reduce use of old tabs over time
- keep Notion for narrative docs, not operational source-of-truth

Deliverables:
- compatibility write-back where worth it
- migration guide for team usage

## Practical implementation notes for this repo

### Reuse existing patterns
- auth gate pattern from `src/app/admin/page.tsx`
- API route shape from `src/app/api/admin/route.ts`
- Supabase typed client from `src/lib/supabase.ts`
- existing dashboard styling / visual language to move quickly

### Recommended new app areas
- `src/app/crm/page.tsx`
- `src/app/crm/opportunities/page.tsx`
- `src/app/crm/people/[id]/page.tsx`
- `src/app/crm/organisations/[id]/page.tsx`
- `src/app/crm/tasks/page.tsx`
- `src/app/api/crm/...`
- `src/lib/crm/...`
- `supabase/migrations/...crm...sql`

## Risks / things not to do
- do not make Notion the runtime database
- do not aim for perfect LinkedIn automation early
- do not try to parse every historical email/message immediately
- do not over-normalise before the team uses the thing
- do not let statuses remain free text forever
- do not force colleagues to stop using existing tools on day one

## Immediate recommendation
The right first move is not “build the whole intelligence layer”.
It is:
1. canonical schema
2. import current sheet + key notion pages
3. basic dashboard with owner / stage / next action / follow-up
4. only then add message/meeting ingestion

## Open questions still worth settling before implementation
- who are the initial users and owner names to support?
- do you want one shared queue plus personal queues, or only personal queues?
- what exact workstream list should appear in the UI from day one?
- should `applications` be treated as expo applicants, attendee applicants, or something broader in this project?
- what auth model do you want for colleagues: password gate first, or proper Supabase auth immediately?

## Strong recommendation
Use `starter-london` as the base and add a new CRM module there.
Do not try to keep operating from the sheet as the main cockpit.
The sheet should become an import surface and temporary compatibility layer, then slowly fade into the background like a Victorian ghost.
