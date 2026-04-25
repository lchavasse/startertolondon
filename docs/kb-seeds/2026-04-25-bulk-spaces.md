# KB Seed Batch — Bulk Spaces by Category (2026-04-25)

User-driven bulk add across six categories: affordable workspace, coworking, "boring"
enterprise coworking chains, labs, members clubs, and London classics. Wilbe held
back for separate treatment per user.

**Tag taxonomy:**
- `affordable` *(new)* — community/charity/below-market workspace
- `coworking` — generic coworking
- `studio` — studio space
- `enterprise` *(new)* — generic chain coworking, distinguishes from curated picks
- `lab` — wet lab / biotech / research
- `members-club` — private members club
- `iconic` *(new)* — heritage / landmark venues

**Multi-site policy (per user):** one entity per org, primary address chosen, all
sites listed in description. Exception: WeWork — user explicitly listed two sites,
so two entries.

**Sources:** per-entity research notes appended below; key sources used:
londonaire.co.uk lists, official sites, LinkedIn pages, Wikipedia for heritage venues.

**Per-entity sources:**
- camden-collective: https://camdencollective.co.uk/ + LinkedIn
- the-trampery: existing DB row + thetrampery.com (Old St / Peckham Levels / Tottenham per user)
- 3space: 3space.org / 3spacewarrenstreet.com / 3spaceinternational.co.uk
- london-ai-hub: existing DB row, enrich featured + tags
- shoreditch-exchange: shoreditch-exchange.com (100k sqft, 8 floors, home of Plugged Founders)
- plexal: plexal.com (Stratford Here East + Shoreditch)
- fora: foraspace.com (multi-site, primary Paddington 19 Eastbourne Tce; The Jellicoe already in DB)
- halkin: halkin.com (75k sqft Grade A at 1-2 Paris Garden — same building as unicorn-mafia community, separate entity for the building's commercial coworking)
- wework-kings-cross: 9 York Way N1C 4AS
- wework-st-katharine: St Katharine Docks E1W
- general-people: generalpeople.com (6 London sites, primary Walworth Town Hall)
- arc-club: arc-club.com (Harrow, Homerton, Camberwell Green, Earlsfield — neighbourhood coworking, NOT same as ARC West London labs)
- runway-east: runwayea.st (5 London sites, founded 2014 by Natasha Guerra + Alex Hoye)
- uncommon: uncommon.co.uk (Holborn, Liverpool St, Borough, Highbury & Islington, Fulham)
- workspace-group: workspace.co.uk (FTSE-listed REIT, 60 London locations)
- arc-west-london: arcgroup.io (Refinery building, Hammersmith W6 9RH, 150k sqft biotech labs)
- victoria-house: existing DB row (already lab tag); skip enrich, no new info
- hulm-club: hulm.club (Farringdon, founders Zubar + Humayra Hanif)
- curve-club: curve.club (15 Westland Place, ex-fire station)
- pavilion-club: pavilion.club (4 sites: City, Knightsbridge, Kensington, Fulham)
- the-conduit: theconduit.com (6 Langley St WC2H 9JA)
- home-house: homehouse.co.uk (20 Portman Square W1H 6LW, Georgian since 1998)
- the-ned: thened.com (27 Poultry EC2R 8AJ, Lutyens-designed ex-Midland Bank, Soho House Group + Sydell)
- soho-house: 40 Greek Street W1D 4SU original

**Run:**
```bash
npm run seed:kb -- docs/kb-seeds/2026-04-25-bulk-spaces.md --dry-run
npm run seed:kb -- docs/kb-seeds/2026-04-25-bulk-spaces.md
```

---

# ##affordable

## space: camden-collective

```yaml
name: Camden Collective
area: Camden
address: 110 Hampstead Road, London NW1 2LS
lat: 51.5280364
lng: -0.1386351
website: https://camdencollective.co.uk/
strapline: Free hotdesking + subsidised offices for Camden creatives
access_type: mixed
cost_type: variable
crowd_tags: [founders, creatives, makers]
tags: [coworking, affordable]
featured: true
description: |
  Camden charity offering free hotdesking and below-market private offices
  for early-stage creative startups. One minute from Mornington Crescent.
```

## space: the-trampery

```yaml
# Enriching existing row — preserving name, adding multi-site mentions + affordable tag.
name: The Trampery
area: Old Street
address: 239 Old Street, London EC1V 9EY
lat: 51.5267359
lng: -0.0841240
website: https://thetrampery.com
strapline: Creative and tech workspace community across multiple London sites
tags: [coworking, studio, events, affordable]
description: |
  Mission-driven workspace operator with sites in Old Street, Peckham Levels,
  Tottenham and Canning Town. Subsidised studios for creatives and founders.
```

## space: 3space

```yaml
name: 3Space
area: Brixton
address: International House, 6 Canterbury Crescent, Brixton, London SW9 7QD
lat: 51.4640596
lng: -0.1129921
website: https://3space.org
strapline: London's largest affordable workspace, BuyGiveWork model
access_type: members
cost_type: variable
crowd_tags: [founders, social-enterprise, artists]
tags: [coworking, affordable]
featured: true
description: |
  Brixton flagship is 12 floors and 90k sqft of subsidised workspace; second
  site at 37-38 Warren Street. BuyGiveWork: every desk paid for funds a free desk.
```

---

# ##coworkings

## space: london-ai-hub

```yaml
# Enriching existing row — just bumping to featured + adding ai tag.
name: London AI Hub
tags: [coworking, events, ai]
featured: true
```

## space: shoreditch-exchange

```yaml
name: Shoreditch Exchange
area: Shoreditch
address: Senna Building, Gorsuch Place, London E2 8JF
lat: 51.5301925
lng: -0.0755139
website: https://shoreditch-exchange.com
strapline: 100k sqft coworking near Hoxton, home of Plugged Founders
access_type: members
cost_type: paid
crowd_tags: [founders, creatives]
tags: [coworking, events]
featured: true
description: |
  Eight floors, 90+ meeting rooms, less than a minute from Hoxton station.
  Hosts Plugged Founders' clubhouse on a dedicated floor.
```

## space: plexal

```yaml
name: Plexal
area: Stratford
address: The Press Centre, Here East, 14 East Bay Lane, London E20 3BS
lat: 51.5464270
lng: -0.0226319
website: https://www.plexal.com/workspace/
strapline: East London innovation hub at Here East
access_type: members
cost_type: paid
crowd_tags: [founders, techies, govtech]
tags: [coworking, events, lab]
featured: true
description: |
  Innovation centre on Queen Elizabeth Olympic Park's Here East campus,
  with a Shoreditch satellite. 1000+ members, business support programmes.
```

## space: fora

```yaml
name: Fora
area: Paddington
address: 19 Eastbourne Terrace, Paddington, London W2 6LG
lat: 51.5177365
lng: -0.1795573
website: https://www.foraspace.com
strapline: Premium proworking with bespoke buildings across London
access_type: members
cost_type: paid
crowd_tags: [founders, creatives, agencies]
tags: [coworking, members-club, events]
featured: true
description: |
  Premium coworking operator (part of The Office Group). London sites include
  Paddington (Brunel building), King's Cross (The Jellicoe + The Stanley + East Side)
  and Borough.
```

## space: halkin

```yaml
# Distinct from space:unicorn-mafia (same address, different identity — UM is the dev community
# living within Halkin's commercial coworking).
name: Halkin
area: Southwark
address: 1-2 Paris Garden, London SE1 8ND
lat: 51.5062389
lng: -0.1060650
website: https://www.halkin.com/locations/1-2-paris-garden
strapline: 75k sqft Grade A coworking on Paris Garden
access_type: members
cost_type: paid
crowd_tags: [founders, creatives, agencies]
tags: [coworking, events]
featured: true
description: |
  Art-deco Grade A building with four floors of coworking, private offices
  and event space. Three minutes from Southwark station, walk to Southbank.
```

## space: wework-kings-cross

```yaml
name: WeWork King's Cross
area: King's Cross
address: 9 York Way, London N1C 4AS
lat: 51.5420793
lng: -0.1257425
website: https://www.wework.com/buildings/9-york-way--london
strapline: WeWork at York Way, opposite King's Cross station
access_type: members
cost_type: paid
crowd_tags: [founders, agencies, enterprise]
tags: [coworking, enterprise]
featured: false
description: |
  WeWork's King's Cross site, two minutes from the station and Coal Drops Yard.
```

## space: wework-st-katharine

```yaml
name: WeWork St Katharine Docks
area: Tower Hamlets
address: St Katharine Docks, London E1W
lat: 51.5065406
lng: -0.0716502
website: https://www.wework.com
strapline: WeWork on the marina at St Katharine Docks
access_type: members
cost_type: paid
crowd_tags: [founders, agencies, enterprise]
tags: [coworking, enterprise]
featured: false
description: |
  WeWork facing the historic St Katharine Docks marina, near Tower Bridge.
```

## space: general-people

```yaml
name: General People
area: Walworth
address: Walworth Town Hall, 268 Walworth Road, London SE17 6TG
lat: 51.4910352
lng: -0.0967806
website: https://generalpeople.com/
strapline: Light industrial + coworking in landmark London buildings
access_type: members
cost_type: paid
crowd_tags: [makers, founders, creatives]
tags: [coworking, studio, warehouse]
featured: true
description: |
  Operates six London sites, mostly in restored landmark buildings —
  Walworth and Hornsey Town Halls, Stratford Workshops, Florentia
  Village, Expressway, TypeSqB.
```

---

# ##boring coworkings

## space: arc-club

```yaml
name: ARC Club
area: Camberwell
address: Camberwell Green, London SE5
lat: 51.4715812
lng: -0.0889999
website: https://www.arc-club.com/
strapline: Neighbourhood coworking inside London residential developments
access_type: members
cost_type: paid
crowd_tags: [remote-workers, freelancers]
tags: [coworking, enterprise]
featured: false
description: |
  Four London neighbourhood coworking sites — Harrow, Homerton, Camberwell
  Green, Earlsfield. Built into residential developments. Not affiliated
  with ARC West London labs.
```

## space: runway-east

```yaml
name: Runway East
area: Bloomsbury
address: 24-28 Bloomsbury Way, London WC1A 2SN
lat: 51.5179617
lng: -0.1233997
website: https://runwayea.st
strapline: Founders coworking with five London sites
access_type: members
cost_type: paid
crowd_tags: [founders, startups]
tags: [coworking, enterprise]
featured: false
description: |
  Founder-pitched coworking with London sites in Aldgate East, Bloomsbury,
  Borough Market, London Bridge, Shoreditch (plus Bristol, Brighton,
  Birmingham, Bath). Founded 2014.
```

## space: uncommon

```yaml
name: Uncommon
area: Liverpool Street
address: 34-37 Liverpool Street, London EC2M 7PP
lat: 51.5169281
lng: -0.0814839
website: https://uncommon.co.uk/
strapline: Wellbeing-focused coworking chain across central London
access_type: members
cost_type: paid
crowd_tags: [agencies, founders]
tags: [coworking, enterprise]
featured: false
description: |
  Five central London sites — Holborn, Liverpool Street, Borough,
  Highbury & Islington, Fulham. Wellbeing-led design and amenities.
```

## space: workspace-group

```yaml
name: Workspace Group
area: Camden
address: Centro One, 39 Plender Street, London NW1 0DT
lat: 51.5368089
lng: -0.1367079
website: https://www.workspace.co.uk/
strapline: FTSE-listed REIT operating 60 flexible workspaces across London
access_type: members
cost_type: paid
crowd_tags: [founders, agencies, makers]
tags: [coworking, studio, enterprise]
featured: false
description: |
  Public REIT (Workspace Group PLC) running 60 sites across London for
  creators, makers and growing teams up to 200+. Listed address is the corporate HQ.
```

---

# ##labs

## space: arc-west-london

```yaml
name: ARC West London
area: Hammersmith
address: Refinery, Manbre Wharf, Hammersmith, London W6 9RH
lat: 51.4866689
lng: -0.2242783
website: https://www.arcgroup.io/west-london/
strapline: 150k sqft biotech lab campus on the Fulham riverside
access_type: members
cost_type: paid
crowd_tags: [scientists, biotech-founders, researchers]
tags: [lab, coworking]
featured: true
description: |
  Hammersmith life-sciences cluster — Refinery building has wet labs,
  Containment Level 2 facilities, Motherlabs accelerator and Imperial
  College's Leap shared lab. Imperial White City + NHS partners adjacent.
```

---

# ##clubs

## space: hulm-club

```yaml
name: Hulm Club
area: Farringdon
address: Farringdon, London EC1
lat: 51.5194746
lng: -0.1034403
website: https://hulm.club/
strapline: London's first Muslim-friendly coworking + members club
access_type: members
cost_type: membership
crowd_tags: [founders, professionals, muslim-community]
tags: [members-club, coworking]
featured: true
description: |
  Private members club and coworking for Muslim entrepreneurs and
  professionals in Farringdon. Founded by Zubar (Zubs) and Humayra Hanif.
```

## space: curve-club

```yaml
name: Curve Club
area: Hoxton
address: 15 Westland Place, Hoxton, London N1
lat: 51.5282771
lng: -0.0904403
website: https://www.curve.club/
strapline: Members club for entrepreneurs in a 200-year-old fire station
access_type: members
cost_type: membership
crowd_tags: [founders, investors, c-suite]
tags: [members-club]
featured: true
description: |
  Private members club for entrepreneurs and investors in a converted
  Hoxton fire station. Curve Circles peer groups + Founders Club 2.0
  (capped at 250 members).
```

## space: pavilion-club

```yaml
name: Pavilion Club
area: City
address: City of London, EC2
lat: 51.5172627
lng: -0.0833412
website: https://www.pavilion.club/
strapline: Luxury workspace + members facilities, four London sites
access_type: members
cost_type: membership
crowd_tags: [executives, professionals]
tags: [members-club, coworking]
featured: true
description: |
  Founded 2002. Four London locations — City, Knightsbridge, Kensington,
  Fulham (newest, 2024). Rooftop terraces, workspace and member events.
```

## space: the-conduit

```yaml
name: The Conduit
area: Covent Garden
address: 6 Langley Street, London WC2H 9JA
lat: 51.5131982
lng: -0.1251689
website: https://www.theconduit.com/
strapline: Covent Garden members club for changemakers
access_type: members
cost_type: membership
crowd_tags: [impact, climate, social-entrepreneurs]
tags: [members-club, events]
featured: true
description: |
  Four-floor private club with 150+ annual impact events on climate,
  sustainability and entrepreneurship. Restaurants, events, programming.
```

---

# ##london classics

## space: home-house

```yaml
name: Home House
area: Marylebone
address: 20 Portman Square, London W1H 6LW
lat: 51.5162568
lng: -0.1566690
website: https://www.homehouse.co.uk/
strapline: Marylebone's Georgian townhouse members club since 1998
access_type: members
cost_type: membership
crowd_tags: [members-club, social, professionals]
tags: [members-club, iconic]
featured: true
description: |
  Three Georgian townhouses (19, 20, 21 Portman Square) with bars,
  restaurants, gym, courtyard garden, hotel rooms, nightclub.
```

## space: the-ned

```yaml
name: The Ned
area: City
address: 27 Poultry, London EC2R 8AJ
lat: 51.5137266
lng: -0.0900380
website: https://www.thened.com/
strapline: Hotel + members club in Lutyens' old Midland Bank HQ
access_type: members
cost_type: membership
crowd_tags: [members-club, professionals, social]
tags: [members-club, iconic]
featured: true
description: |
  Soho House Group + Sydell. Art-deco-neoclassical Lutyens building next
  to the Bank of England. Ned's Club, 252 hotel rooms, nine restaurants,
  rooftop pool, spa.
```

## space: soho-house

```yaml
name: Soho House
area: Soho
address: 40 Greek Street, London W1D 4SU
lat: 51.5133280
lng: -0.1305273
website: https://www.sohohouse.com
strapline: London's iconic creative members club, Greek Street original
access_type: members
cost_type: membership
crowd_tags: [creatives, media, social]
tags: [members-club, iconic]
featured: true
description: |
  The original 1995 Soho House at 40 Greek Street, plus a dozen+ London
  houses (Shoreditch, Dean Street, White City, 76 Dean Street, etc.)
  and 40+ globally.
```
