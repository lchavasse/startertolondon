# KB Seed Batch — East London Spaces (2026-04-24)

Three best spaces in London for early-stage builders, plus their communities, leads, and anchor events. Includes The Bricklayers Arms as the venue for IndieBeers.

**Format:** one `## kind: slug` heading per entity, fenced `yaml` block with fields.
Slug refs (`lives_at`, `led_by`, `hosted_at`, `hosted_by`, `under`) are resolved by the seed script into the right join tables.

**Run:**
```bash
npm run seed:kb -- docs/kb-seeds/2026-04-24-east-london-spaces.md --dry-run
# then without --dry-run once the diff looks right
```

**Coords:** lat/lng on every `space` (sourced via OpenStreetMap Nominatim) so we can drop them on a map later.

**Future consolidation (not this batch):**
- `plugged` and `encode-club` are already in `src/lib/scrapers/sources.ts` (CHANNEL_SOURCES). The event scraper pulls from luma.com/<slug> via those entries. We're deliberately leaving `luma_cal_ids` null on the `communities` rows.
- `indie-london` Meetup group → the event-series has `meetup_group_ids: [indie-london]` but the Meetup scraper doesn't currently read from KB.

---

## space: ramen-space

```yaml
name: Ramen Space
display_name: RAMEN
pixel_art: /pixel/ramen.png
area: Dalston
address: Unit 6, Sledge Tower, Dalston Square, London E8 3GP
lat: 51.5456324
lng: -0.0743644
website: https://ramenclub.so/ramen-space
strapline: The home for indie hackers, solopreneurs and more
access_type: members
cost_type: membership
crowd_tags: [founders, indie-hackers, solopreneurs, saas, developers]
tags: [coworking, founders]
featured: true
description: |
  Founder coworking by Dalston Junction. Run by Ramen Club. Trial days for new members.
```

## community: ramen-club

```yaml
name: Ramen Club
primary_area: Dalston
website: https://ramenclub.so
sectors: [founders]
tags: [indie-hackers, coworking, saas]
exclusivity: application
featured: true
strapline: London's indie-hacker mothership
description: |
  Indie hacker community run by Charlie Ward. Hosts IndieBeers and runs Ramen Space.
lives_at: [ramen-space]
led_by: [charlie-ward]
```

## space: plugged

```yaml
name: Plugged
display_name: PLUGGED
pixel_art: /pixel/plugged.png
area: Shoreditch
address: Senna Building, Gorsuch Pl, London E2 8JF
lat: 51.5301925
lng: -0.0755139
website: https://pluggedfounders.com
strapline: The community every founder wishes they had
access_type: members
cost_type: membership
crowd_tags: [founders, builders]
tags: [coworking, founders, community]
featured: true
description: |
  Members-only founder coworking at Shoreditch Exchange. Workshops, open houses, the odd party.
```

## community: plugged-founders

```yaml
name: Plugged Founders
primary_area: Shoreditch
website: https://pluggedfounders.com
sectors: [founders]
tags: [coworking, community, workshops]
exclusivity: application
featured: true
strapline: The community every founder wishes they had
description: |
  Founders community since 2024. Runs Plugged at Shoreditch Exchange. Public events on Luma.
lives_at: [plugged]
led_by: [joshua-tulloch]
```

## space: encode-hub

```yaml
name: Encode Hub
display_name: ENCODE
pixel_art: /pixel/encode.png
area: Shoreditch
address: 41 Pitfield Street, London N1 6DA
lat: 51.5275694
lng: -0.0837896
website: https://hub.encode.club
strapline: The cool Shoreditch house for web3 and AI builders
access_type: mixed
cost_type: variable
crowd_tags: [ai, web3, developers, students, builders]
tags: [coworking, ai, web3, hackathon-host]
featured: true
description: |
  Encode Club's Shoreditch base. Free Friday coworking. Open for AI and web3 events.
```

## community: encode-club

```yaml
name: Encode Club
primary_area: Shoreditch
website: https://www.encodeclub.com
sectors: [ai, web3]
tags: [students, hackathons, education]
exclusivity: open
featured: true
strapline: AI and web3 community, student energy
description: |
  Student-led AI + web3 community. Hackathons, education, anchored at Encode Hub on Pitfield.
lives_at: [encode-hub]
led_by: [anthony-beaumont]
```

## space: bricklayers-arms

```yaml
name: The Bricklayers Arms
area: Shoreditch
address: 63 Charlotte Road, Shoreditch, London EC2A 3PE
lat: 51.5261509
lng: -0.0811105
strapline: Shoreditch pub, IndieBeers HQ
access_type: open
cost_type: free
crowd_tags: [pub, social, indie-hackers]
tags: [pub, event-venue, venue-only]
featured: false
description: |
  Shoreditch pub. Last-Wednesday-of-the-month home for IndieBeers.
```

---

## person: charlie-ward

```yaml
name: Charlie Ward
role: Founder, Ramen Club
twitter: https://x.com/charlierward
tags: [founder, community-builder, coworking]
featured: true
```

## person: joshua-tulloch

```yaml
name: Joshua Tulloch
role: Founder, Plugged Founders
linkedin: https://www.linkedin.com/in/joshua-tulloch/
tags: [founder, community-builder]
featured: true
```

## person: anthony-beaumont

```yaml
name: Anthony Beaumont
role: Lead, Encode Club (London Hub)
twitter: https://x.com/anth0nybeaumont
tags: [community-builder, ai, web3]
featured: true
```

---

## event_series: indie-beers

```yaml
name: IndieBeers
frequency: monthly
format: social
free_or_paid: free
typical_size: 30
meetup_group_ids: [indie-london]
tags: [indie-hackers, social, monthly]
strapline: Last-Wednesday pub meetup for indie hackers
description: |
  Monthly indie-hacker drinks at The Bricklayers Arms. Last Wed of the month, 6pm. Ask for Charlie.
hosted_at: [bricklayers-arms]
hosted_by: [charlie-ward]
under: [ramen-club]
```

## event_series: encode-friday-coworking

```yaml
name: Encode Friday Coworking
frequency: weekly
format: coworking
free_or_paid: free
typical_size: 25
tags: [ai, web3, coworking]
strapline: Free Friday coworking at Encode Hub
description: |
  Weekly free Friday coworking at Encode Hub. Open to the Encode Club community.
hosted_at: [encode-hub]
under: [encode-club]
```
