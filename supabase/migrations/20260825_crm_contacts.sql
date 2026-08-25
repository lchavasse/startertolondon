-- The working layer that sits on top of the sources.
--
-- crm_people_pool (2,635), deeptech_scraper_companies (3,338), founder_candidates (1,060),
-- deeptech_expo and deeptech_waitlist are all lakes: fed by scrapers and public forms, read-only
-- as far as the operator is concerned, and far too large to work through. A row appears here only
-- when someone becomes an active lead, so this table stays the size of the conversations actually
-- in flight rather than the size of everything known.
--
-- source_system + source_ref point back at the lake row this was pulled from, and are unique
-- together so pulling the same person in twice updates rather than duplicates. A contact typed in
-- by hand has no source_ref, which is why the index is partial.

create table crm_contacts (
  id                uuid primary key default gen_random_uuid(),

  full_name         text not null,
  company           text,
  email             text,
  phone             text,
  linkedin_url      text,

  source_system     text not null,
  source_ref        text,

  status            text not null default 'new',
  labels            text[] not null default '{}',
  note              text,
  owner             text,

  last_contacted_at timestamptz,
  next_followup_at  timestamptz,

  -- Whatever the enrichment pass found. Deliberately schemaless: the shape of what is worth
  -- keeping about a person is still moving, and a jsonb column costs nothing to widen.
  enrichment        jsonb not null default '{}'::jsonb,
  enriched_at       timestamptz,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint crm_contacts_status_check check (status in
    ('new', 'reviewing', 'contacted', 'in_conversation', 'confirmed', 'declined', 'parked'))
);

create unique index crm_contacts_source_idx on crm_contacts(source_system, source_ref)
  where source_ref is not null;
create unique index crm_contacts_linkedin_idx on crm_contacts(linkedin_url)
  where linkedin_url is not null;
create index crm_contacts_status_idx on crm_contacts(status, updated_at desc);
create index crm_contacts_labels_idx on crm_contacts using gin(labels);
create index crm_contacts_followup_idx on crm_contacts(next_followup_at)
  where next_followup_at is not null;

-- The timeline. Free text plus a date is the whole point — what was said, when. Anything more
-- structured than this was what emptied crm_outreach_entries: a form with eight required fields
-- does not get filled in.
create table crm_contact_events (
  id          uuid primary key default gen_random_uuid(),
  contact_id  uuid not null references crm_contacts(id) on delete cascade,
  happened_at timestamptz not null default now(),
  kind        text not null default 'note',
  body        text not null,
  author      text,
  created_at  timestamptz not null default now(),

  constraint crm_contact_events_kind_check check (kind in
    ('note', 'outreach', 'reply', 'meeting', 'status_change'))
);

create index crm_contact_events_contact_idx on crm_contact_events(contact_id, happened_at desc);

alter table crm_contacts enable row level security;
alter table crm_contact_events enable row level security;

create trigger crm_contacts_updated_at before update on crm_contacts
  for each row execute function update_updated_at();
