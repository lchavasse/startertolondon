-- Explicit ordering for highlight cards (and any future curated list).
-- Lower number = earlier. NULL = unordered, falls to alphabetical tail.

alter table spaces      add column if not exists display_order int;
alter table communities add column if not exists display_order int;

update spaces set display_order = 1 where slug = 'ramen-space';
update spaces set display_order = 2 where slug = 'plugged';
update spaces set display_order = 3 where slug = 'encode-hub';
