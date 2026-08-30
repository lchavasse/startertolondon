-- Doctorate status for the sourcing pool.
--
-- Three-valued rather than a boolean because DeepTech London wants CURRENT PhD candidates as much
-- as finished ones — a final-year candidate is arguably a better dinner guest than someone who
-- graduated five years ago — and they do not carry the title yet. A yes/no column would erase
-- exactly the group being looked for.
--
-- Derived from 2,466 connections checked by agents against education history, titles and bios:
-- 184 completed, 55 in progress. Only 22 of the completed advertise it in their name, so this
-- cannot be recovered with a query over existing columns.

alter table crm_people_pool
  add column if not exists doctorate_status      text,
  add column if not exists doctorate_field       text,
  add column if not exists doctorate_institution text,
  add column if not exists doctorate_confidence  numeric(4,3);

alter table crm_people_pool
  add constraint crm_people_pool_doctorate_status_check
  check (doctorate_status is null or doctorate_status in ('completed', 'in_progress', 'none'));

create index if not exists crm_people_pool_doctorate_idx
  on crm_people_pool(doctorate_status)
  where doctorate_status in ('completed', 'in_progress');
