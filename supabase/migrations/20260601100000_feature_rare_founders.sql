-- Feature Rare Founders on /explore: yearly Demo Day, top spot + neon spotlight.

-- 1. Allow 'yearly' frequency (annual flagship events like the Demo Day).
alter table event_series drop constraint if exists event_series_frequency_check;
alter table event_series add constraint event_series_frequency_check
  check (frequency in ('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly', 'adhoc'));

update event_series set frequency = 'yearly' where slug = 'rare-founders-demo-day';

-- 2. Reorder highlight cards. display_order now sorts globally across spaces +
--    communities (see fetchHighlights), so a community can lead the grid.
update communities set display_order = 1 where slug = 'rare-founders';
update spaces      set display_order = 2 where slug = 'ramen-space';
update spaces      set display_order = 3 where slug = 'plugged';
update spaces      set display_order = 4 where slug = 'encode-hub';
update spaces      set display_order = 5 where slug = 'opus-house';
update spaces      set display_order = 6 where slug = 'unicorn-mafia';
update communities set display_order = 7 where slug = 'ignite-london';

-- 3. Move the neon spotlight from Ramen Space to Rare Founders.
update communities set highlight_url = 'https://luma.com/user/rarefounders' where slug = 'rare-founders';
update spaces      set highlight_url = null where slug = 'ramen-space';
