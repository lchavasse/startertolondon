# Deep Tech Week post — handover

Written 3 Oct 2026 from a deeptech-ldn session. The ask: **an events post for Deep Tech
Week**, made the way the weekly posts in `docs/posts/` are made.

## The job

Next in the weekly series is `docs/posts/2026-10-04-week.md` (+ `.typefully.json`),
covering **Mon 5 → Sun 11 Oct**, which is Deep Tech Week London in full. So this
week's post is the Deep Tech Week post. Follow the shape, voice and tooling of
`2026-09-27-week.md` and the ones before it: the frontmatter `events:` list, a hook, a
post per day, `img:` lines, and `scripts/post-thread.ts` / `scripts/unicode-style.ts`.
Read the voice notes in `docs/` before drafting, not after.

Open question for Lachlan, not to decide alone: is this the normal weekly thread with
Deep Tech Week as its subject, or a separate dedicated post on top of it? Default to
the weekly thread.

The Redis/Luma scrape (`/events`) will have many of these events but not all. Several
are private on Luma or hosted outside it. The list below is the source of truth for the
week, and the scrape fills in other London events for the same days if wanted.

## Framing

- Deep Tech Week London runs **1–11 Oct** (deep-tech-week.com/london-2026). It's
  London's stop on the Deep Tech Week series. Partners list their events through DTW
  (free to host, each host approves its own attendees).
- The centrepiece is the **Deep Tech London Summit, Thu 8 Oct**, 93 Feet East, 150
  Brick Lane, doors 11:00, talks from 12:00. Programme: deeptech.london/programme.
  This is Lachlan's own event, so the post should lead with the week rather than
  read as an ad for the Summit.
- The two hackathons (EDTH defence, 2–4 Oct, and AI × Science, 3–4 Oct) are underway
  as of writing. They predate the post window, so mention them only as "already
  underway".
- The pillars: defence and resilience, energy, bio, robotics and hardware, space.
- Sign-off points: deeptech.london (the week calendar is there, with all 28 events
  behind "See the whole week") and deep-tech-week.com/london-2026.

## The week (times are London time, checked against each event's own page on 1–3 Oct)

**Mon 5 Oct**
- 08:55 · Resilience Conference, day 1 of 2 (Resilience Media). Startups, security,
  defence. https://resiliencemedia.co/events/resilience-conference-london/
- 18:30 · Deep Tech London: The KO with Singular + Seedcamp (opening-night drinks).
  https://luma.com/1kgam74y
- 19:00 · Who Will Build Deep Tech? Online, with Deep Tech Education, NASA & Airbus.
  https://www.deep-tech-week.com/london-2026/events/who-will-build-deep-tech

**Tue 6 Oct**
- 08:30 · AI Breakfast Club: Deep Tech Edition (Twin Path Ventures). https://luma.com/8syl4va7
- 08:30 · DeepTech Breakfast (Amino Collective, IQC & Kindred). https://luma.com/o3amjlsq
- 09:00 · Resilience Conference, day 2
- 14:30 · Embassy Pitch Series: UK × Belgium (Rare Founders). https://luma.com/nzvrfabb
- 17:00 · Scientist to Founder (ConceptionX). Nearly full. https://luma.com/concep-0s1q
- 17:30 · AI for Biotech Roundtables (London Longevity). https://luma.com/v9m4g8wy
- 17:30 · Fin|Tech|Bio: Sandbox to Scale (Level39). https://luma.com/o0tywffy
- 18:00 · Frontier Founders After Work, rooftop drinks (Lightbringer, Encode Club &
  Deep Tech London). https://luma.com/ersb8btt
- 7percent Ventures' Deep Tech London Dinner. Invite only, **do not link or detail**.

**Wed 7 Oct**
- 18:00 · Physical I/O #2: Robotics. Sold out. https://luma.com/qirhrtvz
- 18:00 · Europe's Industrial Renaissance, with Proxima Fusion & Isembard (Wilbe).
  https://luma.com/deep-4697
- 18:30 · Deep Tech London After Hours (Prosemino). Unlisted on Luma, approval
  required. https://luma.com/geervpjq
- 18:30 · Founders Dinner with Canopy (Critical Mass, robotics & hardtech).
  https://luma.com/ii3rx8rb
- 19:00 · From Lab to Enterprise: trust for biotech AI (DTW). https://luma.com/deep-i9jt
- 19:30 · Colossus Dinner 03 (space). Sold out. https://luma.com/z80aefs4

**Thu 8 Oct — Summit day**
- 08:30 · Women in Applied AI Breakfast (Encode & the Incubator for AI).
  https://luma.com/7h7n5hme
- 09:00 · Fuel Up for the Final Frontier, a pre-Summit breakfast with the UK Space
  Agency (Unlocking Space for Investment). Private on Luma, approval required.
  https://luma.com/m9ag17p4
- 11:00 · **Deep Tech London Summit**, 93 Feet East. https://deeptech.london

**Fri 9 Oct**
- 10:00 · Intercepting at the Speed of Sound (DTW). https://luma.com/deep-6q7n
- 18:00 · Hardware Demo Night @ WilbeLABS. https://luma.com/deep-b5d2
- 18:00 · Bio × Engineering biotech meetup at HQ 50 (H*Quotient). Nearly full.
  https://luma.com/mcvngv46
- 20:30 · The Deep Tech Week Afterparty w/ PLUGGED, Shoreditch (Deep Tech London,
  Modern Legal, Notion). https://luma.com/partaaay

## Deliberately left out

- The Noetic hackathon (6 Oct): its Luma page is a 404, though DTW still lists it.
- Agora's learning-experiences evening and The Business Case for AI: Lachlan cut both
  as off-theme.
- Fri 2 Oct London Healthtech Roundtable and the 1 Oct events: before the window.

## Where this came from

- DTW listing: https://www.deep-tech-week.com/london-2026 (the page's embedded
  SvelteKit data has the full set, more than the rendered "View all 27").
- Lachlan's DTW newsletter draft (Google Doc "DTW Newsletter") had the earlier
  highlight picks and the "Why London?" framing.
- The attendee info blast in Notion ("Info Blast", under Deep Tech Week) carries the
  same highlights list. Keep the post consistent with it.
- deeptech-ldn `components/swiss/content.ts` → `WEEK_SCHEDULE` is the same data the
  site renders.

Re-check sold-out and approval status on the day of posting. It moved during the week
this was written.
