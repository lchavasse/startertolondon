# KB Seed Batch — Mixed (2026-04-25, rolling)

Rolling batch — entities added incrementally as the user drops them. Append-only;
re-run after each addition (idempotent on slug).

**Run:**
```bash
npm run seed:kb -- docs/kb-seeds/2026-04-25-mixed-batch.md --dry-run
npm run seed:kb -- docs/kb-seeds/2026-04-25-mixed-batch.md
```

---

## Sources

Per-entity source notes get appended below as research happens. Format:

> **<slug>** — `<entity URL>` (key fact + extracted IDs). Geocode: `<query>` → lat,lng.

- **rare-founders** — Luma `usr-hMqb0XIXoVratXw` (twitter/instagram `rarefounders`, website `https://www.rarefounders.com/`). Recurring events on Luma: weekly Co-Working Fridays at The Ministry, monthly Open Mic Pitching, Lunch & Learn, Pitch Competitions; expanding to Leeds.
- **vasily-alekseenko** — Founder of Rare Founders (per LinkedIn posts and X profile). LinkedIn `https://www.linkedin.com/in/alekseenkovv/`. Runs the @rarefounders X account himself; bio "Hosting crazy startup events in London | Founder | Angel investor | Community builder | LGBTQ+".
- **the-ministry** — `https://www.theministry.com` (confirmed). Address 79-81 Borough Road, London SE1 1DN. Geocode: `The Ministry coworking Borough Road Southwark London` → 51.4989914, -0.0983703 (Nominatim). Tagline (theirs): "Converted Victorian printworks in Borough, South London. 50,000 sq ft of workspace meets members club." Access: hot desks, day passes, fixed desks, private offices, club membership.
- **co-working-fridays** — Confirmed weekly recurring on Luma (events e.g. 2026-04-24, 2026-05-01). £5 per session per user. Hosted at The Ministry, organised by Rare Founders.
- **opus-house** — Borough location of the OPUS community (per user-shared Google Maps pin: https://maps.app.goo.gl/RSV9VCmJXix9xzu87). Coords 51.504694, -0.0950768. Address 55 Southwark Street, Borough, SE1 9EU (reverse-geocode via Nominatim). The OPUS community itself was founded 2020 by Sam Tidswell-Norrish (Motive Partners), originally named 20:40, members application + £99/mo (Sifted, Crunchbase). User said: skip the founder/lead, skip the Holborn HQ — Borough only.
- **the-jellicoe** — Fora King's Cross workspace at 5 Beaconsfield Street, N1C 4EW (foraspace.com/london-workspaces/the-jellicoe). 12 floors / 170k sqft, near Coal Drops Yard. Geocode: `5 Beaconsfield Street King's Cross London N1C 4EW` → 51.5385724, -0.1239090 (Nominatim landed on the street; postcode boundaries fuzz one block).
- **ignite-london** — Already in DB (legacy seed) at slug `ignite-london` with sectors=[ai, deeptech], size_band=medium, location_type=irl. Site tagline (https://ignite-london.co): "A founder-led AI & deep tech community". User confirms application-only, no Luma URL.
- **ofer** — Already in DB (legacy seed) at slug `ofer`, name "Ofer", role "Ignite London", linkedin null. Enriching with surname (Shayo) and LinkedIn https://www.linkedin.com/in/ofershayo/. Keeping the `ofer` slug — slugs are stable IDs, no duplicate.
- **blue-garage** — `https://www.bluegarage.org/`. Address 30 Engate Street, Lewisham SE13 7HA. Geocode: `30 Engate Street Lewisham London SE13 7HA` → 51.4595035, -0.0130435 (Nominatim returned the building "Blue Garage" exactly). Tagline (theirs): "South London's Makerspace & Creative Coworking Hub". Instagram `bluegarageorg`. Wood + metal workshops, hot desks, day passes, memberships. Founded by Michael Korn (Cambridge IfM alum, previously founded KwickScreen).
- **michael-korn** — Founder of Blue Garage. LinkedIn https://uk.linkedin.com/in/michaelkorn. Earlier founded KwickScreen.

---

## space: the-ministry

```yaml
name: The Ministry
area: Borough
address: 79-81 Borough Road, London SE1 1DN
lat: 51.4989914
lng: -0.0983703
website: https://www.theministry.com
strapline: Members club + coworking in the old Ministry of Sound building
access_type: members
cost_type: paid
crowd_tags: [founders, creatives, agencies]
tags: [coworking, events, members-club]
featured: true
description: |
  Converted Victorian printworks in Borough, 50k sq ft. Hot desks, day passes,
  private offices, members' club. Home of Rare Founders' Co-Working Fridays.
```

---

## community: rare-founders

```yaml
name: Rare Founders
primary_area: Borough
website: https://www.rarefounders.com/
luma_user_ids: [usr-hMqb0XIXoVratXw]
sectors: [founders, generalist]
tags: [pitching, networking, coworking, demo-day]
exclusivity: open
featured: true
strapline: London's loudest, sassiest startup community
description: |
  Pitch nights, networking, demo days, weekly Friday coworking at The Ministry.
  Run by Vasily Alekseenko. Open via Luma — newcomers welcome.
lives_at: [the-ministry]
led_by: [vasily-alekseenko]
```

---

## person: vasily-alekseenko

```yaml
name: Vasily Alekseenko
role: Founder, Rare Founders
linkedin: https://www.linkedin.com/in/alekseenkovv/
tags: [founder, community-builder, angel-investor]
featured: true
bio: |
  Runs Rare Founders, the London startup pitch + networking community. Also angel
  investor. Hosts under the @rarefounders X handle.
```

---

## event_series: co-working-fridays

```yaml
name: Co-Working Fridays
frequency: weekly
format: coworking
free_or_paid: paid
typical_size: 30
tags: [founders, coworking, friday]
strapline: £5 Friday coworking with the Rare Founders crew
description: |
  Weekly £5 drop-in for founders, every Friday at The Ministry. RSVP via the
  Rare Founders Luma.
hosted_at: [the-ministry]
hosted_by: [vasily-alekseenko]
under: [rare-founders]
```

---

## space: opus-house

```yaml
name: OPUS House
area: Borough
address: 55 Southwark Street, Borough, London SE1 9EU
lat: 51.504694
lng: -0.0950768
website: https://www.joinopus.org/
strapline: OPUS's Borough club for vetted founders and operators
access_type: members
cost_type: paid
crowd_tags: [founders, operators, entrepreneurs]
tags: [coworking, members-club, events]
featured: true
description: |
  Borough wing of the OPUS founders club. Members-only, application-vetted.
  Less techie than London's other founder spaces — operators and execs across sectors.
```

---

## community: opus

```yaml
name: OPUS
primary_area: Borough
website: https://www.joinopus.org/
sectors: [founders, generalist]
tags: [members-club, application-only, networking, operators]
exclusivity: application
featured: true
strapline: Application-only founders club for operators and entrepreneurs
description: |
  Vetted members club for founders and senior operators across sectors. £99/mo,
  application + interview to join. Borough HQ at OPUS House.
lives_at: [opus-house]
```

---

## space: the-jellicoe

```yaml
name: The Jellicoe
area: King's Cross
address: 5 Beaconsfield Street, King's Cross, London N1C 4EW
lat: 51.5385724
lng: -0.1239090
website: https://www.foraspace.com/london-workspaces/the-jellicoe
strapline: Fora's flagship King's Cross workspace, 12 floors of it
access_type: members
cost_type: paid
crowd_tags: [founders, operators, creatives]
tags: [coworking, events, members-club]
featured: true
description: |
  Fora's biggest King's Cross site, near Coal Drops Yard. Coworking, private
  offices, members club. Home of Ignite London's events.
```

---

## community: ignite-london

```yaml
name: Ignite London
primary_area: King's Cross
website: https://ignite-london.co
sectors: [ai, deeptech]
tags: [founders, ai, deeptech, events]
exclusivity: application
featured: true
strapline: Founder-led AI & deep tech community
description: |
  Application-only community for AI and deep tech founders. Hosts events at
  The Jellicoe in King's Cross.
lives_at: [the-jellicoe]
led_by: [ofer]
```

---

## person: ofer

```yaml
name: Ofer Shayo
role: Founder, Ignite London
linkedin: https://www.linkedin.com/in/ofershayo/
tags: [ai, deeptech, founder, community-builder]
featured: true
```

---

## space: blue-garage

```yaml
name: Blue Garage
area: Lewisham
address: 30 Engate Street, Lewisham, London SE13 7HA
lat: 51.4595035
lng: -0.0130435
website: https://www.bluegarage.org/
strapline: South London's makerspace and creative coworking hub
access_type: mixed
cost_type: variable
crowd_tags: [makers, designers, creatives, founders]
tags: [coworking, makerspace, lab, events, workshops]
featured: true
description: |
  Lewisham makerspace with wood and metal workshops, hot desks, day passes,
  and private offices. Hosts maker, green-tech and creative events.
```

---

## person: michael-korn

```yaml
name: Michael Korn
role: Founder, Blue Garage
linkedin: https://uk.linkedin.com/in/michaelkorn
tags: [founder, makerspace, community-builder]
featured: true
bio: |
  Founded Blue Garage in Lewisham. Previously founded KwickScreen.
  Cambridge IfM alum.
```
