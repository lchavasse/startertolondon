-- Add display_name + pixel_art to highlight-eligible entities.
-- display_name: short, often all-caps brand label for cards.
-- pixel_art: path/URL to the pixel-art image used on highlight cards.

alter table spaces      add column if not exists display_name text;
alter table spaces      add column if not exists pixel_art    text;
alter table communities add column if not exists display_name text;
alter table communities add column if not exists pixel_art    text;

-- Backfill the three existing highlights.
update spaces set display_name = 'RAMEN',   pixel_art = '/pixel/ramen.png'   where slug = 'ramen-space';
update spaces set display_name = 'PLUGGED', pixel_art = '/pixel/plugged.png' where slug = 'plugged';
update spaces set display_name = 'ENCODE',  pixel_art = '/pixel/encode.png'  where slug = 'encode-hub';
