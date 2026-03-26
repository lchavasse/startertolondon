---
title: "feat: Build /explore KB browser and wire /guide to live Supabase data"
type: feat
status: active
date: 2026-03-25
origin: docs/brainstorms/2026-03-25-kb-explore-ui-requirements.md
---

# feat: Build /explore KB browser and wire /guide to live Supabase data

## Overview

Add a `/explore` page that lets users browse all 75+ knowledge-base entries (spaces, communities, VCs, programmes) with entity-type and sector filters. Replace the hardcoded mock data in `/guide` with a live Supabase query ranked by profile interest overlap. Add an `Events | Explore` nav to both pages. Admin mode surfaces per-card edit buttons that save directly to Supabase via an API route.

## Problem Frame

The Supabase KB has 27 spaces, 28 communities, 22 VCs, and 3 programmes — fully seeded and typed — but no UI exists to browse or maintain it. The `/guide` page ranks 6 made-up mock entries instead of real London entities. Users have no way to discover KB content without opening the Supabase dashboard. (see origin: `docs/brainstorms/2026-03-25-kb-explore-ui-requirements.md`)

## Requirements Trace

- R1. `/explore` page — terminal/neon-green aesthetic (dark `#040506` bg, `#9fd5ac`/`#c4f3ce` green accents, IBM Plex Mono). *(Note: origin doc references events yellow — corrected to terminal aesthetic per explicit user decision during brainstorm)*
- R2. Entity-type filter row: `ALL | SPACES | COMMUNITIES | VCS | PROGRAMMES`. Single-select, defaults to ALL.
- R3. Sector/tag filter row: `ALL | FOUNDERS | AI | DEEPTECH | SCIENCE | CLIMATE | ...` — derived from actual data at page load.
- R4. Cards show: name, strapline, area/primary_area, access-type or exclusivity badge, sector tags. Cover image if present; dark placeholder tile (entity initial + type label in green) if not.
- R5. Entry count in monospace (`"47 entries"`) updates with active filters.
- R6. Admin edit mode: when admin key is in sessionStorage, each card shows an edit button. Modal edits: name, strapline, description, website, area, cover_image URL, tags/sectors. Saves via API route.
- R7. `/guide` replaces hardcoded `GUIDE_ITEMS` with live Supabase query across spaces, communities, and programmes — ranked by overlap between entity sectors/tags and `profile.interests`.
- R8. Nav shows `Events | Explore` on both `/events` and `/explore`.

## Scope Boundaries

- No graph/relationship view.
- No full-text search.
- No vector/LLM ranking in guide — simple tag overlap only.
- No separate `/spaces`, `/communities`, `/vcs` routes.
- No user accounts, saved/starred items, or public profiles.
- Cover image upload is out of scope — URL input in admin modal only.
- VCs not included in guide ranking (guide covers spaces, communities, programmes only).

## Context & Research

### Relevant Code and Patterns

- **Design system:** `src/app/globals.css` — all CSS custom properties, `.terminal-panel`, `.filter-chip`/`.filter-chip--active`, `.app-shell`, `.app-shell__inner`, `.terminal-eyebrow`, `.terminal-tag`, `.terminal-tags`. The `filter-chip` chip class recipe: `className={active ? 'filter-chip--active' : 'filter-chip'} + px-3 py-1 text-[10px] uppercase tracking-widest`
- **Filter pattern:** `src/components/TagFilter.tsx` and `src/components/SourceFilter.tsx` — stateless, receive props, emit onChange. State lives in parent. Directly reusable shape.
- **Card pattern:** `src/components/EventCard.tsx` — `terminal-panel` anchor, `aspect-[4/3]` cover area, info body with name, tags. Mirror this structure for `ExploreCard`.
- **Grid layout:** `src/components/EventGrid.tsx` — `grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4`, client-side filter state, admin mode via `sessionStorage.getItem('admin-key')` in `useState` initialiser.
- **Supabase client:** `src/lib/supabase.ts` — anon-key singleton, typed `Database`. Pre-exported: `Space`, `Community`, `VC`, `Programme` types.
- **Server Component data fetch pattern:** `src/app/events/page.tsx` — `async function Page()`, fetches data, passes to Client Component.
- **Guide current implementation:** `src/app/guide/page.tsx` (thin wrapper) → `src/components/GuidePageClient.tsx` (reads localStorage profile, calls `rankGuideItems`). `src/lib/guide-data.ts` has `GUIDE_ITEMS` array and `rankGuideItems()` scoring function.
- **Admin auth:** `sessionStorage` key `'admin-key'`, passed as `x-admin-key` header to API routes. Route validates against env var (likely `ADMIN_KEY`). See `src/app/admin/page.tsx`.
- **Profile model:** `src/lib/profile.ts` — `loadStoredOnboarding()` reads localStorage. `profile.interests: string[]` maps to values like `deeptech`, `ai`, `founders`, `science`, `design`.

### Tag/Sector Mapping per Entity Type

| Entity | Scoring field | Filter field |
|---|---|---|
| communities | `sectors` | `sectors` |
| vcs | `sectors` | `sectors` |
| programmes | `sectors` | `sectors` |
| spaces | `crowd_tags` (profile match) + `tags` (filter) | `tags` |

Spaces lack a `sectors` field — use `crowd_tags` (`founders`, `researchers`, `techies`) for profile scoring and `tags` (`coworking`, `lab`, `events`) for display/filtering.

### Institutional Learnings

- No `docs/solutions/` exists in this project.

## Key Technical Decisions

- **Terminal aesthetic for /explore, not events yellow:** The brainstorm requirements doc references the events design, but the user explicitly decided during the brainstorm session that `/explore` stays in the terminal/neon-green system. Use `app-shell` + `terminal-panel` cards, green accents.
- **Server Component fetches all entities, client component filters:** ~100 total KB entries is small enough to fetch once and filter in state. Avoids extra round-trips on every filter change. `page.tsx` is `async`, passes data to `<ExploreGrid />`.
- **Admin saves via `/api/admin/kb` POST, not direct client Supabase write:** The service role key must not be exposed to the browser. The API route validates `x-admin-key` then uses a service-role Supabase client for the update. Consistent with existing admin auth pattern.
- **Shared `AppNav` component:** The nav is identical on both pages and possibly the guide page header too. A tiny shared component (`src/components/AppNav.tsx`) is cleaner than duplicating 3 lines in three places. Uses `usePathname` to mark the active link.
- **KB query module at `src/lib/kb.ts`:** Central place for all KB Supabase queries. Both `/explore` (fetch all four types) and `/guide` (fetch guide-eligible types) import from here, keeping data access decoupled from rendering.
- **Guide ranking stays client-side:** Profile interests live in localStorage, which is browser-only. The Server Component fetches the full KB item list and passes it as a prop; `GuidePageClient` handles scoring against the profile after mount. This preserves the existing pattern cleanly.
- **Sector filter on /explore derived from live data:** Collect unique sectors/tags across all entities at page load in the Server Component, pass as a prop alongside the entities. No hardcoded sector list.

## Open Questions

### Resolved During Planning

- **Modal vs inline edit:** Modal is simpler given the component structure — avoids collapsing the card grid layout and reuses `.terminal-window` class (floating centered panel, already defined in globals.css).
- **Placeholder tile design:** Dark tile with entity-type initial in `--accent-bright` (neon green), small entity-type label below (e.g., "SPACE"). Consistent with terminal aesthetic.
- **Single vs multi-select entity-type filter:** Single-select (only one type active at a time, or ALL). Per R2: "Selecting one filters the grid to that type."
- **Sector filter on spaces:** Use `tags` field for sector filtering/display (`coworking`, `lab`, `events`), `crowd_tags` for profile scoring. Both shown on the card.
- **Guide top-N:** Top 8 shown, per R7.

### Deferred to Implementation

- **Exact Supabase select field list:** Check generated `database.types.ts` column names during implementation to confirm field names like `cover_image`, `primary_area`, `access_type`, `exclusivity`.
- **ADMIN_KEY env var name:** Confirm the exact env var name from `src/app/api/admin/route.ts` before building the kb admin route.
- **Sector overlap between profile.interests and entity sectors:** Confirm at runtime that the vocab aligns (e.g., profile may emit `deeptech` which matches `sectors: ['deeptech']`). If there's a mismatch, normalize to lowercase during scoring.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
/explore (Server Component)
  → src/lib/kb.ts: fetchAllKBEntities()
      → supabase.from('spaces').select(...)
      → supabase.from('communities').select(...)
      → supabase.from('vcs').select(...)
      → supabase.from('programmes').select(...)
      → deriveSectors(all entities) → string[]
  → <ExploreGrid entities={...} availableSectors={[...]} />

ExploreGrid (Client Component)
  state: activeType ('all'|'spaces'|'communities'|'vcs'|'programmes')
  state: activeSectors string[]
  state: adminMode boolean (from sessionStorage 'admin-key' on mount)
  state: editingEntity KBEntity | null
  → filter entities client-side
  → render count + filter chips + card grid
  → <ExploreCard entity={...} adminMode={adminMode} onEdit={...} />
  → adminMode && editingEntity → <KBEditModal entity={...} onSave={...} onClose={...} />

KBEditModal (within ExploreGrid file or separate)
  → form fields: name, strapline, description, website, area, cover_image, tags/sectors
  → onSave → POST /api/admin/kb { entityType, id, fields }
  → optimistic update or refetch after save

/api/admin/kb (Route Handler)
  → validate x-admin-key header against ADMIN_KEY env var
  → service-role Supabase client
  → update correct table based on entityType param

/guide (Server Component — updated)
  → src/lib/kb.ts: fetchGuideItems()
      → spaces, communities, programmes (not VCs)
      → normalize to GuideItem shape
  → <GuidePageClient items={guideItems} />

GuidePageClient (unchanged logic)
  → loadStoredOnboarding() from localStorage
  → rankGuideItems(items, profile) → top 8
  → render dossier
```

## Implementation Units

- [ ] **Unit 1: KB query module**

  **Goal:** Central Supabase fetch functions used by both `/explore` and `/guide`. Defines the normalised `KBEntity` type used throughout.

  **Requirements:** R2, R3, R4, R7

  **Dependencies:** Existing `src/lib/supabase.ts` (anon client, typed Database)

  **Files:**
  - Create: `src/lib/kb.ts`
  - Test: no dedicated test file — integration verified at page level

  **Approach:**
  - `fetchAllKBEntities()` — parallel `Promise.all` across all four tables, each `.select()` picking only the fields needed for the explore card (name, slug, strapline, description, area, primary_area, access_type, exclusivity, tags, crowd_tags, sectors, cover_image, featured, website). Returns `{ spaces, communities, vcs, programmes }`.
  - `deriveSectors(entities)` — collect unique sector/tag values from all returned entities, return sorted `string[]` for the filter row.
  - `fetchGuideItems()` — parallel fetch of spaces, communities, programmes (exclude VCs). Normalises each to a `GuideItem`-compatible shape: `{ id, name, strapline, description, area, tags: string[], type }`. Tags = `sectors` for community/programme, `crowd_tags` for spaces.
  - Export a `KBEntity` union type (tagged union with `_type: 'space'|'community'|'vc'|'programme'`) for use in ExploreCard and the admin modal.

  **Patterns to follow:**
  - `src/lib/kv.ts` for the module structure (pure functions, typed returns)
  - `src/lib/supabase.ts` for how to call the existing client

  **Test scenarios:**
  - `fetchAllKBEntities()` returns all four entity arrays
  - `deriveSectors()` returns deduplicated, sorted sector strings
  - `fetchGuideItems()` returns only spaces, communities, programmes (not VCs)

  **Verification:**
  - Importing and calling `fetchAllKBEntities()` in a server component returns data without TypeScript errors
  - `KBEntity` union narrows correctly via `._type` discriminant

---

- [ ] **Unit 2: /explore page — Server Component and ExploreGrid client**

  **Goal:** The browsable KB page with entity-type filter, sector filter, entry count, and card grid.

  **Requirements:** R1, R2, R3, R4, R5, R8

  **Dependencies:** Unit 1 (kb.ts), Unit 5 (AppNav)

  **Files:**
  - Create: `src/app/explore/page.tsx`
  - Create: `src/components/ExploreGrid.tsx`
  - Create: `src/components/ExploreCard.tsx`

  **Approach:**
  - `explore/page.tsx` — `async` Server Component. Calls `fetchAllKBEntities()` and `deriveSectors()`. Passes `entities` and `availableSectors` to `<ExploreGrid />`. Includes `<AppNav />` in the page header.
  - `ExploreGrid.tsx` — Client Component. State: `activeType` (single-select entity type), `activeSectors` (multi-select, empty = all), `adminMode` (from sessionStorage on mount), `editingEntity`. Filters the entity array client-side. Renders: header with count + nav, entity-type filter row, sector filter row, card grid.
  - Entity-type filter: one-at-a-time single-select. Pills: `ALL | SPACES | COMMUNITIES | VCS | PROGRAMMES`. Reuse `.filter-chip` / `.filter-chip--active` + `px-3 py-1 text-[10px] uppercase tracking-widest` recipe exactly.
  - Sector filter: multi-select toggle pills. Each click adds/removes from `activeSectors`. "ALL" clears selection. Same chip classes. Hide sector filter (or show all) when no sectors apply to current entity type — only show sectors that exist in currently visible entities.
  - Grid: `grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4`, same as EventGrid.
  - Entry count: `<span className="terminal-eyebrow">47 entries</span>` (or similar monospace, updates reactively).
  - `ExploreCard.tsx` — `terminal-panel` card. Cover image if present (`object-cover w-full aspect-[4/3]`); placeholder tile otherwise (dark tile with entity initial letter in `--accent-bright`, entity type label below in `--muted`). Info section: name (`font-bold`), strapline (muted copy), area badge, access_type/exclusivity badge (using `terminal-tag` class), sector/tag chips.
  - Admin edit button: shown when `adminMode && card hovered` — small `terminal-ghost` button in the card corner. Calls `onEdit(entity)` which sets `editingEntity` in ExploreGrid.

  **Patterns to follow:**
  - `src/components/EventGrid.tsx` for grid layout, admin mode pattern, overall structure
  - `src/components/EventCard.tsx` for card construction
  - `src/components/TagFilter.tsx` and `SourceFilter.tsx` for filter pill pattern
  - `src/app/globals.css` `.app-shell`, `.app-shell__inner`, `.terminal-panel`, `.filter-chip` classes

  **Test scenarios:**
  - All entities shown by default (ALL type, no sector filter)
  - Selecting COMMUNITIES hides spaces, VCs, programmes
  - Selecting a sector hides entities not matching it
  - Entry count reflects active filter combination
  - Entity without cover_image shows placeholder tile (initial + type label)
  - Entity with cover_image shows the image
  - Admin button appears on card when adminMode is true

  **Verification:**
  - `/explore` loads without error, shows all 75+ entries
  - Filter pills work and count updates
  - No TypeScript errors

---

- [ ] **Unit 3: Admin KB edit modal and API route**

  **Goal:** Admin users can click "edit" on any card to open a modal and save changes to Supabase.

  **Requirements:** R6

  **Dependencies:** Unit 2 (ExploreGrid), Unit 1 (KBEntity type)

  **Files:**
  - Create: `src/app/api/admin/kb/route.ts`
  - Modify: `src/components/ExploreGrid.tsx` (add modal rendering)
  - Create: `src/components/KBEditModal.tsx` (or inline within ExploreGrid if small enough)

  **Approach:**
  - `KBEditModal` — uses `.terminal-window` class (already defined in globals.css — floating, centered, animated with `is-visible` toggle). Fields: name, strapline, description, website, area, cover_image (URL text input), tags/sectors (comma-separated text or individual pills). Renders field set appropriate to entity type (e.g., spaces has `area`, communities has `primary_area`; spaces edits `tags`/`crowd_tags`, others edit `sectors`).
  - On save: POST to `/api/admin/kb` with body `{ entityType, id, fields: { ...changed } }`. Pass `x-admin-key` header from sessionStorage. On success, update the entity optimistically in ExploreGrid's local state (no full refetch needed).
  - On close/cancel: reset `editingEntity` to null.
  - `/api/admin/kb/route.ts` — POST handler. Reads `x-admin-key` header, validates against `process.env.ADMIN_KEY`. Creates a Supabase client with `SUPABASE_SERVICE_ROLE_KEY`. Dispatches `.update(fields).eq('id', id)` on the correct table based on `entityType`. Returns 200 on success, 401 on invalid key, 400 on bad input.

  **Patterns to follow:**
  - `src/app/api/admin/route.ts` for the auth validation pattern and response shape
  - `src/app/globals.css` `.terminal-window` for the modal shell
  - `src/app/admin/page.tsx` for sessionStorage admin key usage

  **Test scenarios:**
  - Edit button only visible when adminMode is active
  - Modal opens with pre-filled fields from the entity
  - Save POSTs to `/api/admin/kb` with correct entityType, id, and changed fields
  - API returns 401 when x-admin-key is missing or wrong
  - On 401, admin mode is cleared (consistent with existing admin pattern)
  - Successful save reflects updated values in the card without page reload
  - Modal can be closed without saving

  **Verification:**
  - Admin can update a community's strapline from the explore page and see the change immediately
  - Supabase row is updated (verifiable in Supabase dashboard)
  - Non-admin users see no edit buttons

---

- [ ] **Unit 4: /guide live data wiring**

  **Goal:** Replace hardcoded mock `GUIDE_ITEMS` with ranked results from a live Supabase query.

  **Requirements:** R7

  **Dependencies:** Unit 1 (kb.ts, `fetchGuideItems()`)

  **Files:**
  - Modify: `src/app/guide/page.tsx`
  - Modify: `src/components/GuidePageClient.tsx`
  - Modify: `src/lib/guide-data.ts`

  **Approach:**
  - `guide/page.tsx` — make it `async`. Call `fetchGuideItems()` from `src/lib/kb.ts`. Pass the returned items array as a prop to `<GuidePageClient items={items} />`.
  - `GuidePageClient.tsx` — accept an `items` prop (`GuideItem[]`). On mount, read profile from `loadStoredOnboarding()` (localStorage). Call the existing `rankGuideItems(items, profile)` with the live items. Take top 8. The rest of the render stays unchanged.
  - `guide-data.ts` — remove the `GUIDE_ITEMS` array. Keep `rankGuideItems()` scoring function (it accepts an items array — no changes to signature needed). Update scoring to use `item.tags` where tags now includes the normalized `sectors`/`crowd_tags` values from `fetchGuideItems()`.
  - If `items` prop is empty (Supabase error or no results), show a graceful fallback message in GuidePageClient instead of crashing.

  **Patterns to follow:**
  - Existing `src/app/guide/page.tsx` → `GuidePageClient.tsx` prop-passing pattern
  - `src/components/GuidePageClient.tsx` for current scoring + render shape

  **Test scenarios:**
  - Guide page shows real London entity names (not "London Operators Circle")
  - Entities with sectors/crowd_tags overlapping `profile.interests` rank higher
  - An entity with zero interest overlap still shows (but lower ranked)
  - Top 8 are shown, matching user profile
  - If profile has no interests set, items are shown in a default order
  - Fallback renders gracefully if items array is empty

  **Verification:**
  - `/guide` shows 8 real entries from the Supabase KB
  - User with `interests: ['ai', 'deeptech']` sees AI- and deeptech-tagged communities/spaces ranked near the top

---

- [ ] **Unit 5: AppNav component and nav update**

  **Goal:** Shared `Events | Explore` navigation added to `/events` and `/explore`.

  **Requirements:** R8

  **Dependencies:** None (can be built first or last)

  **Files:**
  - Create: `src/components/AppNav.tsx`
  - Modify: `src/app/events/page.tsx`
  - Modify: `src/app/explore/page.tsx` (will include on creation in Unit 2)

  **Approach:**
  - `AppNav.tsx` — `'use client'` (needs `usePathname`). Renders two links: `Events` → `/events`, `Explore` → `/explore`. Active link uses `--accent-bright` color; inactive uses `--muted` with hover to `--foreground`. Monospace, small (`text-[11px] uppercase tracking-widest`), consistent with the existing inline nav links in `GuidePageClient` (which uses `terminal-ghost`-style spans).
  - Add `<AppNav />` into the `app-header` flex row in `events/page.tsx` — insert alongside the existing `LONDON CALLING` heading and source filter.
  - `/explore/page.tsx` includes `<AppNav />` in its header section (handled in Unit 2).
  - Guide page nav is out of scope for R8, but the guide already has inline nav links — leave them as-is.

  **Patterns to follow:**
  - `src/components/GuidePageClient.tsx` inline nav link style (the `live events` / `restart intro` links at top)
  - `src/app/events/page.tsx` `app-header` section structure

  **Test scenarios:**
  - Both links render on `/events` and `/explore`
  - Active page link is visually distinct from inactive
  - Links navigate correctly between pages

  **Verification:**
  - `/events` shows `Events | Explore` nav; clicking Explore reaches `/explore`
  - `/explore` shows `Events | Explore` nav; clicking Events reaches `/events`

---

## System-Wide Impact

- **Interaction graph:** `/guide` becomes an `async` Server Component — this changes it from a static page to a dynamic (server-rendered on demand) page. Verify Vercel build output changes from `○` to `ƒ` are acceptable.
- **Error propagation:** Supabase fetch errors in `/explore` and `/guide` page.tsx should be caught and surfaced as graceful empty states, not crashes. Next.js error boundaries will catch unhandled throws.
- **State lifecycle risks:** `ExploreGrid` derives `adminMode` from sessionStorage on mount — initial render is always non-admin (SSR/hydration), edit buttons appear after hydration. No flash issue (edit buttons are additive, not subtractive).
- **API surface parity:** The `/api/admin/kb` route is new and separate from `/api/admin`. Ensure the ADMIN_KEY env var name matches what the existing admin route uses. Confirm in `src/app/api/admin/route.ts` before building.
- **Integration coverage:** `/explore` data freshness — entities are fetched at request time (dynamic page). No stale cache risk. Consider adding `export const revalidate = 3600` if future caching is desired.

## Risks & Dependencies

- **Supabase anon key RLS:** The explore and guide fetches use the anon Supabase client. If RLS policies restrict anon reads on any table, the fetch will return empty arrays silently. Verify RLS allows anon read on `spaces`, `communities`, `vcs`, `programmes` tables.
- **Sectors vocab mismatch with profile interests:** `profile.interests` uses keywords from onboarding extraction (`deeptech`, `ai`, `founders`, `science`). Entity sectors use the same vocab. If a mismatch exists (e.g., profile emits `blockchain` but entities use `web3`), the ranking will silently underperform. Check during implementation and add a normalization step if needed.
- **ADMIN_KEY env var:** Must be set in Vercel and `.env.local` for the `/api/admin/kb` route to function. If unset, all admin saves will return 401.
- **ExploreGrid data volume:** 75-100 entities is comfortably client-filterable. If the KB grows significantly, filtering may need to move server-side. Not a concern now.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-03-25-kb-explore-ui-requirements.md](../brainstorms/2026-03-25-kb-explore-ui-requirements.md)
- Related code: `src/components/EventGrid.tsx`, `src/components/EventCard.tsx`, `src/components/TagFilter.tsx`, `src/lib/guide-data.ts`, `src/lib/supabase.ts`, `src/app/globals.css`
- Supabase schema: `src/lib/database.types.ts`
