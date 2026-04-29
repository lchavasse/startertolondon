-- Card-level "feature spotlight" link. When set, the whole card glows neon blue
-- and clicking it (outside nested links) opens the URL in a new tab.

alter table spaces      add column if not exists highlight_url text;
alter table communities add column if not exists highlight_url text;
