# KB Seed Batch — Unicorn Mafia + 60x.ai at Halkin (2026-04-25)

The Unicorn Mafia community and the 60x.ai office it shares at the Halkin building in Southwark.

**Sources used (snapshot 2026-04-25):**
- User-provided: Unicorn Mafia is invite-only, office at Halkin (1-2 Paris Garden), Charlie Cheesman founded 60x.ai whose office is the same building, Fatema runs the community.
- Luma calendar: `cal-yoMaeA020efY3U1` (extracted from luma.com/mafia)
- 60x.ai site (https://60x.ai): tagline "Building enterprise AI 60x faster", FTSE100 focus, agentic systems for finance/ops workflows. LinkedIn: https://www.linkedin.com/company/60x-ai
- Unicorn Mafia site (https://unicornmafia.ai): "London's elite developer community", invite-only, hackathons + demos + events, 1K+ devs, 500+ wins, 30+ companies.
- Geocode: Paris Garden, Bankside SE1 8DP → 51.5062389, -0.1060650 (Nominatim).

**Run:**
```bash
npm run seed:kb -- docs/kb-seeds/2026-04-25-southwark-halkin.md --dry-run
# then without --dry-run once the diff looks right
```

**Note:** Requires the `company` kind support added to `scripts/seed-kb.ts` and the `company_people` / `company_spaces` join tables (migration `20260425130000_add_company_join_tables.sql`).

---

## space: unicorn-mafia

```yaml
name: Unicorn Mafia
area: Southwark
address: Halkin, 1-2 Paris Garden, London SE1 8DP
lat: 51.5062389
lng: -0.1060650
website: https://unicornmafia.ai
strapline: Halkin office shared by 60x.ai and the Unicorn Mafia community
access_type: invite
cost_type: free
crowd_tags: [founders, developers]
tags: [coworking, events]
featured: true
description: |
  Office at the Halkin building, run out of 60x.ai's space. Home base for the
  Unicorn Mafia invite-only dev community. Drop-ins by invite.
```

---

## community: unicorn-mafia

```yaml
name: Unicorn Mafia
primary_area: Southwark
website: https://unicornmafia.ai
luma_cal_ids: [cal-yoMaeA020efY3U1]
sectors: [ai, founders]
tags: [developers, hackathons, invite-only]
exclusivity: invite
featured: true
strapline: Invite-only dev community — devs helping devs ship
description: |
  Invite-only community of 1K+ London developers and founders. Hackathons, demos,
  and weekly hangs at the Halkin office in Southwark. 30+ companies launched out
  of the network so far.
lives_at: [unicorn-mafia]
led_by: [fatema]
```

---

## person: fatema

```yaml
name: Fatema
role: Lead, Unicorn Mafia
twitter: https://x.com/fatemallk
tags: [community-builder, ai, developers]
featured: true
```

## person: charlie-cheesman

```yaml
name: Charlie Cheesman
role: Founder, 60x.ai
linkedin: https://www.linkedin.com/in/charliecheesman/
tags: [founder, ai]
featured: true
```

---

## company: 60x-ai

```yaml
name: 60x.ai
strapline: Building agentic AI systems for FTSE100 enterprises
sector: ai
london_hq: true
website: https://60x.ai
linkedin: https://www.linkedin.com/company/60x-ai
tags: [ai, enterprise, agentic]
featured: false
description: |
  Enterprise AI consultancy and product team. Builds production agentic systems
  — report generation, PowerPoint, Excel workflows — for FTSE100 clients.
  Office at Halkin, shared with the Unicorn Mafia community.
based_at: [unicorn-mafia]
founded_by: [charlie-cheesman]
```
