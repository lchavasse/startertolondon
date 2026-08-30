# CRM Outreach Upgrade Implementation Plan

> For Hermes: use subagent-driven-development for later phases if this grows beyond one focused implementation pass.

Goal: turn the current import-heavy CRM into something actually useful for sponsor outreach, speaker/topic planning, and daily operator work.

Architecture: keep the existing crm_* foundation, but add a proper opportunity detail surface plus explicit contact-point and outreach-tracking tables. The first slice should make navigation sane, let Lachlan/Barrett record how to reach a sponsor or speaker target, and log outreach attempts with next steps.

Tech stack: Next.js app router, Supabase Postgres, server-side data fetches in src/lib/crm/server.ts, admin-key protected /api/crm writes, lightweight client forms for quick capture.

---

## What is broken now

- Opportunity "open" links point to in-page anchors on /crm/opportunities, but there is no matching detail route. Clicking them does bugger all.
- Imported rows exist, but the system does not answer the important questions:
  - who exactly should we contact at this sponsor?
  - by which channel?
  - what did we send?
  - when do we chase again?
  - which topics still need better speaker options?
- Current entity detail pages are read-only provenance dumps. Fine for archaeology, useless for operating.

## Target first slice

Ship these together:

1. Real opportunity detail pages at /crm/opportunities/[id]
2. Contact-point storage for people and organisations
3. Outreach log storage tied to opportunities
4. Quick-add UI on opportunity pages to capture contacts and outreach
5. Dashboard and board links updated to real detail pages

## Phase 1 — schema and types

### Task 1: Add CRM contact point table
Objective: store "how we contact them" as first-class data.

Create migration adding crm_contact_points with:
- id uuid pk
- entity_type text check in ('person', 'organisation')
- entity_id uuid not null
- label text
- channel text check in ('email', 'linkedin', 'whatsapp', 'phone', 'x', 'webform', 'other')
- value text not null
- notes text
- is_primary boolean default false
- created_at timestamptz default now()
- updated_at timestamptz default now()

Indexes:
- (entity_type, entity_id)
- partial unique on (entity_type, entity_id, channel, value)

Enable RLS and updated_at trigger.

### Task 2: Add CRM outreach log table
Objective: track what happened, to whom, and what happens next.

Create migration adding crm_outreach_entries with:
- id uuid pk
- opportunity_id uuid not null references crm_opportunities(id) on delete cascade
- contact_point_id uuid references crm_contact_points(id) on delete set null
- person_id uuid references crm_people(id) on delete set null
- organisation_id uuid references crm_organisations(id) on delete set null
- owner_user_id uuid references crm_users(id) on delete set null
- channel text check in same list as above
- direction text check in ('outbound', 'inbound', 'internal') default 'outbound'
- status text check in ('draft', 'queued', 'sent', 'replied', 'no_response', 'bounced', 'declined') default 'sent'
- subject text
- body_excerpt text
- happened_at timestamptz default now()
- next_step text
- next_due_at timestamptz
- source_url text
- notes text
- created_at timestamptz default now()

Indexes:
- opportunity_id
- happened_at desc
- next_due_at

Enable RLS.

### Task 3: Extend TS constants/types
Files:
- Modify src/lib/crm/constants.ts
- Modify src/lib/crm/types.ts

Add:
- CRM_CONTACT_CHANNELS
- CRM_OUTREACH_STATUSES
- CrmContactPoint
- CrmOutreachEntry
- CrmOpportunityDetail

## Phase 2 — server/API support

### Task 4: Add server fetchers for contact points and opportunity detail
Files:
- Modify src/lib/crm/server.ts

Add:
- fetchCrmContactPointsForEntities(entityRefs)
- fetchCrmOpportunityDetail(id)

Opportunity detail should include:
- opportunity
- owner_name
- linked people
- linked organisations
- linked tasks
- linked interactions
- sourceLinks
- contactPoints for linked people/orgs
- outreachEntries ordered newest first

### Task 5: Add API actions
Files:
- Modify src/app/api/crm/route.ts

GET:
- entity=opportunities&id=... should return fetchCrmOpportunityDetail(id)

POST:
- action=add-contact-point
- action=add-outreach-entry

Important behavior:
- validate enums
- require target entity for contact point
- require opportunity_id for outreach entry
- when adding outreach entry, also create a crm_interactions row summarising it so the dashboard reflects real activity

## Phase 3 — UI that actually helps

### Task 6: Add opportunity detail route
Files:
- Create src/app/crm/opportunities/[id]/page.tsx

Display:
- title / status / priority / owner
- summary, ask_type, next_action, next_followup_at, notes
- linked people/orgs with links
- source links
- recent interactions
- outreach log
- contact points

### Task 7: Add opportunity workbench client component
Files:
- Create src/components/crm/OpportunityWorkbench.tsx

Provide two quick-capture forms:
- Add contact point
- Log outreach

Form fields should be minimal and operator-friendly, not ERP cosplay.

Contact point form:
- target entity dropdown (linked org/person)
- channel
- value
- label
- notes
- primary toggle

Outreach form:
- target entity dropdown
- optional linked contact point dropdown
- channel
- status
- subject
- body excerpt
- next step
- next due date
- source URL

After submit:
- POST to /api/crm
- refresh route
- show terse success/error state

### Task 8: Fix all broken links
Files:
- Modify src/components/crm/OpportunityBoard.tsx
- Modify src/app/crm/page.tsx

Replace /crm/opportunities#id links with /crm/opportunities/[id].

## Phase 4 — next useful layer after this slice

Not in this first implementation pass, but immediately next:

1. Sponsor target queue page
- rank sponsor orgs by status, missing contacts, stale outreach, and owner

2. Topic/speaker intelligence
- topic opportunity template
- suggested speaker list per topic
- confidence/source notes
- "need more candidates" flag

3. Contact enrichment scripts
- for sponsor organisations, generate a research queue for likely people/roles and contact channels
- later enrich from browser research, LinkedIn URLs, websites, email patterns

4. Outreach drafting support
- generate first-pass email/LinkedIn drafts from opportunity context

## Verification

Run after implementation:
- npm run build
- npx eslint src/app/api/crm/route.ts src/lib/crm/server.ts src/app/crm/opportunities/[id]/page.tsx src/components/crm/OpportunityBoard.tsx src/components/crm/OpportunityWorkbench.tsx src/lib/crm/types.ts src/lib/crm/constants.ts
- supabase db push
- load /crm and /crm/opportunities in browser
- open an opportunity detail page
- add a contact point
- log an outreach entry
- verify interaction appears in the opportunity page and dashboard recent interactions

## Success criteria

This slice is successful when:
- clicking an opportunity opens a real page
- each sponsor opportunity can hold concrete contact routes
- outreach attempts are visible and time-ordered
- next-step tracking exists in one place
- the CRM starts behaving like an operating system instead of a landfill with headers
