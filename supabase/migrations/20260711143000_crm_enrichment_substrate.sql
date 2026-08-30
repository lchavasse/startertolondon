create table crm_enrichment_jobs (
  id                  uuid primary key default gen_random_uuid(),
  scope_type          text not null check (scope_type in ('opportunity', 'organisation', 'person', 'topic', 'list_import')),
  scope_id            uuid,
  job_type            text not null check (job_type in ('discover_contacts', 'org_research', 'speaker_research', 'topic_research', 'list_import')),
  status              text not null default 'queued' check (status in ('queued', 'searching', 'scraping', 'extracting', 'review', 'promoted', 'failed', 'cancelled')),
  priority            text not null default 'medium' check (priority in ('urgent', 'high', 'medium', 'low')),
  requested_by_user_id uuid references crm_users(id) on delete set null,
  assigned_to_user_id uuid references crm_users(id) on delete set null,
  input_payload       jsonb not null default '{}'::jsonb,
  result_summary      text,
  error_log           text,
  started_at          timestamptz,
  completed_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index crm_enrichment_jobs_status_idx on crm_enrichment_jobs(status, priority, created_at desc);
create index crm_enrichment_jobs_scope_idx on crm_enrichment_jobs(scope_type, scope_id);

create table crm_search_runs (
  id          uuid primary key default gen_random_uuid(),
  job_id       uuid not null references crm_enrichment_jobs(id) on delete cascade,
  provider     text not null check (provider in ('browser', 'manual', 'google', 'linkedin', 'company_site', 'notion', 'other')),
  query        text not null,
  status       text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index crm_search_runs_job_idx on crm_search_runs(job_id, created_at desc);

create table crm_search_hits (
  id                 uuid primary key default gen_random_uuid(),
  search_run_id      uuid not null references crm_search_runs(id) on delete cascade,
  title              text,
  url                text not null,
  snippet            text,
  domain             text,
  rank               integer,
  hit_type           text not null default 'other' check (hit_type in ('company_site', 'linkedin_profile', 'linkedin_company', 'team_page', 'article', 'directory', 'event_page', 'other')),
  selected_for_fetch boolean not null default false,
  created_at         timestamptz not null default now()
);

create index crm_search_hits_run_idx on crm_search_hits(search_run_id, rank asc nulls last, created_at asc);
create unique index crm_search_hits_unique_url_idx on crm_search_hits(search_run_id, url);

create table crm_source_documents (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid references crm_enrichment_jobs(id) on delete cascade,
  search_hit_id uuid references crm_search_hits(id) on delete set null,
  source_system text not null default 'manual' check (source_system in ('sheet', 'notion', 'supabase', 'gmail', 'whatsapp', 'granola', 'linkedin', 'manual')),
  url           text,
  title         text,
  document_type text not null default 'webpage' check (document_type in ('webpage', 'linkedin_profile', 'linkedin_company', 'article', 'directory', 'note', 'other')),
  fetched_at    timestamptz,
  raw_text      text,
  metadata      jsonb not null default '{}'::jsonb,
  content_hash  text,
  parse_status  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index crm_source_documents_job_idx on crm_source_documents(job_id, created_at desc);
create index crm_source_documents_hit_idx on crm_source_documents(search_hit_id);
create unique index crm_source_documents_hash_idx on crm_source_documents(content_hash) where content_hash is not null;

create table crm_extracted_facts (
  id                uuid primary key default gen_random_uuid(),
  job_id            uuid not null references crm_enrichment_jobs(id) on delete cascade,
  source_document_id uuid not null references crm_source_documents(id) on delete cascade,
  subject_type      text not null check (subject_type in ('opportunity', 'organisation', 'person', 'topic', 'list_import')),
  subject_temp_key  text,
  fact_type         text not null check (fact_type in ('website', 'linkedin_url', 'person_name', 'person_role', 'contact_email', 'contact_phone', 'location', 'market', 'sponsor_fit', 'speaker_topic', 'relationship_claim', 'other')),
  fact_value        text not null,
  confidence        numeric(4,3),
  evidence_excerpt  text,
  status            text not null default 'proposed' check (status in ('proposed', 'accepted', 'rejected', 'superseded')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index crm_extracted_facts_job_idx on crm_extracted_facts(job_id, status, created_at desc);
create index crm_extracted_facts_doc_idx on crm_extracted_facts(source_document_id);

create table crm_entity_candidates (
  id                 uuid primary key default gen_random_uuid(),
  job_id             uuid not null references crm_enrichment_jobs(id) on delete cascade,
  entity_type        text not null check (entity_type in ('person', 'organisation')),
  name               text not null,
  headline_or_role   text,
  website            text,
  linkedin_url       text,
  location           text,
  summary            text,
  confidence         numeric(4,3),
  status             text not null default 'proposed' check (status in ('proposed', 'accepted', 'rejected', 'merged')),
  promoted_entity_id uuid,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index crm_entity_candidates_job_idx on crm_entity_candidates(job_id, status, created_at desc);

create table crm_connection_candidates (
  id               uuid primary key default gen_random_uuid(),
  job_id           uuid not null references crm_enrichment_jobs(id) on delete cascade,
  from_entity_type text not null check (from_entity_type in ('person', 'organisation', 'opportunity', 'task', 'interaction')),
  from_entity_id   uuid,
  from_candidate_id uuid references crm_entity_candidates(id) on delete set null,
  to_entity_type   text not null check (to_entity_type in ('person', 'organisation', 'opportunity', 'task', 'interaction')),
  to_entity_id     uuid,
  to_candidate_id  uuid references crm_entity_candidates(id) on delete set null,
  connection_type  text not null check (connection_type in ('works_at', 'sponsor_target', 'speaker_candidate', 'founder_of', 'partner_at', 'knows_space', 'likely_buyer', 'warm_route')),
  label            text,
  confidence       numeric(4,3),
  evidence_excerpt text,
  status           text not null default 'proposed' check (status in ('proposed', 'accepted', 'rejected')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index crm_connection_candidates_job_idx on crm_connection_candidates(job_id, status, created_at desc);

create table crm_import_batches (
  id            uuid primary key default gen_random_uuid(),
  source_system text not null check (source_system in ('sheet', 'notion', 'supabase', 'gmail', 'whatsapp', 'granola', 'linkedin', 'manual')),
  name          text not null,
  source_url    text,
  import_type   text not null check (import_type in ('sponsor_targets', 'speaker_longlist', 'topic_seed', 'people_seed', 'organisation_seed')),
  row_count     integer not null default 0,
  status        text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index crm_import_batches_status_idx on crm_import_batches(status, created_at desc);

create table crm_import_rows (
  id                    uuid primary key default gen_random_uuid(),
  batch_id              uuid not null references crm_import_batches(id) on delete cascade,
  row_index             integer not null,
  raw_payload           jsonb not null default '{}'::jsonb,
  normalized_name       text,
  normalized_type       text,
  linked_opportunity_id uuid references crm_opportunities(id) on delete set null,
  linked_candidate_id   uuid references crm_entity_candidates(id) on delete set null,
  linked_entity_id      uuid,
  status                text not null default 'pending' check (status in ('pending', 'normalized', 'queued_for_enrichment', 'promoted', 'skipped', 'failed')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index crm_import_rows_batch_idx on crm_import_rows(batch_id, row_index asc);
create unique index crm_import_rows_unique_idx on crm_import_rows(batch_id, row_index);

alter table crm_enrichment_jobs enable row level security;
alter table crm_search_runs enable row level security;
alter table crm_search_hits enable row level security;
alter table crm_source_documents enable row level security;
alter table crm_extracted_facts enable row level security;
alter table crm_entity_candidates enable row level security;
alter table crm_connection_candidates enable row level security;
alter table crm_import_batches enable row level security;
alter table crm_import_rows enable row level security;

create trigger crm_enrichment_jobs_updated_at before update on crm_enrichment_jobs for each row execute function update_updated_at();
create trigger crm_search_runs_updated_at before update on crm_search_runs for each row execute function update_updated_at();
create trigger crm_source_documents_updated_at before update on crm_source_documents for each row execute function update_updated_at();
create trigger crm_extracted_facts_updated_at before update on crm_extracted_facts for each row execute function update_updated_at();
create trigger crm_entity_candidates_updated_at before update on crm_entity_candidates for each row execute function update_updated_at();
create trigger crm_connection_candidates_updated_at before update on crm_connection_candidates for each row execute function update_updated_at();
create trigger crm_import_batches_updated_at before update on crm_import_batches for each row execute function update_updated_at();
create trigger crm_import_rows_updated_at before update on crm_import_rows for each row execute function update_updated_at();
