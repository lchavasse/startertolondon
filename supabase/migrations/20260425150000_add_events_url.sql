-- Card-level link to a luma calendar (or other events feed) for the entity.
-- Surfaces as `[ events ]` in the highlight card footer.

alter table spaces      add column if not exists events_url text;
alter table communities add column if not exists events_url text;

update spaces set events_url = 'https://luma.com/plugged' where slug = 'plugged';
update spaces set events_url = 'https://luma.com/mafia'   where slug = 'unicorn-mafia';
