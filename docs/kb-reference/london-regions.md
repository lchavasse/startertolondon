# London Regions — Canonical Taxonomy

The official list of `area` values for KB entities. Use the `display_name` exactly when populating `spaces.area`, `communities.primary_area`, etc.

**Use the `aliases` array to normalize**: if a user says "Hoxton", store `area: Shoreditch`. If they say "Aldgate", store `area: Liverpool Street`. If a label isn't in this file at all, ask before inventing one.

**Format**: same `## region: <slug>` + fenced YAML pattern as `docs/kb-seeds/`. When a `regions` table is added to the schema, this file becomes runnable seed data — just add `region` to `Kind`/`TABLE_NAME` in `scripts/seed-kb.ts`.

**Source**: regions marked `source: user` came from Lachlan's seed list (April 2026). `source: added` are filled in by Claude — review and prune.

**Deliberately omitted** (per user, too small / insignificant for tech tagging):
- Bank — collapse into Liverpool Street if needed, otherwise omit
- Oxford Street — omit
- Hoxton — alias of Shoreditch
- Old Street — alias of Shoreditch
- Aldgate ("Old Gate") — alias of Liverpool Street

---

## region: shoreditch

```yaml
display_name: Shoreditch
aliases: [hoxton, old-street, old-st]
compass: east
primary_uses: [startups, ai, events, residential, fun]
vibe: Startups, AI companies, lots of events, cool place to hang out.
notable_orgs: [Monzo, Depop, Deliveroo, GoCardless, Revolut, Wise, Granola]
source: user
```

## region: soho

```yaml
display_name: Soho
aliases: []
compass: central
primary_uses: [vcs, residential, fun]
vibe: VCs, posher people, fancy restaurants.
notable_orgs: [Improbable]
source: user
```

## region: mayfair

```yaml
display_name: Mayfair
aliases: []
compass: central
primary_uses: [vcs, historical, residential]
vibe: VCs, posher people, fancy restaurants.
notable_orgs: [Balderton Capital, Tessian]
source: user
```

## region: kings-cross

```yaml
display_name: King's Cross
aliases: [kings-cross, king-cross]
compass: north-central
primary_uses: [big-tech, ai, life-sciences, government, travel-hub]
vibe: Big tech, AI companies, life sciences, government.
notable_orgs: [DeepMind, Google, Meta]
source: user
```

## region: westminster

```yaml
display_name: Westminster
aliases: [whitehall]
compass: central
primary_uses: [government, policy, historical, corporate]
vibe: Whitehall and policy people.
notable_orgs: [Citymapper]
source: user
```

## region: south-kensington

```yaml
display_name: South Kensington
aliases: [imperial]
compass: west
primary_uses: [science, life-sciences, university]
vibe: Imperial College main campus — science, deeptech, research.
notable_orgs: [Imperial College London]
source: user
```

## region: white-city

```yaml
display_name: White City
aliases: []
compass: west
primary_uses: [science, life-sciences, university, media]
vibe: Imperial White City science campus + BBC heritage. Newer innovation district.
notable_orgs: [Imperial White City Innovation District, BBC]
source: user
```

## region: stratford

```yaml
display_name: Stratford
aliases: []
compass: east
primary_uses: [art, residential, travel-hub]
vibe: East, more artsy. Olympic park redevelopment.
notable_orgs: []
source: user
```

## region: hackney-wick

```yaml
display_name: Hackney Wick
aliases: []
compass: east
primary_uses: [art, residential, fun]
vibe: Super trendy, lots of space and green, lots of art.
notable_orgs: []
source: user
```

## region: dalston

```yaml
display_name: Dalston
aliases: []
compass: east
primary_uses: [startups, indie-hackers, residential, fun]
vibe: East tech corridor, indie hacker hangouts, music scene.
notable_orgs: [Ramen Club]
source: added
```

## region: liverpool-street

```yaml
display_name: Liverpool Street
aliases: [aldgate, old-gate]
compass: east-central
primary_uses: [corporate, fintech, travel-hub]
vibe: Corporate edge of the City, big banks, transport hub.
notable_orgs: [Wise, Funding Circle]
source: user
```

## region: farringdon

```yaml
display_name: Farringdon
aliases: []
compass: central
primary_uses: [fintech, corporate, residential, startups]
vibe: Fintech corridor, mixed corporate and startup.
notable_orgs: [Onfido, Thought Machine]
source: user
```

## region: fitzrovia

```yaml
display_name: Fitzrovia
aliases: []
compass: central
primary_uses: [biotech, ai, residential]
vibe: Quietly central, biotech and AI presence.
notable_orgs: [BenevolentAI, Snyk]
source: user
```

## region: covent-garden

```yaml
display_name: Covent Garden
aliases: []
compass: central
primary_uses: [consumer, fashion, fun]
vibe: Consumer-facing tech, fashion, fun.
notable_orgs: [Farfetch, Lyst, Deliveroo]
source: user
```

## region: camden

```yaml
display_name: Camden
aliases: []
compass: north-central
primary_uses: [residential, music]
vibe: Residential, music heritage, some startups.
notable_orgs: [Tractable]
source: user
```

## region: victoria

```yaml
display_name: Victoria
aliases: []
compass: central
primary_uses: [corporate, residential, travel-hub]
vibe: Corporate, transit hub.
notable_orgs: [Uber, Checkout.com]
source: user
```

## region: whitechapel

```yaml
display_name: Whitechapel
aliases: []
compass: east
primary_uses: [residential, life-sciences]
vibe: Residential, edge of east, some life-sciences via Royal London.
notable_orgs: []
source: user
```

## region: canary-wharf

```yaml
display_name: Canary Wharf
aliases: []
compass: east-docklands
primary_uses: [corporate, finance, residential]
vibe: Corporate finance, residential towers.
notable_orgs: [Revolut, Starling Bank]
source: user
```

## region: southbank

```yaml
display_name: Southbank
aliases: []
compass: south-central
primary_uses: [culture, fun]
vibe: Culture, riverside, events.
notable_orgs: []
source: user
```

## region: london-bridge

```yaml
display_name: London Bridge
aliases: []
compass: south-central
primary_uses: [healthtech, corporate, historical]
vibe: Health tech, corporate, transport hub.
notable_orgs: [Babylon Health, Zego]
source: user
```

## region: brixton

```yaml
display_name: Brixton
aliases: []
compass: south
primary_uses: [creative, music, art]
vibe: South, creative, music scene, up-and-coming.
notable_orgs: []
source: added
```

## region: peckham

```yaml
display_name: Peckham
aliases: []
compass: south
primary_uses: [creative, art, residential]
vibe: South, creative, art galleries, up-and-coming.
notable_orgs: []
source: added
```

## region: battersea

```yaml
display_name: Battersea
aliases: []
compass: south-west
primary_uses: [big-tech, residential]
vibe: Apple's London HQ at Battersea Power Station — newer US-tech cluster.
notable_orgs: [Apple]
source: added
```
