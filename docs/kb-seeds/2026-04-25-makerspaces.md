# KB Seed Batch — London Makerspaces (2026-04-25)

10 London makerspaces from the Londonaire list (skipping Reading rLab — out of London),
plus 3 enrichments to existing spaces (Makerversity, Cockpit Arts, Blackhorse Workshop)
that are also makerspaces but weren't tagged as such.

**Schema decision (per user 2026-04-25):** `makerspace` is added as a canonical tag value
on `spaces.tags`. No new schema column. Spaces that also offer coworking get both tags.

**Sources:**
- Source list: https://londonaire.co.uk/makerspaces-in-london-an-up-to-date-list-with-pricing/
- Per-entity: see `Sources used` block per entry below.

**Run:**
```bash
npm run seed:kb -- docs/kb-seeds/2026-04-25-makerspaces.md --dry-run
npm run seed:kb -- docs/kb-seeds/2026-04-25-makerspaces.md
```

**Note:** Only `slug` + the fields included in each YAML are sent to upsert. Existing
columns not listed are preserved (Postgres `ON CONFLICT DO UPDATE` only touches the
columns in the SET clause). Three backfill entries near the end use this to add the
`makerspace` tag without disturbing other fields.

---

## space: hackney-depot

```yaml
# Formerly Batch.Space; rebranded to Hackney Depot.
# Source: https://www.hackneydepot.com (tagline + facilities), batch.space → 301 → hackneydepot.com.
name: Hackney Depot
area: Hackney
address: 5 Sheep Lane, Hackney, London E8 4QS
lat: 51.5360556
lng: -0.0591324
website: https://www.hackneydepot.com
strapline: East London making, meeting and collaboration HQ
access_type: members
cost_type: membership
crowd_tags: [designers, makers, creatives]
tags: [makerspace, coworking, studio, events]
featured: false
description: |
  Members workspace and woodworking shop in Hackney, formerly Batch.Space.
  Studios, coworking, fabrication and event hire under one roof.
```

## space: create-space-london

```yaml
# Source: https://www.createspacelondon.org
name: Create Space London
area: Mill Hill
address: 80 Daws Lane, Mill Hill, London NW7 4SL
lat: 51.6155951
lng: -0.2397442
website: https://www.createspacelondon.org
strapline: Affordable creative workshops in Mill Hill
access_type: members
cost_type: membership
crowd_tags: [makers, designers, creatives]
tags: [makerspace, coworking, studio]
featured: false
description: |
  Affordable wood, metal, fashion, electronics and CAD/CAM workshops in
  north-west London. Memberships from £85/month.
```

## space: hone-london

```yaml
# Source: https://hone.london — has separate jewellery, furniture and general makerspace tracks.
name: Hone London
area: Limehouse
address: 16 Pixley Street, Limehouse, London E14 7DF
lat: 51.5145306
lng: -0.0291395
website: https://hone.london
strapline: Jewellery, furniture and digital fab in Limehouse
access_type: members
cost_type: membership
crowd_tags: [makers, designers, jewellers, woodworkers]
tags: [makerspace, coworking, studio]
featured: false
description: |
  Canal-side warehouse with separate jewellery, furniture and digital
  fabrication memberships. Studio offices and coworking desks too.
```

## space: limehouse-labs

```yaml
# Source: https://www.limehouselabs.org — small, volunteer-run hackspace inside Limehouse Town Hall.
name: Limehouse Labs
area: Limehouse
address: Limehouse Town Hall, 646 Commercial Road, London E14 7HA
lat: 51.5121404
lng: -0.0314014
website: https://www.limehouselabs.org
strapline: Small, friendly hackspace in Limehouse Town Hall
access_type: members
cost_type: membership
crowd_tags: [makers, hackers, hobbyists]
tags: [makerspace, hackspace]
featured: false
description: |
  Volunteer-run hackspace inside Limehouse Town Hall. Laser cutter, 3D printers,
  prototyping bench. Members only, £30/month.
```

## space: london-hackspace

```yaml
# Source: https://london.hackspace.org.uk — 24/7 members, Wed open evenings for prospective members.
name: London Hackspace
area: Park Royal
address: 41-43 Standard Road, Park Royal, London NW10 6HF
lat: 51.5277983
lng: -0.2642631
website: https://london.hackspace.org.uk
strapline: London's non-profit hackerspace, members 24/7
access_type: members
cost_type: membership
crowd_tags: [hackers, makers, electronics, biohackers]
tags: [makerspace, hackspace]
featured: false
description: |
  Long-running non-profit hackerspace. Electronics, brewing, biohacking,
  lockpicking. £15/month. Open evenings every Wednesday at 7pm.
```

## space: pow-workshops

```yaml
# Source: https://powworkshops.com — same building as London Hackspace but separate org.
# Pay-per-use after induction (not subscription), so cost_type=paid not membership.
name: POW (Park Royal Open Workshop)
area: Park Royal
address: 41 Standard Road, Park Royal, London NW10 6HF
lat: 51.5277983
lng: -0.2642631
website: https://powworkshops.com
strapline: Open-access maker workshops in Park Royal Design District
access_type: open
cost_type: paid
crowd_tags: [makers, designers, woodworkers]
tags: [makerspace, workshops]
featured: false
description: |
  6,000 sq ft non-profit workshop. Wood, metal, CNC, laser, spray room.
  No membership — pay-per-hour or per-day after a one-off induction.
```

## space: richmond-makerlabs

```yaml
# Source: https://www.richmondmakerlabs.uk — free community workshop, donations welcome.
name: Richmond MakerLabs
area: Richmond
address: Little House, Ham Close, Ham, Richmond TW10 7NU
lat: 51.4374735
lng: -0.3170468
website: https://www.richmondmakerlabs.uk
strapline: Free community workshop in Ham, Richmond
access_type: open
cost_type: free
crowd_tags: [makers, hackers, families, hobbyists]
tags: [makerspace]
featured: false
description: |
  Free volunteer-run community workshop. Electronics, laser, 3D printing,
  CNC router, lathe, woodshop. Suggested £1 donation per visit.
```

## space: south-london-makerspace

```yaml
# Source: https://southlondonmakerspace.org — non-profit volunteer workshop in a railway arch.
name: South London Makerspace
area: Herne Hill
address: Arch 1129, 41 Norwood Road, London SE24 9AJ
lat: 51.4514337
lng: -0.1005431
website: https://southlondonmakerspace.org
strapline: Volunteer-run workshop in a Herne Hill arch
access_type: members
cost_type: membership
crowd_tags: [makers, hackers, electronics, woodworkers]
tags: [makerspace, hackspace]
featured: false
description: |
  Non-profit social workshop in a railway arch. Wood, CNC, electronics,
  metal, textiles, laser, screen print, 3D, ceramics. £25/month.
```

## space: the-remakery

```yaml
# Source: https://www.remakery.org — repair/reuse focus, has coworking too.
# Geocode used postcode SE5 9HY (51.4689, -0.0988) — Nominatim wouldn't resolve the full address.
name: The Remakery
area: Camberwell
address: 51 Lilford Road, Camberwell, London SE5 9HY
lat: 51.4689134
lng: -0.0988465
website: https://www.remakery.org
strapline: Camberwell makerspace breathing new life into waste
access_type: members
cost_type: membership
crowd_tags: [makers, designers, repairers, sustainability]
tags: [makerspace, coworking, sustainability, repair]
featured: false
description: |
  Reuse and repair-focused workshop. Textiles, upholstery, woodwork from
  reclaimed materials, surplus-food kitchen. Coworking too. £15–60/month.
```

---

## space: makerversity

```yaml
# Existing row — only enriching tags + adding address/coords (legacy seed had no address).
# Source: https://www.makerversity.org + Londonaire list.
# Geocode landed on Courtauld Institute (same Somerset House building).
name: Makerversity
address: Somerset House, Strand, London WC2R 1LA
lat: 51.5116948
lng: -0.1174420
website: https://www.makerversity.org
tags: [makerspace, coworking, studio, lab]
```

## space: cockpit-arts

```yaml
# Existing row — adding `makerspace` tag (was [studio, lab]).
# Source: existing legacy seed; site https://www.cockpitarts.com.
name: Cockpit Arts
tags: [makerspace, studio, lab]
```

## space: blackhorse-workshop

```yaml
# Existing row — adding `makerspace` tag (was [lab, studio]).
# Source: existing legacy seed; site https://blackhorseworkshop.co.uk.
name: Blackhorse Workshop
tags: [makerspace, lab, studio]
```
