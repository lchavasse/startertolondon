-- Enable extensions
create extension if not exists "uuid-ossp";
create extension if not exists "vector";

-- ============================================================
-- CORE ENTITY TABLES
-- ============================================================

create table spaces (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  strapline   text,
  description text,
  -- Location
  address     text,
  area        text,           -- e.g. "Shoreditch", "King's Cross"
  lat         float,
  lng         float,
  -- Attributes
  access_type text check (access_type in ('open', 'members', 'invite', 'mixed')),
  cost_type   text check (cost_type in ('free', 'paid', 'membership', 'variable')),
  cost_notes  text,
  crowd_tags  text[],         -- e.g. ["founders", "designers", "researchers"]
  capacity    int,
  -- Links
  website     text,
  luma_cal_ids text[],        -- Luma calendar IDs that host events here
  -- Meta
  tags        text[],
  cover_image text,
  featured    boolean default false,
  embedding   vector(1536),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table communities (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  name          text not null,
  strapline     text,
  description   text,
  -- Attributes
  sectors       text[],       -- e.g. ["ai", "fintech", "climate"]
  stages        text[],       -- e.g. ["idea", "early", "growth", "all"]
  exclusivity   text check (exclusivity in ('open', 'application', 'invite')),
  size_band     text check (size_band in ('micro', 'small', 'medium', 'large')),
  location_type text check (location_type in ('irl', 'online', 'hybrid')),
  primary_area  text,
  -- Links
  website       text,
  luma_cal_ids  text[],       -- Luma calendar IDs for this community's events
  luma_user_ids text[],       -- Luma user/profile IDs (usr- or username)
  -- Meta
  tags          text[],
  cover_image   text,
  featured      boolean default false,
  embedding     vector(1536),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create table event_series (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  name         text not null,
  strapline    text,
  description  text,
  -- Attributes
  sectors      text[],
  format       text check (format in ('talk', 'workshop', 'social', 'panel', 'demo', 'hackathon', 'mixed')),
  frequency    text check (frequency in ('weekly', 'biweekly', 'monthly', 'quarterly', 'adhoc')),
  typical_size int,
  free_or_paid text check (free_or_paid in ('free', 'paid', 'mixed')),
  -- Links — these tie back to Redis-scraped events
  luma_cal_ids              text[],  -- scraped events from these cal IDs belong to this series
  luma_user_ids             text[],  -- scraped events from these user profiles belong to this series
  eventbrite_organiser_ids  text[],
  meetup_group_ids          text[],
  -- Meta
  tags         text[],
  cover_image  text,
  featured     boolean default false,
  embedding    vector(1536),
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create table programmes (
  id                uuid primary key default gen_random_uuid(),
  slug              text unique not null,
  name              text not null,
  strapline         text,
  description       text,
  -- Attributes
  programme_type    text check (programme_type in ('incubator', 'accelerator', 'fellowship', 'grant', 'residency', 'bootcamp')),
  sectors           text[],
  stages            text[],
  length_weeks      int,
  cost_type         text check (cost_type in ('free', 'paid', 'equity', 'stipend')),
  equity_pct        float,
  stipend_notes     text,
  cohort_size       int,
  applications_open boolean default false,
  next_deadline     date,
  -- Links
  website           text,
  luma_cal_ids      text[],
  -- Meta
  tags              text[],
  cover_image       text,
  featured          boolean default false,
  embedding         vector(1536),
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

create table vcs (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  strapline   text,
  description text,
  -- Attributes
  sectors     text[],
  stages      text[],         -- e.g. ["pre-seed", "seed", "series-a"]
  check_min   int,            -- in £k
  check_max   int,
  london_team boolean default true,
  -- Links
  website       text,
  luma_cal_ids  text[],
  luma_user_ids text[],
  -- Meta
  tags        text[],
  cover_image text,
  featured    boolean default false,
  embedding   vector(1536),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table people (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  role        text,           -- e.g. "GP at XYZ", "Co-founder of ABC"
  bio         text,
  -- Links
  twitter       text,
  linkedin      text,
  website       text,
  luma_user_ids text[],       -- scraped events from this person tagged to them
  -- Meta
  tags        text[],
  avatar_url  text,
  featured    boolean default false,
  embedding   vector(1536),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table companies (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  name         text not null,
  strapline    text,
  description  text,
  -- Attributes
  sector       text,
  stage        text check (stage in ('idea', 'pre-seed', 'seed', 'series-a', 'series-b', 'growth', 'public')),
  founded_year int,
  london_hq    boolean default true,
  -- Links
  website      text,
  linkedin     text,
  -- Meta
  tags         text[],
  cover_image  text,
  featured     boolean default false,
  embedding    vector(1536),
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create table accommodation (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  name         text not null,
  strapline    text,
  description  text,
  -- Attributes
  accom_type   text check (accom_type in ('coliving', 'hostel', 'shortlet', 'hotel', 'flatshare')),
  cost_range   text,          -- e.g. "£800-1200/mo"
  area         text,
  -- Links
  website      text,
  -- Meta
  tags         text[],
  cover_image  text,
  featured     boolean default false,
  embedding    vector(1536),
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ============================================================
-- RELATIONSHIP TABLES
-- ============================================================

-- Community ↔ Spaces
create table community_spaces (
  community_id  uuid references communities(id) on delete cascade,
  space_id      uuid references spaces(id) on delete cascade,
  relation      text default 'hosts_at', -- 'based_at' | 'hosts_at' | 'affiliated'
  notes         text,
  primary key (community_id, space_id)
);

-- Community ↔ Event Series
create table community_event_series (
  community_id    uuid references communities(id) on delete cascade,
  event_series_id uuid references event_series(id) on delete cascade,
  primary key (community_id, event_series_id)
);

-- Community ↔ People
create table community_people (
  community_id uuid references communities(id) on delete cascade,
  person_id    uuid references people(id) on delete cascade,
  role         text default 'member', -- 'founder' | 'lead' | 'organiser' | 'member'
  primary key (community_id, person_id)
);

-- Community ↔ VCs
create table community_vcs (
  community_id uuid references communities(id) on delete cascade,
  vc_id        uuid references vcs(id) on delete cascade,
  relation     text default 'partner', -- 'sponsor' | 'partner' | 'investor'
  primary key (community_id, vc_id)
);

-- Community ↔ Companies
create table community_companies (
  community_id uuid references communities(id) on delete cascade,
  company_id   uuid references companies(id) on delete cascade,
  relation     text default 'member', -- 'member' | 'partner' | 'sponsor'
  primary key (community_id, company_id)
);

-- Event Series ↔ Spaces
create table event_series_spaces (
  event_series_id uuid references event_series(id) on delete cascade,
  space_id        uuid references spaces(id) on delete cascade,
  notes           text,
  primary key (event_series_id, space_id)
);

-- Event Series ↔ People
create table event_series_people (
  event_series_id uuid references event_series(id) on delete cascade,
  person_id       uuid references people(id) on delete cascade,
  role            text default 'organiser', -- 'organiser' | 'speaker' | 'host'
  primary key (event_series_id, person_id)
);

-- Programme ↔ Spaces
create table programme_spaces (
  programme_id uuid references programmes(id) on delete cascade,
  space_id     uuid references spaces(id) on delete cascade,
  primary key (programme_id, space_id)
);

-- Programme ↔ People
create table programme_people (
  programme_id uuid references programmes(id) on delete cascade,
  person_id    uuid references people(id) on delete cascade,
  role         text default 'mentor', -- 'mentor' | 'partner' | 'alum' | 'staff'
  primary key (programme_id, person_id)
);

-- Programme ↔ Companies
create table programme_companies (
  programme_id uuid references programmes(id) on delete cascade,
  company_id   uuid references companies(id) on delete cascade,
  relation     text default 'alum', -- 'alum' | 'sponsor' | 'partner'
  primary key (programme_id, company_id)
);

-- VC ↔ People
create table vc_people (
  vc_id     uuid references vcs(id) on delete cascade,
  person_id uuid references people(id) on delete cascade,
  role      text default 'partner', -- 'partner' | 'principal' | 'scout' | 'advisor'
  primary key (vc_id, person_id)
);

-- VC ↔ Companies
create table vc_companies (
  vc_id      uuid references vcs(id) on delete cascade,
  company_id uuid references companies(id) on delete cascade,
  relation   text default 'portfolio', -- 'portfolio' | 'scout' | 'advisor'
  primary key (vc_id, company_id)
);

-- Accommodation ↔ Spaces
create table accommodation_spaces (
  accommodation_id uuid references accommodation(id) on delete cascade,
  space_id         uuid references spaces(id) on delete cascade,
  relation         text default 'nearby', -- 'nearby' | 'affiliated' | 'partner'
  primary key (accommodation_id, space_id)
);

-- ============================================================
-- INDEXES
-- ============================================================

-- GIN indexes for array searches (luma ID lookups)
create index on spaces        using gin(luma_cal_ids);
create index on communities   using gin(luma_cal_ids);
create index on communities   using gin(luma_user_ids);
create index on event_series  using gin(luma_cal_ids);
create index on event_series  using gin(luma_user_ids);
create index on programmes    using gin(luma_cal_ids);
create index on vcs           using gin(luma_cal_ids);
create index on vcs           using gin(luma_user_ids);
create index on people        using gin(luma_user_ids);

-- Tag/sector array lookups
create index on communities  using gin(sectors);
create index on communities  using gin(stages);
create index on event_series using gin(sectors);
create index on programmes   using gin(sectors);
create index on programmes   using gin(stages);
create index on vcs          using gin(sectors);
create index on vcs          using gin(stages);

-- Vector similarity indexes
create index on spaces        using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index on communities   using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index on event_series  using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index on programmes    using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index on vcs           using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index on people        using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index on companies     using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index on accommodation using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger spaces_updated_at        before update on spaces        for each row execute function update_updated_at();
create trigger communities_updated_at   before update on communities   for each row execute function update_updated_at();
create trigger event_series_updated_at  before update on event_series  for each row execute function update_updated_at();
create trigger programmes_updated_at    before update on programmes    for each row execute function update_updated_at();
create trigger vcs_updated_at           before update on vcs           for each row execute function update_updated_at();
create trigger people_updated_at        before update on people        for each row execute function update_updated_at();
create trigger companies_updated_at     before update on companies     for each row execute function update_updated_at();
create trigger accommodation_updated_at before update on accommodation for each row execute function update_updated_at();
