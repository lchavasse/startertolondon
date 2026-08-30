create table crm_contact_points (
  id          uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('person', 'organisation')),
  entity_id   uuid not null,
  label       text,
  channel     text not null check (channel in ('email', 'linkedin', 'whatsapp', 'phone', 'x', 'webform', 'other')),
  value       text not null,
  notes       text,
  is_primary  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index crm_contact_points_unique_idx
on crm_contact_points(entity_type, entity_id, channel, value);

create index crm_contact_points_entity_idx
on crm_contact_points(entity_type, entity_id);

create table crm_outreach_entries (
  id               uuid primary key default gen_random_uuid(),
  opportunity_id   uuid not null references crm_opportunities(id) on delete cascade,
  contact_point_id uuid references crm_contact_points(id) on delete set null,
  person_id        uuid references crm_people(id) on delete set null,
  organisation_id  uuid references crm_organisations(id) on delete set null,
  owner_user_id    uuid references crm_users(id) on delete set null,
  channel          text not null check (channel in ('email', 'linkedin', 'whatsapp', 'phone', 'x', 'webform', 'other')),
  direction        text not null default 'outbound' check (direction in ('outbound', 'inbound', 'internal')),
  status           text not null default 'sent' check (status in ('draft', 'queued', 'sent', 'replied', 'no_response', 'bounced', 'declined')),
  subject          text,
  body_excerpt     text,
  happened_at      timestamptz not null default now(),
  next_step        text,
  next_due_at      timestamptz,
  source_url       text,
  notes            text,
  created_at       timestamptz not null default now()
);

create index crm_outreach_entries_opportunity_idx on crm_outreach_entries(opportunity_id);
create index crm_outreach_entries_happened_idx on crm_outreach_entries(happened_at desc);
create index crm_outreach_entries_next_due_idx on crm_outreach_entries(next_due_at);

alter table crm_contact_points enable row level security;
alter table crm_outreach_entries enable row level security;

create trigger crm_contact_points_updated_at before update on crm_contact_points for each row execute function update_updated_at();
