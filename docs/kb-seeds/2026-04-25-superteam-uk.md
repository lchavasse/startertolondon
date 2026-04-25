# KB Seed Batch — Superteam UK + Somerset House (2026-04-25)

Solana's UK chapter, the venue they cowork from, the lead, and the recurring Friday session.

**Sources used (snapshot 2026-04-25):**
- Luma user profile: https://luma.com/user/SuperteamUK (api_id `usr-QGytgR4teGNHdKK`, twitter `superteamuk`, instagram `superteamuk`, website `https://uk.superteam.fun`)
- Sample Luma event: https://luma.com/london-apr-24 (`Co-Hack Fridays : London Chapter`, sublocality "Somerset House", coords 51.51, -0.1175, Fri 9am–7pm Europe/London)
- LinkedIn co page: https://uk.linkedin.com/company/superteamuk (about copy, "Growing the Solana Ecosystem in UK")
- Lead identified via Solana Compass podcast ep. 38 + Stephen's LinkedIn (https://uk.linkedin.com/in/stephen-newnham)

**Run:**
```bash
npm run seed:kb -- docs/kb-seeds/2026-04-25-superteam-uk.md --dry-run
# then without --dry-run once the diff looks right
```

---

## space: the-exchange-somerset-house

```yaml
name: The Exchange at Somerset House
area: Strand
address: The Exchange, Somerset House, Strand, London WC2R 1LA
lat: 51.5111
lng: -0.1175
website: https://www.somersethouse.org.uk
strapline: Somerset House's open workspace for creative and tech crews
access_type: mixed
cost_type: variable
crowd_tags: [creatives, makers, web3, developers]
tags: [coworking, events]
featured: false
description: |
  Drop-in workspace inside Somerset House. Hosts Superteam UK's free Co-Hack Fridays
  every week and a rotating cast of community sessions through the year.
```

---

## community: superteam-uk

```yaml
name: Superteam UK
primary_area: Strand
website: https://uk.superteam.fun
luma_user_ids: [usr-QGytgR4teGNHdKK]
sectors: [web3, solana]
tags: [solana, web3, hackathons, developers, coworking]
exclusivity: open
featured: true
strapline: Solana's UK chapter — hackathons, builders, Friday coworking at Somerset House
description: |
  UK arm of Solana's Superteam co-op. Runs hackathons, builder dinners, and free Friday
  coworking at Somerset House. Active since June 2023. Twitter @superteamuk.
lives_at: [the-exchange-somerset-house]
led_by: [stephen-newnham]
```

---

## person: stephen-newnham

```yaml
name: Stephen Newnham
role: Lead, Superteam UK
linkedin: https://uk.linkedin.com/in/stephen-newnham
tags: [community-builder, web3, solana]
featured: true
bio: |
  Goes by "Cap". UK lead for Solana's Superteam since launch in June 2023.
  Easiest to reach via the @superteamuk X account.
```

---

## event_series: co-hack-fridays-london

```yaml
name: Co-Hack Fridays (London)
frequency: weekly
format: coworking
free_or_paid: free
typical_size: 25
tags: [solana, web3, coworking, friday]
strapline: Free Solana coworking every Friday at Somerset House
description: |
  Open weekly coworking for Solana builders, organised by Superteam UK. Drop in,
  ship something, meet the crew. RSVP via the Superteam UK Luma.
hosted_at: [the-exchange-somerset-house]
hosted_by: [stephen-newnham]
under: [superteam-uk]
```
