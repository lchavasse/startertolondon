-- Sourcing pool for events: everyone classified from Lachlan's LinkedIn network, the
-- deeptech-scanner companies, and profiles adjacent to both.
--
-- Deliberately one wide table rather than a normalised set. This is a derived working surface
-- rebuilt from the staging pipeline, not a system of record — the authoritative copies of a person
-- live in crm_people once promoted. The columns an operator edits by hand (shortlisted, note,
-- group/pillar corrections) are the exception: those are the only data here that cannot be
-- regenerated, so the importer must never overwrite them.

create table crm_people_pool (
  slug              text primary key,
  profile_url       text not null,
  full_name         text,
  company           text,
  company_norm      text,
  location          text,
  followers         integer,

  -- classifier output
  event_group       text not null,
  pillars           text[] not null default '{}',
  seniority         text,
  role_type         text,
  confidence        numeric(4,3) not null default 0,
  evidence          text,
  fit               integer not null default 0,
  is_deeptech       boolean not null default false,

  -- what the scanner knows about their employer
  scanner_sector    text,
  is_physical       boolean,
  industrial_score  integer,
  company_stage     text,
  company_website   text,

  -- reachability
  is_connection     boolean not null default false,
  last_message_at   timestamptz,
  awaiting_reply_from text,
  message_count     integer,
  sources           text,

  -- operator-owned. Never overwritten by a re-import.
  shortlisted       boolean not null default false,
  note              text,
  corrected         boolean not null default false,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index crm_people_pool_group_idx on crm_people_pool(event_group, fit desc);
create index crm_people_pool_shortlisted_idx on crm_people_pool(shortlisted) where shortlisted;
create index crm_people_pool_note_idx on crm_people_pool(note) where note is not null;
create index crm_people_pool_pillars_idx on crm_people_pool using gin(pillars);

alter table crm_people_pool enable row level security;

create trigger crm_people_pool_updated_at before update on crm_people_pool
  for each row execute function update_updated_at();
