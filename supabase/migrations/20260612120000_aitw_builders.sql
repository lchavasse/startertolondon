-- Agents in the Wild: builders, teams & submissions.
-- A team IS a project — builders point at a project row; teammates share it.
-- RLS is enabled with no policies: the anon key can't touch these tables.
-- All access goes through /api/aitw/* using the service role key.

create table aitw_projects (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  description     text,
  submission_url  text,
  submitted_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table aitw_builders (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null unique,
  phone       text,
  project_id  uuid references aitw_projects(id) on delete set null,
  source      text not null default 'import' check (source in ('import', 'signup')),
  created_at  timestamptz not null default now()
);

create index aitw_builders_project_id_idx on aitw_builders (project_id);

alter table aitw_projects enable row level security;
alter table aitw_builders enable row level security;
