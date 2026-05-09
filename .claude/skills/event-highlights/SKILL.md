---
name: event-highlights
description: Draft Lachlan's weekly London tech events post (X thread + LinkedIn) from the curated guide. Use when the user says "draft this week's highlights", "write the X thread", "write a LinkedIn post for this week", "highlight events X/Y/Z", or anything about the weekly events content. Pulls events from Redis, fetches host handles from Luma + KB, and drafts copy in Lachlan's voice — user reviews before posting.
---

# Event highlights skill

Lachlan posts a weekly events round-up in two formats: an **X thread** (one post per day, mentions @handles) and a **LinkedIn post** (single post, bulleted, named tags). This skill streamlines the drafting. The data fetch is a script; the voice work is yours.

## You own these decisions

- **Pick the events** if the user is in auto mode, or **find them** from a directed list
- **Match the voice** by reading `docs/post-archive/` before drafting
- **Flag KB overlap** — if the script returns `kbHints` or hosts with `kbMatch`, surface them so Lachlan knows the entity is in the database
- **Stop and ask** if a directed name doesn't match any event, or if a day's narrative needs Lachlan's input ("you're plugging your own salon — want me to draft the line?")

## Voice rules — read `docs/post-archive/` first

Don't draft from memory. Open at least the two most recent posts per platform before writing. Patterns to preserve:

- **Lowercase, casual.** "it's sunny sunday", "go hang", "head to". No corporate gloss.
- **Bold day labels** in X threads: `**Tue 5**`, `**Wed 6**`. Bold opening hooks: `**May the fourth** be with you.`
- **Punchy verbs:** head to, swing by, hang with, pulling out the stops, in the mood for, looking for a seat on a rocket ship.
- **Multiple events per day** as mini-narrative, not bullets. LinkedIn version uses bullets.
- **Personal asides** when relevant ("would it be disingenuous to plug my own salon..?"). Lachlan often appears in his own posts.
- **Heavy `!!!`**, occasional 🔥 / 🦄 / 👀 / 👋.
- **Bare lu.ma links** on X (no markdown, no shorteners).
- **@handles inline** on X. **Bold names + LinkedIn person tags** on LinkedIn — for LinkedIn, use the person's full name in bold; the handles in `linkedin` field of `kbMatch` hosts give you the actual profile slug.
- **Always** opens with weather/vibe + "all the links are on londoncalling [dot] guide".
- "First birthday" / "rocket ship" / "incredible!!!" are recurring phrases — riff, don't repeat verbatim.
- **Brand obfuscation (LinkedIn variant):** sometimes signs off with `london [cough] calling [cough cough] [dot] guide` instead of the straight form. Playful — use when the post leans wry.
- **LinkedIn lists may be numbered (1. 2. 3.) — not just bullets.** Numbered lists carry short themed picks ("bio-focused events: 1. … 2. … 3. …"); bullets carry mixed-genre weeks.
- **Theme-stitching one-liners** bridge category jumps mid-post: "and if your biotech is hardware, head down to..." or "but if you have a creative itch to scratch." Use these to pivot, not bullets.
- **Names + `:o`** as an alternative to `@handles` on LinkedIn: `(Zayd :o)`. Surprise/anticipation flavour, distinct from `!!!`.
- **Self-deprecating personal asides** scale by platform: "I may be spotted mixing up some concoctions" (X, dialled up) → "experimental bartending" (LinkedIn, compressed).
- **Three-word minimalist openers** are valid alongside vibe statements: "atoms are in." vs "another big week ahead" — pick whichever the week earns.

## The 4-step loop

### 1. Clarify the request

If the user says "draft this week's highlights", confirm the date range (default: today → +7 days, Sun→Sat).
If they list events ("highlight encode demos, granola airwallex, project europe birthday"), parse those into match terms — short, distinctive substrings.
If they only specify one platform, ask whether they want both or just one.

### 2. Run the data script

```bash
# Auto mode (top 12 picks ranked by curated):
npm run highlights -- --from 2026-05-04 --to 2026-05-11

# Directed mode (user supplied names — script fuzzy-matches):
npm run highlights -- --from 2026-05-04 --to 2026-05-11 \
  --match "encode demos, granola airwallex, project europe"

# Curated only, skip Luma host fetches (faster sanity check):
npm run highlights -- --curated-only --no-handles
```

The script prints JSON to stdout: `{ from, to, mode, count, highlights[] }`. Each highlight has `event`, `hosts[]` (with `twitter` / `linkedin` / `kbMatch` populated when found), `kbHints[]` (organiser matches in `communities`/`vcs`/`companies`), and `weekday` (e.g. `"Tue 5"`).

If the script logs `no match for: "<term>"`, surface it to the user and ask for a clearer name.

### 3. Draft

Read `docs/post-archive/*.md` (at least the two most recent per platform). Then draft to:

```
docs/posts/YYYY-MM-DD-week.md
```

…where the date is the first day of the week being highlighted. One file per week. Structure:

```markdown
---
week_of: 2026-05-04
events: [event-id-1, event-id-2, ...]
---

# X thread

(post 1 — opener with vibe + londoncalling link)

---

(post 2 — **Mon 4** ...)

---

(post 3 — **Tue 5** ...)

...

# LinkedIn

(single post body, bulleted, **bold names**, sign-off)

# Notes

- KB matches: ...
- Missing handles: ...
- Suggested hooks I didn't use: ...
```

Use `---` as the X post separator (it's the standard Typefully thread delimiter — paste-ready).

For each event, prefer in this order: KB-matched twitter handle → Luma-extracted handle → just the host name (no @). For LinkedIn, prefer KB linkedin → bold name only.

### 4. Surface KB and gaps

After drafting, list at the bottom of the file:
- Hosts with no handle anywhere (Lachlan may know them personally)
- KB hints that look interesting but you didn't use (e.g. organiser is a known VC)
- Hooks/themes you noticed but didn't fit (week's accidental theme — "first birthdays", "demos week", etc.)

Then tell the user the file is drafted and ask if they want edits before they paste.

## When to stop and ask

- A directed name has 0 matches → ask for clarification, don't guess
- A day has 4+ candidate events → ask which to feature (don't shotgun)
- Lachlan's own event is in the pool → ask how he wants to plug it (the salon line in 2026-05-03 was personal)
- The KB shows a host has both `twitter` and `linkedin` but they conflict (different identities) → flag it

## Don'ts

- Don't post anywhere. Drafts only — Lachlan pastes manually.
- Don't fabricate handles. If the script didn't return one, leave the bold name and note it in the gaps section.
- Don't generate emojis the archive doesn't use. The vocabulary is small: `!!!` `🔥` `🦄` `👀` `👋`.
- Don't markdown-wrap lu.ma links on X.
- Don't summarise the events factually — that's not the voice. Always pick a hook.

## Future (not v1)

- Typefully API for scheduled posting
- Image collage from `coverUrl`
- "Already-highlighted" tracking by reading `docs/posts/*.md` event-id lists, so the auto picker excludes repeats
- Better ranker that uses `people.featured` + attendee count signals
