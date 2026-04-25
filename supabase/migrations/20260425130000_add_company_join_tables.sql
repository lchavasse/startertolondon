-- Company ↔ People and Company ↔ Spaces join tables.
-- Mirrors community_people / community_spaces patterns.

create table company_people (
  company_id uuid references companies(id) on delete cascade,
  person_id  uuid references people(id) on delete cascade,
  role       text default 'employee', -- 'founder' | 'cofounder' | 'cto' | 'employee' | 'advisor'
  primary key (company_id, person_id)
);

create table company_spaces (
  company_id uuid references companies(id) on delete cascade,
  space_id   uuid references spaces(id) on delete cascade,
  relation   text default 'based_at', -- 'based_at' | 'office_at' | 'affiliated'
  notes      text,
  primary key (company_id, space_id)
);
