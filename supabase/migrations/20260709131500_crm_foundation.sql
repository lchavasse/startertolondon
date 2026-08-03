-- DeepTech London CRM foundation
-- New CRM-specific tables only. Existing project tables remain untouched.

create table crm_users (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  email       text unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table crm_organisations (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  slug                  text unique not null,
  org_type              text not null check (org_type in ('sponsor', 'startup', 'vc', 'community', 'media', 'venue', 'university', 'operator', 'other')),
  website               text,
  linkedin_url          text,
  notes_freeform        text,
  relationship_summary  text,
  owner_user_id         uuid references crm_users(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table crm_people (
  id                    uuid primary key default gen_random_uuid(),
  full_name             text not null,
  slug                  text unique not null,
  primary_email         text,
  primary_phone         text,
  linkedin_url          text,
  title                 text,
  location              text,
  notes_freeform        text,
  relationship_summary  text,
  owner_user_id         uuid references crm_users(id) on delete set null,
  last_contacted_at     timestamptz,
  next_followup_at      timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table crm_person_organisations (
  id               uuid primary key default gen_random_uuid(),
  person_id        uuid not null references crm_people(id) on delete cascade,
  organisation_id  uuid not null references crm_organisations(id) on delete cascade,
  role_label       text,
  is_primary       boolean not null default false,
  notes            text,
  created_at       timestamptz not null default now()
);

create table crm_opportunities (
  id                    uuid primary key default gen_random_uuid(),
  title                 text not null,
  workstream            text not null check (workstream in ('sponsor', 'speaker', 'expo', 'attendee', 'community_partner', 'press', 'topic', 'week_ops')),
  stage                 text,
  status                text not null default 'active' check (status in ('active', 'won', 'lost', 'paused')),
  priority              text not null default 'medium' check (priority in ('urgent', 'high', 'medium', 'low')),
  owner_user_id         uuid references crm_users(id) on delete set null,
  source_of_lead        text,
  ask_type              text,
  value_notes           text,
  summary               text,
  next_action           text,
  next_followup_at      timestamptz,
  last_activity_at      timestamptz,
  notes_freeform        text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table crm_opportunity_people (
  id              uuid primary key default gen_random_uuid(),
  opportunity_id  uuid not null references crm_opportunities(id) on delete cascade,
  person_id       uuid not null references crm_people(id) on delete cascade,
  role_label      text,
  created_at      timestamptz not null default now(),
  unique (opportunity_id, person_id)
);

create table crm_opportunity_organisations (
  id               uuid primary key default gen_random_uuid(),
  opportunity_id   uuid not null references crm_opportunities(id) on delete cascade,
  organisation_id  uuid not null references crm_organisations(id) on delete cascade,
  role_label       text,
  created_at       timestamptz not null default now(),
  unique (opportunity_id, organisation_id)
);

create table crm_tasks (
  id                     uuid primary key default gen_random_uuid(),
  title                  text not null,
  description            text,
  owner_user_id          uuid references crm_users(id) on delete set null,
  linked_opportunity_id  uuid references crm_opportunities(id) on delete set null,
  linked_person_id       uuid references crm_people(id) on delete set null,
  linked_organisation_id uuid references crm_organisations(id) on delete set null,
  status                 text not null default 'todo' check (status in ('todo', 'in_progress', 'blocked', 'done', 'cancelled')),
  priority               text not null default 'medium' check (priority in ('urgent', 'high', 'medium', 'low')),
  due_at                 timestamptz,
  reminder_at            timestamptz,
  generated_by_rule      boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table crm_interactions (
  id                  uuid primary key default gen_random_uuid(),
  interaction_type    text not null check (interaction_type in ('email', 'whatsapp', 'granola', 'meeting', 'linkedin', 'note', 'call', 'manual')),
  direction           text not null default 'internal' check (direction in ('inbound', 'outbound', 'internal')),
  happened_at         timestamptz not null default now(),
  summary             text not null,
  raw_excerpt         text,
  source_system       text,
  source_external_id  text,
  source_url          text,
  person_id           uuid references crm_people(id) on delete set null,
  organisation_id     uuid references crm_organisations(id) on delete set null,
  opportunity_id      uuid references crm_opportunities(id) on delete set null,
  created_by_user_id  uuid references crm_users(id) on delete set null,
  created_at          timestamptz not null default now()
);

create table crm_source_links (
  id             uuid primary key default gen_random_uuid(),
  entity_type    text not null check (entity_type in ('person', 'organisation', 'opportunity', 'task', 'interaction')),
  entity_id      uuid not null,
  source_system  text not null check (source_system in ('sheet', 'notion', 'supabase', 'gmail', 'whatsapp', 'granola', 'linkedin', 'manual')),
  source_ref     text,
  source_url     text,
  metadata       jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at     timestamptz not null default now()
);

create index crm_people_owner_idx on crm_people(owner_user_id);
create index crm_people_next_followup_idx on crm_people(next_followup_at);
create unique index crm_person_organisations_unique_idx on crm_person_organisations(person_id, organisation_id, coalesce(role_label, ''));
create index crm_organisations_owner_idx on crm_organisations(owner_user_id);
create index crm_opportunities_owner_idx on crm_opportunities(owner_user_id);
create index crm_opportunities_workstream_idx on crm_opportunities(workstream);
create index crm_opportunities_status_idx on crm_opportunities(status);
create index crm_opportunities_next_followup_idx on crm_opportunities(next_followup_at);
create index crm_tasks_owner_idx on crm_tasks(owner_user_id);
create index crm_tasks_status_idx on crm_tasks(status);
create index crm_tasks_due_idx on crm_tasks(due_at);
create index crm_interactions_happened_idx on crm_interactions(happened_at desc);
create index crm_interactions_opportunity_idx on crm_interactions(opportunity_id);
create index crm_source_links_entity_idx on crm_source_links(entity_type, entity_id);

create trigger crm_users_updated_at          before update on crm_users          for each row execute function update_updated_at();
create trigger crm_organisations_updated_at  before update on crm_organisations  for each row execute function update_updated_at();
create trigger crm_people_updated_at         before update on crm_people         for each row execute function update_updated_at();
create trigger crm_opportunities_updated_at  before update on crm_opportunities  for each row execute function update_updated_at();
create trigger crm_tasks_updated_at          before update on crm_tasks          for each row execute function update_updated_at();

insert into crm_users (slug, name, email)
values
  ('lachlan', 'Lachlan', null),
  ('barrett', 'Barrett', null)
on conflict (slug) do nothing;
