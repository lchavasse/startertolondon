---
date: 2026-03-25
topic: kb-explore-ui
---

# KB Explore UI & Guide Data Wire-up

## Problem Frame
The app has a fully seeded Supabase knowledge base (27 spaces, 28 communities, 22 VCs, 3 programmes, 15 people) with no UI. The `/guide` page shows 6 made-up mock entries. The events page has a polished dark card-grid design that should be the visual template for all KB pages. Users currently have no way to browse or edit the KB outside the Supabase dashboard.

## Requirements

- **R1.** Add a `/explore` page using the same visual design language as `/events` — black background, `#c8ff00` yellow accents, IBM Plex Mono, filter pills, large card grid.
- **R2.** Entity-type filter row (like source pills on events): `SPACES | COMMUNITIES | VCS | PROGRAMMES`. Selecting one filters the grid to that type. Default is ALL.
- **R3.** Sector/tag filter row below entity type: `ALL | FOUNDERS | AI | DEEPTECH | SCIENCE | CLIMATE | ...` derived from the actual tags/sectors in the data.
- **R4.** Cards display: name, strapline, area/primary_area, access_type or exclusivity badge, sector tags. Cover image if present; placeholder tile if not (consistent dark tile with yellow initial or tag).
- **R5.** Entry count shown in monospace ("47 entries", updates with active filter).
- **R6.** Admin edit mode: when admin is active (reuse existing admin auth pattern), each card shows an edit button. Clicking opens a modal to edit: name, strapline, description, website, area, cover_image URL, tags. Saves directly to Supabase.
- **R7.** `/guide` replaces the 6 hardcoded `GUIDE_ITEMS` with a live Supabase query across spaces + communities + programmes. Items are ranked by overlap between the entity's sectors/tags and the user's stored profile interests. Top 8 shown.
- **R8.** Nav (on `/events` and `/explore`) shows both destinations: `Events | Explore`.

## Success Criteria
- All 75+ KB entries are browsable without opening Supabase dashboard.
- An admin can update a card's description or website URL from the explore page.
- `/guide` shows real London entities (not "London Operators Circle") matched to the user's profile.
- Visual quality matches the events page — same card proportions, same filter UX, same typography.

## Scope Boundaries
- No graph/relationship view (future — show linked spaces/communities/people off a card).
- No full-text search.
- No vector similarity or LLM ranking in the guide (simple tag overlap is enough for now).
- No separate `/spaces`, `/communities`, `/vcs` route pages.
- No user accounts, saved/starred items, or public profiles.
- Cover images: most entries won't have them yet — placeholder handling is required but image upload is out of scope.

## Key Decisions
- **Unified /explore over separate pages**: Simpler nav, mirrors existing source-filter pattern, shows KB breadth in one view. Separate pages deferred until graph view warrants it.
- **Admin edit on explore cards**: Fastest path to keeping data fresh without a separate CMS or Notion sync. Reuses existing admin auth.
- **Simple tag-overlap ranking in guide**: Low complexity, ships fast. Vector/LLM upgrade is a later addition once KB has embeddings populated.
- **Placeholder tiles for missing cover images**: Most entries have no image yet. A consistent dark placeholder (name initial + type label in yellow) is better than broken images.

## Dependencies / Assumptions
- Admin auth pattern from `/admin` page is reusable (session storage key).
- Supabase client is already configured in `src/lib/supabase.ts`.
- User profile is stored in localStorage with `interests` / `lookingFor` fields from onboarding.

## Outstanding Questions

### Deferred to Planning
- [Affects R4][Technical] What's the right placeholder tile design — initial letter, entity-type icon, or gradient? Check what looks best alongside real cover images.
- [Affects R7][Technical] Exact shape of the Supabase query for guide ranking — single query across multiple tables or separate fetches merged client-side?
- [Affects R6][Technical] Modal vs. inline edit for admin card editing — check complexity of each given current component structure.

## Next Steps
→ `/ce:plan` for structured implementation planning
