-- Add 'coworking' to the allowed event_series.format values.
-- Coworking sessions (e.g. Encode Friday Coworking) don't fit talk/workshop/social/etc.
alter table event_series drop constraint if exists event_series_format_check;
alter table event_series add constraint event_series_format_check
  check (format in ('talk', 'workshop', 'social', 'panel', 'demo', 'hackathon', 'coworking', 'mixed'));
