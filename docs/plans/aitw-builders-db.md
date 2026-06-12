# Plan — Agents in the Wild: builders, teams & submissions

**Goal:** let the ~50 accepted builders identify themselves, form teams, describe
their project on a shared page, and submit one doc link — keyed by email, no real
auth.

**Decisions (Lachlan, 12 Jun):**
- Teams and projects are **one entity** — two tables total.
- Project pages are **members-only** (no public gallery).
- Submission **soft-locks** after 28 Jun — late edits allowed but stamped late.
- Builders have **name, email, phone**.
- **No poaching**: you can only add builders who aren't on a team. Individuals
  can move themselves anywhere at any time.
- Submission is a **Google Doc link** on the team page. **Autosave on blur**
  for every field, plus a clear save button.
- Target Supabase project: **frontier-tower** (`yexvsmicvmbyfthdiixa`) — same as
  the KB; CLI is linked and the service-role key is in `.env`.

---

## Schema (Supabase, same project as the KB)

```sql
create table aitw_projects (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  description     text,                    -- "what we're working on"
  submission_url  text,                    -- the single doc link
  submitted_at    timestamptz,             -- stamped on every submission_url change
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table aitw_builders (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null unique,        -- stored lowercased
  phone       text,
  project_id  uuid references aitw_projects(id),  -- null = no team yet
  source      text not null default 'import',     -- 'import' | 'signup'
  created_at  timestamptz not null default now()
);
```

That's it. A team is the set of builders sharing a `project_id`; a solo builder
is a one-person project. Late = `submitted_at > 2026-06-28 23:59 Europe/London`
(checked at read time — no extra column).

`aitw_` prefix keeps these clearly separate from the KB tables. **RLS enabled,
no anon policies** — the anon key can't touch them; all access goes through API
routes using `SUPABASE_SERVICE_ROLE_KEY` (same pattern as `seed-kb.ts` /
`/api/admin/kb`).

## API routes — `/api/aitw/*`

| Route | Does |
|---|---|
| `POST /identify` `{email}` | The "login". Returns builder + their project (with members' names). 404 → show signup. |
| `GET /builders?q=` | Name search for self-select and add-teammate. Returns `{id, name, hasTeam}` only — **never emails**. |
| `POST /builders` `{name, email, phone}` | Self-signup when not in the imported list (`source: 'signup'`). Also lets a claimed import row fill in a missing phone. |
| `POST /projects` `{email, name, description}` | Create project + assign creator to it. |
| `PATCH /projects` `{email, ...fields}` | Edit name/description/`submission_url` (Google Doc link). Caller's email must match a member. Setting `submission_url` stamps `submitted_at`. |
| `POST /projects/members` `{email, builderId}` | Add a builder to the caller's project — **rejected if the target already has a team** (no poaching). |
| `POST /projects/join` `{email, projectId}` | Move *yourself* to any project (search by project or teammate name). Also how you leave: join elsewhere or `projectId: null`. |

Every mutating route takes the caller's email in the body and checks it matches
a builder row (and membership where relevant). That's the whole access model.

## UI — one page: `/agents-in-the-wild/team`

Client page, email remembered in `localStorage`:

1. **Enter your email** → known? jump to 3.
2. Unknown email → **search your name** (imported from Luma) and claim it, or
   **sign up** (name, email, phone).
3. **No team yet** → create a project, join one (self-move is always allowed),
   or get added by a teammate.
4. **Project page** (shared, members-only): project name, description, member
   list + add-teammate search (un-teamed builders only), and the **submission
   field** — one Google Doc URL (the doc must contain: report, GitHub, demo
   video, live links). After 28 Jun the field shows a "late" warning but still
   saves.

Every field **autosaves on blur** (with a saved/saving indicator) and there's an
explicit save button for reassurance — same write path either way.

Link it from the rules page (Submission section) and the landing page topbar.

## Import + admin

- `scripts/import-builders.ts` — CSV (`name,email`) from the Luma export →
  service-role upsert on email. Re-runnable as more signups land.
- Reviewing submissions = one Supabase table view sorted by `submitted_at`
  (or a tiny `scripts/list-submissions.ts` if that gets annoying).

## Out of scope (deliberately)

No auth/magic links, no public gallery, no edit history, no image uploads, no
multi-team membership, no delete flows (Supabase dashboard covers admin fixes).

## Build order

1. SQL migration (Supabase dashboard) + regenerate `database.types.ts`.
2. Import script.
3. API routes.
4. `/team` page.
5. Wire links from rules page + landing; replace the `[SUBMISSION LINK — TBC]`
   placeholder with the `/team` page.
