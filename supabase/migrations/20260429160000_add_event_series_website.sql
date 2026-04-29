-- Generic outbound link for an event_series (Meetup group, Eventbrite organiser,
-- Luma calendar landing page, etc.). Surfaces as the linked series name in cards.

alter table event_series add column if not exists website text;

update event_series set website = 'https://www.meetup.com/indie-london/' where slug = 'indie-beers';
