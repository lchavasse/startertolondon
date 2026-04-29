-- Direct link to apply, book a trial, or join — surfaces as `[ apply ]`
-- in the card footer when set, sized appropriately to the access_type.

alter table spaces      add column if not exists access_url text;
alter table communities add column if not exists access_url text;
