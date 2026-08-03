# DeepTech London CRM Implementation Plan

> For Hermes: use subagent-driven-development if delegating. New CRM tables only. Do not reuse unrelated existing Supabase tables except reading `applications` and `deeptech_waitlist` as external sources.

**Goal:** Build a manual-first CRM/admin module inside `starter-london` for Lachlan and Barrett to manage sponsors, speakers, expo, partners, talk topics, week tasks, follow-ups, and source context.

**Architecture:** Add a new `crm_*` schema layer in Supabase, a small server-side CRM data library, authenticated admin/API routes using the existing `ADMIN_SECRET` + Supabase service-role pattern, and a `/crm` dashboard with Today / Opportunities / Tasks / People / Organisations views. Keep imports light and provenance-heavy: ingest from the current sheet and Notion into CRM entities and `crm_source_links` rather than trying to mirror external systems as the runtime database.

**Tech Stack:** Next.js App Router, TypeScript, Supabase, existing starter-london styling/system, Google Sheets API, Notion API.

---

## Task 1: Add CRM schema migration

**Objective:** Create new CRM tables for users, organisations, people, opportunities, tasks, interactions, source links, and join tables.

**Files:**
- Create: `supabase/migrations/20260709131500_crm_foundation.sql`

**Implementation notes:**
- Create only new `crm_*` tables.
- Do not modify `applications`, `deeptech_waitlist`, or unrelated KB tables.
- Add `check` constraints only where low-risk and obvious.
- Add `updated_at` triggers for mutable tables.
- Seed two CRM users: `Lachlan`, `Barrett`.
- Include room for workstreams beyond expo: sponsor, speaker, expo, attendee, community_partner, press, topic, week_ops.

**Verification:**
- Read the SQL file back and confirm all required tables exist.
- Tables required:
  - `crm_users`
  - `crm_organisations`
  - `crm_people`
  - `crm_person_organisations`
  - `crm_opportunities`
  - `crm_tasks`
  - `crm_interactions`
  - `crm_source_links`
  - `crm_opportunity_people`
  - `crm_opportunity_organisations`

---

## Task 2: Extend generated DB typing safely for CRM tables

**Objective:** Make the new CRM tables available to the app without disturbing existing project data structures.

**Files:**
- Modify: `src/lib/database.types.ts`
- Modify: `src/lib/supabase.ts`

**Implementation notes:**
- Add typed entries for the new `crm_*` tables.
- Add convenience aliases for CRM rows.
- Keep existing aliases intact.
- Do not rename or repurpose existing `people`, `companies`, `applications`, etc.

**Verification:**
- `crm_*` tables are visible in `Database['public']['Tables']`.
- `src/lib/supabase.ts` exports aliases for core CRM rows.

---

## Task 3: Add CRM constants, domain types, and service-role client helper

**Objective:** Create one coherent home for CRM enums, labels, and server-side fetching.

**Files:**
- Create: `src/lib/crm/constants.ts`
- Create: `src/lib/crm/types.ts`
- Create: `src/lib/crm/server.ts`

**Implementation notes:**
- Hardcode owner options to `Lachlan` and `Barrett` for now.
- Define workstream constants:
  - sponsor
  - speaker
  - expo
  - attendee
  - community_partner
  - press
  - topic
  - week_ops
- Define shared status/priority unions.
- Add `getCrmServiceClient()` using `SUPABASE_SERVICE_ROLE_KEY`.
- Add fetchers for:
  - dashboard summary
  - opportunities list
  - tasks list
  - people list
  - organisations list
  - person detail
  - organisation detail

**Verification:**
- Functions compile against the typed Supabase client.
- No dependency on unrelated old tables beyond optional source summaries.

---

## Task 4: Add CRM page chrome and navigation

**Objective:** Make CRM reachable in the app without disrupting existing pages.

**Files:**
- Modify: `src/components/AppNav.tsx`
- Create: `src/components/crm/CrmShell.tsx`
- Create: `src/components/crm/CrmTabs.tsx`

**Implementation notes:**
- Add a `CRM` link to nav.
- Use existing visual language; do not build a design cathedral.
- `CrmShell` should provide heading, owner scope copy, and consistent layout.

**Verification:**
- `/crm` can be linked from the shared nav.
- Existing `/events` and `/explore` pages remain untouched apart from the extra nav item.

---

## Task 5: Build Today dashboard view

**Objective:** Give Lachlan and Barrett a genuinely useful operational home page.

**Files:**
- Create: `src/app/crm/page.tsx`
- Create: `src/components/crm/TodayCards.tsx`
- Create: `src/components/crm/UrgentList.tsx`

**Implementation notes:**
- Show:
  - overdue follow-ups
  - tasks due today / overdue
  - active opportunities with no next action
  - recent interactions
- Keep it server-rendered and simple.
- Use placeholder empty states that don’t look like a hostage note.

**Verification:**
- `/crm` renders with real DB-backed sections.
- Empty DB state still renders clearly.

---

## Task 6: Build Opportunities and Tasks views

**Objective:** Provide the two main operating screens: pipeline and work queue.

**Files:**
- Create: `src/app/crm/opportunities/page.tsx`
- Create: `src/app/crm/tasks/page.tsx`
- Create: `src/components/crm/OpportunityBoard.tsx`
- Create: `src/components/crm/TaskTable.tsx`

**Implementation notes:**
- Opportunities view:
  - filter by workstream
  - grouped by status/stage in a lightweight kanban/list layout
  - show owner, next action, next follow-up
- Tasks view:
  - list by due date/priority
  - show linked person/org/opportunity references

**Verification:**
- Both pages load from the server fetchers.
- Grouping/filtering works from static query params or local UI state.

---

## Task 7: Build People and Organisations index/detail pages

**Objective:** Make CRM entities browsable with notes, provenance, and linked work.

**Files:**
- Create: `src/app/crm/people/page.tsx`
- Create: `src/app/crm/people/[id]/page.tsx`
- Create: `src/app/crm/organisations/page.tsx`
- Create: `src/app/crm/organisations/[id]/page.tsx`
- Create: `src/components/crm/EntityList.tsx`
- Create: `src/components/crm/EntityDetail.tsx`

**Implementation notes:**
- Detail pages should show:
  - notes
  - linked opportunities
  - linked tasks
  - recent interactions
  - source links
- Keep freeform notes prominent.

**Verification:**
- List and detail pages render correctly.
- Missing relation data does not break the page.

---

## Task 8: Add CRM admin API for basic create/update actions

**Objective:** Support lightweight editing without waiting for a full form-builder saga.

**Files:**
- Create: `src/app/api/crm/route.ts`

**Implementation notes:**
- Protect with existing `ADMIN_SECRET` pattern.
- Support minimal actions:
  - create/update task
  - create/update opportunity
  - create interaction
  - update person/org notes and owner
- Validate action names and allowlisted fields.
- Use service-role client.

**Verification:**
- Route rejects unauthorised requests.
- Route handles invalid payloads cleanly.

---

## Task 9: Add initial import surfaces for sheet and Notion provenance

**Objective:** Get current external mess into the CRM in a controlled, source-linked way.

**Files:**
- Create: `scripts/import-deeptech-sheet.ts`
- Create: `scripts/import-deeptech-notion.ts`
- Create: `src/lib/crm/importers.ts`

**Implementation notes:**
- Sheet importer:
  - read current tabs
  - map rows into people/org/opportunity/task candidates
  - attach source refs via `crm_source_links`
- Notion importer:
  - ingest selected DeepTech Week child pages
  - convert obvious targets/to-dos into CRM notes/tasks/opportunities
  - store raw source references, not whole-page clones as your new religion
- It is fine if v1 is idempotent-ish rather than perfect.

**Verification:**
- Scripts compile.
- Dry-run mode or log output shows mapped entities.

---

## Task 10: Add source summaries for existing expo/waitlist tables

**Objective:** Make existing inbound data visible to the CRM without hijacking unrelated tables.

**Files:**
- Modify: `src/lib/crm/server.ts`
- Optionally create: `src/components/crm/InboundSummary.tsx`

**Implementation notes:**
- Read only from:
  - `applications`
  - `deeptech_waitlist`
- Present counts or latest rows as context on `/crm`.
- Do not use those tables as CRM records.

**Verification:**
- Dashboard can show inbound summary when data exists.
- No writes to old tables.

---

## Task 11: Add lightweight seed script for initial records

**Objective:** Make the CRM immediately usable without hand-entering every bloody thing.

**Files:**
- Create: `scripts/seed-crm-users.ts`
- Optionally create: `scripts/seed-crm-sample.ts`

**Implementation notes:**
- Seed users `Lachlan` and `Barrett`.
- Optionally seed a few safe sample workstreams/statuses if helpful.

**Verification:**
- Script compiles.
- Seed data is obviously CRM-specific and isolated.

---

## Task 12: Verify with build/lint and document next execution step

**Objective:** Make sure the implementation stands up and document any unapplied external steps.

**Files:**
- Modify if needed: relevant touched files

**Verification commands:**
- Run: `pnpm lint`
- Run: `pnpm build`

**Expected outcome:**
- Build passes.
- If live Supabase migration application is not performed in this session, document that clearly.

---

## Risks / constraints
- Repo already has unrelated local modifications. Do not overwrite them.
- The existing `database.types.ts` is generated; if we patch it manually now, we must note that it should be regenerated after applying the migration for real.
- No full auth/user-management rabbit hole in v1. Owners are Lachlan/Barrett only.
- No attempt at perfect two-way sync yet.

## Immediate execution order
1. Task 1–3
2. Task 4–8
3. Task 10
4. Task 9
5. Task 11–12
