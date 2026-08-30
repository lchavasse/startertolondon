# People Sourcing — beyond Lachlan's contacts

Created 2026-08-04. Goal: 100+ vetted profiles across the DeepTech London event categories
(top founders, early-stage engineering founders, senior engineers, post-docs, recent grads,
policy, VCs), reusable for the Rivan dinner, expo sourcing, and speaker outreach.

## Source inventory (measured, not estimated)

| Source | Volume | New to Lachlan | Has LinkedIn URL | Strong for |
|---|---|---|---|---|
| `~/Downloads/rivan_guest_list.csv` | 107 | **106** | 107/107 | senior engineers, VCs |
| Lachlan's connections | 3,914 | — | yes | founders, senior engineers, VCs |
| `people_also_viewed` (from enrichment) | ~58,000 raw | almost all | yes | **discovery at scale** |
| ↳ filtered to scanner companies | **~1,061** | yes | yes | deeptech ICs, PhDs, founders |
| deeptech-scanner `founder_candidates` | 1,060 | mostly | **109 only** | top founders, eng founders |
| starter-london KB | 24 people, 22 VCs | mixed | partial | VCs, community leads |

### The guest list is a real expansion, and it is skewed

106 of 107 are not in Lachlan's network. But the composition is the inverse of the target table:
**78 engineers, 16 VCs, 3 founders, 0 post-docs, 0 recent grads, 0 policy.** It over-supplies the
two categories the network already covers well and supplies none of the three that are hardest.

### `people_also_viewed` is the discovery engine

Every enriched profile returns ~15 adjacent profiles carrying name, company, location and follower
count. Across 3,914 that is ~58,000 distinct people — but raw it is mostly noise (marketplaces,
travel, consultancies).

Filtering those adjacent profiles by *company name matched against deeptech-scanner* converts it
into exactly the target population. Measured on the first 225 enriched profiles: 61 hits, which
extrapolates to **~1,061 deeptech people not already in the network**, e.g.

```
Irina Grigorescu      @ King's College London   neuromorphic computing
Christos Stavrou      @ Imperial College London computing / academic research
Javad Naghibi, PhD    @ IONATE (London)         power electronics / grid hardware
Yury Alaverdyan       @ Nyobolt (Cambridge)     fast-charge batteries
Nick Thomas           @ Domin (Bristol)         motion control
```

This costs nothing extra to harvest — it rides on the enrichment run already in flight.

## Pipeline

**1. Harvest** into a `candidates` table in staging, one row per LinkedIn slug, with `source`
(guest_list | connection | also_viewed | scanner_founder | kb) and whatever the source carries.
Dedupe on the `/in/<slug>` segment. Never merge on name.

**2. Filter before enriching.** Bright Data bills per record, so triage on free signals first:
company matches a scanner company, or location is London/UK, or the title suggests a target
category. This is what keeps the enrichment bill proportionate — enriching all 58,000 would be
absurd; enriching ~1,000–1,500 filtered candidates is not.

**3. Enrich** the filtered set through `scripts/enrich-connections-brightdata.ts` (already
resumable, already batches, already skips what it has).

**4. Classify** with one cached Haiku pass over `position + company + about`, emitting:
- `role_type` — founder | engineer | researcher | investor | policy | operator | student
- `seniority` — junior | mid | senior | exec
- `fields[]` — energy, compute, manufacturing, biotech, space, materials, robotics, climate
- `category` — mapped to the event table's rows

**5. Rank and shortlist** per event, filtered to London where the event demands it.

## Known gaps

- **Policy** has no source at all. Nothing in the guest list, the scanner, or the network covers it.
  Needs a deliberate list — DSIT, Innovate UK, UKRI, Onward, Tony Blair Institute, Policy Exchange
  — probably hand-built, then enriched.
- **Recent grads / post-docs** are partly solvable from within the network: Bright Data returns
  `education` with start/end years, so end-years of 2024–2026 identify them directly. Beyond that,
  the `also_viewed` filter surfaces university-affiliated people well (KCL, Imperial, Leeds above).
- **`experience` is never returned** by the people dataset. Work history is not available from this
  source at any price. Do not plan around it.
- **`about` is truncated to ~85 characters** and empty on roughly a quarter of profiles. It is a
  weak field-matching signal; `position` + `company` + the scanner's `sector` are stronger.

## Cost notes

- Private profiles still bill and return nothing — roughly 4 in 20 on the first sample, so expect
  ~20% of any run to be paid blanks.
- `scanner_founder` candidates are the most valuable per record (they are named founders of UK
  deeptech companies) but 951 of 1,060 lack a LinkedIn URL, so they need a resolution step before
  they can be enriched at all.

## Status

- Connections enrichment: in flight, 3,914 records, batches of 100.
- Everything else in this document: planned, not built.
