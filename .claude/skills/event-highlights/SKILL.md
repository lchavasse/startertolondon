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
- **Punchy verbs:** head to, swing by, hang with, pulling out the stops, in the mood for, looking for a seat on a rocket ship.
- **Personal asides** when relevant. Lachlan often appears in his own posts. But **don't default to the self-deprecating plug** — "would it be disingenuous to plug my own salon..?" was a one-off; he cut it when it was re-served to him in 07-20. His own events get sold straight, with an invitation and a reason to come: "Come talk tech, culture and the future for our Summer Picnic salon on Wednesday."
- **Heavy `!!!`**, occasional 🔥 / 🦄 / 👀 / 👋.
- **Bare lu.ma links** on X (no markdown, no shorteners).
- **Tag the *humans*, not the org.** This is the single biggest lever and where Lachlan re-does the most work. For each featured event, name 2–3 individual hosts on **X** — not the calendar/org account. (**On LinkedIn he cuts this to one name.** See the LinkedIn section below — the roll-call is the most-deleted thing in the drafts.) The script now resolves each host's **X handle *and* LinkedIn URL straight off Luma** (`hosts[].twitter` / `hosts[].linkedin`, `lumaMatch: true`), so they arrive pre-tagged for both platforms. Orgs are flagged `isOrg: true` — **on LinkedIn** mention them flatly, don't person-tag them. **On X, @-tag the org too** if it has a handle; handle density is the main driver of reply views (see the X section below). e.g. Labs After Dark → Francesco + Subaita (not "Wilbe"); future.bio hack → Jonty, Isabel & Nelli.
- **The Luma `hosts[]` array is the organiser list, not the full speaker lineup.** Panels, pitch nights and multi-speaker meetups often name judges/panelists/guests only in the event description or cover-image graphic, never as a Luma "host". Before finalizing a panel-style event, skim its description (fetch the Luma page if the description wasn't already pulled) and read the cover image you screenshotted for it — sponsor logos and speaker names printed on the graphic (e.g. "supported by AlbionVC & Cooley LLP", a panel photo with named guests) are fair game and often the most tag-worthy detail. Don't stop at whatever the script's `hosts[]` happened to resolve.
- **First-name-only resolutions need a surname check.** Luma frequently returns just a first name ("Sam", "Jamie", "cody"). Lachlan often knows these people personally and has a fuller name than the data does ("Sam" → "Sam Hooti", "Alex Franch" → "Alex Franch Tapia", "Fatema Alkhalifa" → "Fatema Al Khalifa"). Flag first-name-only or possibly-incomplete hosts clearly in Notes rather than presenting them as final — Lachlan will often complete the name in one line, which is much faster than him rewriting your sentence around it.
- **@handles inline** on X (from `hosts[].twitter`). On LinkedIn, person-mentions can't be pushed by the API — you write the bold full name + `:o` flavour in the body (see the Unicode-emphasis rule below for how "bold" actually renders), and the manual @mention is done by hand in LinkedIn's composer using the `# Tagging` worksheet (see step 4b). Per-person emoji is on-voice: `(Jonty, Isabel & Nelli 🧪)`, `(Charlie Ward 😍)`.
- **Trust the resolved socials, add what you know.** Precedence is KB (`kbMatch`) → org registry (`registryMatch`) → Luma (`lumaMatch`) → people registry (`peopleMatch`). All are safe inline. If a host has no handle anywhere, leave the bold name and list it in the gaps.
- **Every X post carries an image or a link. No exceptions, even on thin days or when he says "keep it simple".** 2+ picks on a day → `--select` collage of exactly those picks. One pick → its bare lu.ma link (the Luma card unfurls) or its cover. A text-only day tweet is a miss: he flagged it on 2026-09-27, 2026-10-11 and 2026-10-25, and on 10-25 he had to make the screenshots himself. Links are bare lu.ma (no markdown, no shorteners).
- **Opener (X):** a weather/vibe **question** is the strongest default — "has the heat got to the events scene..?", "is it too hot to network?" — alongside the vibe statement ("easing into july") and the three-word minimalist ("atoms are in."). A big week earns a bolder **value/stakes hook** ("3+ ways you can win 10k cold hard cash this week"). Before drafting, skim the last 3–4 openers in `docs/posts/` so you don't repeat one. Always include "all the links are on londoncalling.guide/events" (real URL on X since 2026-10-25). **LinkedIn openers work differently — see the section below.**
- **LinkedIn sign-off is a free riff — don't default to the same line, and it's optional** (3 of the 5 posts from 08-03 to 09-06 had no london calling line at all). When he keeps it, he rewrites it: "available on all good events lists 👇", "london [cough] calling [cough cough] [dot] guide", "all on london calling [dot] guide 👇". Pick one that fits the week's tone; the literal URL goes in the first comment, never the body.
- "First birthday" / "rocket ship" / "incredible!!!" are recurring phrases — riff, don't repeat verbatim.
- **Brand obfuscation (LinkedIn variant):** sometimes signs off with `london [cough] calling [cough cough] [dot] guide` instead of the straight form. Playful — use when the post leans wry.
- **LinkedIn lists may be numbered (1. 2. 3.) — not just bullets.** Numbered lists carry short themed picks ("bio-focused events: 1. … 2. … 3. …"); bullets carry mixed-genre weeks.
- **One event per bullet on LinkedIn — never comma-fuse.** If a day has four events, that's four bullets (or four numbered lines), not one bullet listing all four separated by commas. A crammed bullet reads as a list dump; separate bullets read as picks. The only exception is a thin day's two title-only events (see the second LinkedIn batch below) — otherwise, if you catch yourself writing "X's event, Y's event, and Z's event" inside one bullet, split it. (A *minor* second event may ride along on a connective — `Venture Café dig into 𝗗𝘂𝗮𝗹 𝗨𝘀𝗲 (Liam Ward) plus Matt Carey is in town for AI Demo Days` — but that's one flowing line, not a comma-fused list.)
- **A one-line theme per day is optional, not default.** Sometimes it fits ("Tue is the day for Physical AI."), sometimes Lachlan prefers a flatter week-at-a-glance — pick ~5–6 (up to 12) favourite events across the whole week, one screenshot, one line each, no day-by-day framing at all. Ask if unsure which shape the week wants rather than defaulting to the day-theme structure.
- **LinkedIn is a curated highlight reel, not a mirror of the X thread.** The X thread can carry the week's full inventory (it has room, and images do a lot of the work); LinkedIn should cut harder — typically the 2–4 strongest events per day (or ~5–6 for the whole week in the flatter format), dropping the minor/duplicate-feeling ones entirely even if they're in the X thread or a screenshot. Favour events with a recognisable name, a good story, or a prestigious co-sponsor over ones that are just "also happening." When in doubt about what to cut, keep what's most tag-worthy (real named people, known VCs/orgs) and cut what's genuinely generic.
- **Oblique cultural references beat literal explainer asides.** Don't write "(and if you need an excuse to leave early — it's the england game tonight ⚽)" — that over-explains. A knowing, understated callback lands better: "*and rumour has it it's coming home...* 🏴" trusts the reader to get it. If a topical aside needs a parenthetical explaining what it is, cut the explanation or cut the aside.
- **Theme-stitching one-liners** bridge category jumps mid-post: "and if your biotech is hardware, head down to..." or "but if you have a creative itch to scratch." Use these to pivot, not bullets.
- **Names + `:o`** as an alternative to `@handles` on LinkedIn: `(Zayd :o)`. Surprise/anticipation flavour, distinct from `!!!`.
- **Self-deprecating personal asides** scale by platform: "I may be spotted mixing up some concoctions" (X, dialled up) → "experimental bartending" (LinkedIn, compressed).
- **Three-word minimalist openers** are valid alongside vibe statements: "atoms are in." vs "another big week ahead" — pick whichever the week earns.

### X: what Lachlan actually changes (measured against published threads)

Six published threads sit in `docs/post-archive/*-x-*.md` (2026-06-22 → 2026-07-27) next to the drafts they came from. View counts are captured per tweet.

**Root views vs. opener:**

| Week | Opener | Root views |
|---|---|---|
| 07-13 | `it's OpenAI Build Week in london 👀` + `what does that actually mean?` | **1.2k** |
| 07-20 | `another big week ahead in the greatest city on earth 👀` | 930 |
| 06-28 | `London never ceases to shine🌤️` | 809 |
| 07-27 | `the crick institute's innovation challenge kicks off the week 🧬` | 469 |
| 07-06 | `The events you don't want to miss in London this week!!!` | 317 |
| 06-22 | `june goes out with a bang 👀` | 296 |

Same finding as LinkedIn, independently: **the "events you don't want to miss" opener came last on both platforms in the same week.** Never open by announcing the post is an events round-up. The winners lead with a **named external happening** (OpenAI Build Week) or a **city line** (greatest city on earth / never ceases to shine) — not with the first event on the list.

**The root tweet is the whole game.** Replies get 5–25% of the root's views (07-27: 469 root → 59–138 per reply). Spend the effort there; the day tweets are for the people who already stopped.

**@handles drive reply views — tag everything with an account, orgs included.** This directly contradicts the "mention orgs flatly" rule above, which is a *LinkedIn* rule. The handle-dense 06-28 thread averaged ~128 views per reply; the handle-sparse 07-27 thread averaged ~81. The single best reply in the corpus (07-13 Wed, **576 views**) carries four well-followed handles. He adds handles I left as plain text: `ramen space` → `@RamenClubHQ`, `venture café` → `@VentureCafeLond`, `rare founders` → `@rarefounders`, `imperial` → `@imperialcollege @Undaunted_HQ @Grantham_IC`, `encode club` → `@encodeclub`, `stripe` → `@stripe`.

**Handles bare, names dropped.** On X he deletes the human-readable name and keeps only the handle: `sam (@99daycoder), adam chan (@itsajchan) and nasima ahmed (@tigertopaz3942) hosting` → `@99DayCoder & @itsajchan`. No parentheses around a handle when it's the subject — `@SammyHep`, `@zqwq333 + rui rui hosting`. Parens survive only for a trailing aside listing two or three co-hosts. Note this is the opposite trade from LinkedIn: there he keeps one *name*, here he keeps two or more *handles*.

**Bullets and numbers inside tweets.** My `elsewhere: X, Y, and Z` run-on sentences get broken into lines:
```
elsewhere:
- novabook's ai pitch night has haatch
- @sotalikesfuture frontiers night digs into the autonomous knowledge economy @matbogus & @jamiec_24
```
Also numbered for a ranked set (`1. … 2. … but you know you'll find me at the hardware hack 🤖  3. …`), and bare short lines separated by blank lines (`@VentureCafeLond go deep on dual use` / `deepgram hosting a fireside` / `and @mattzcarey is in town for…`). Never a comma-spliced list of four events.

**Two-to-four word day intros.** `busy busy` · `got a full day of it 👀` · `a big ol saturday 🔥` · `new month hits strong.` · `robotics and defence share the day 🚀` · `the week's big one — wed is stacked 👀`.

**Don't drop thin days — give them one short line.** I dropped Monday and Friday from the 07-20 draft as not tag-worthy; he added both back (`@celinegrooms hosting a strategy mastermind workshop for founders.`, `close out the week with a one day hack by the tech bros or the 5050 summer party`). A one-line day beats a missing day.

**Own events: "our" + an invitation.** `it's mine tonight — after hours salon's summer picnic 👀` → `come talk tech, culture and the future at our after hours salon's summer picnic 🏞️`. Same shift as LinkedIn. And he inserts himself with a physical detail: `come cowork in the aircon with myself & @99DayCoder`, `but you know you'll find me at the hardware hack 🤖`.

**Luma cards do the work of links.** Most day tweets carry a bare `lu.ma/xxxx` or the auto-unfurled Luma card rather than describing the event at length — the card supplies the title and image, so the copy is free to be a hook.

### X, 2026-10-25 edits (what he changed in Typefully)

- **Every post got an image or link.** Mon, Tue and Sun (single picks) got a full `https://luma.com/<slug>` link; every multi-event day got a collage. He made the small collages himself because the draft had none.
- **Real URL in the opener:** `all the links are on londoncalling.guide/events`, not `[dot] guide`.
- **Opener summary names the biggest draw last** and ends with energy: `... and the UK's largest student run tech summit to close out October!`
- **"with us", not "with me"** for his own events on X too.
- **Every org with an account gets tagged**, including speakers and co-organisers found in the description: `@indiebeers`, `@NovabookLDN x @giant_ventures`, `@EWOR_official`, debate by `@alys_key & @misssaxbys`, Tech Summit `@WMK_15`.
- **Each event credits who's behind it:** `an oxford-style debate at @meetgranola by @alys_key & @misssaxbys`, `AI Field Notes - a chill hang w/ @lukadadiani`.
- **He cut the "elsewhere:" extras on a busy day** (Thu). Highlights only once there's a collage.
- **Day intros get a seasonal or calendar hook:** `a busy day before we get spooky 👻` (Halloween Sat), `big start to november with the...` (Sun), `the craziness continues 🔥`.
- **New closing post: "coming up..."** with 2 to 3 next-week-plus teasers, each a flag/emoji + name + `by @host` + bare link, with a 3-card image (`coming-soon-3up.png`). Out-of-London events are fine here (🇦🇹 RISE). Offer this every week.

### LinkedIn: what Lachlan actually changes (measured against published posts)

`docs/post-archive/2026-06-15` → `2026-09-06` (11 weeks) are the **published** LinkedIn posts sitting next to the drafts they came from in `docs/posts/`. The diff is the highest-signal thing in this skill — it's what he rewrites every single week. Read at least two pairs before drafting.

**Reach data** (three posts, same format, same audience):

| Week | Opener | Impressions | Out-of-network |
|---|---|---|---|
| 07-27 | `Let's go London 🇬🇧` / `Last week of another crazy month!` | **4,519** | **62%** |
| 07-20 | `What? Wait!` / `...` | 3,338 | 57% |
| 07-06 | `The events you don't want to miss in London this week!!!` | 1,633 | 45% |

Out-of-network share tracks impressions almost exactly — the hook decides whether LinkedIn pushes the post past his own network, which is where the growth is. The loser is the one that opens by *announcing that it is an events round-up*. **Never open with the deliverable.**

**Opener architecture — three beats, not one sentence.** Every published post opens short, breaks, then lands the substance. My drafts open with a single dense summary sentence, which buries the hook below the "see more" fold.

1. **Hook line** — 2–5 words, energetic, standalone. `Let's go London 🇬🇧` · `june goes out with a bang.` · `What? Wait!` · `it's OpenAI Build Week in London.` · `London! Don't miss out this week ⬇️`
2. **Beat** — a calendar/context line, a rhetorical self-interview, or literally just `...`. `Last week of another crazy month!` · `what does that mean?` · `Another huge week of events in the best city on earth.`
3. **Substance** — the week summary, own events first.

Anchor the hook in the **calendar or the city**, not the event list ("last week of another crazy month", "june goes out with a bang", "best city on earth"). Rhetorical questions that interrogate the post itself (`what does that mean?`, `What? Wait!`) are a deliberate fold-breaking device — use them, but they scored below the warm place-anchored line.

**One named human per event, not a roll-call.** This is the single biggest cut he makes and it contradicts the X guidance above. Drafted `Kickstart Global and Bright Data back it, Sam, Adam Chan and Nasima Ahmed hosting` → published `by the one and only Sam Hooti`. Drafted `Francisco Terpolilli, Zizou Brahmi and Nodirjon Umurkulov running it` → published `Francisco Terpolilli is bringing a big hack`. Pick the one person who *is* the event to him; drop sponsor chains. (He adds co-hosts back when they're friends — see the second batch below — so flag those rather than guessing.) Two names max in the draft, and only when they're a genuine pair (`Andy Tyler & Isaac Tolley`, `Fatema Al Khalifa & Povilas Dumcius dream team 😍`). Still list everyone in `# Tagging` — the worksheet is exhaustive, the copy is not.

**Person-first sentences with a warm epithet.** He restructures `Org's 𝗧𝗶𝘁𝗹𝗲 — Person hosting` into `Person + verb + event`:
- `by the one and only Sam Hooti` / `in person events with the one and only Andy Tyler`
- `Francisco Terpolilli is bringing a big hack with Cursor's 𝗖𝘆𝗯𝗲𝗿𝘀𝗲𝗰𝘂𝗿𝗶𝘁𝘆 𝗟𝗼𝗻𝗱𝗼𝗻 𝗛𝗮𝗰𝗸𝗮𝘁𝗵𝗼𝗻`
- `Matt Carey is in town for AI Demo Days` — "is in town" is an *angle*, not a title dump
- `Zoe (Ziwen) Qin & Rui Rui Xie are back with another awesome...` / `Josh Tulloch and the PLUGGED team are back for their signature Residentials`

"is back", "are back for another", "is in town", "is bringing" — recurring verbs that frame events as people doing things.

**Shorten formal Luma titles to how people refer to the event.** `𝗥𝗲𝘀𝗶𝗱𝗲𝗻𝘁𝗶𝗮𝗹𝘀 𝗩𝗼𝗹 𝗫: 𝗙𝗼𝘂𝗻𝗱𝗲𝗿 𝗙𝗶𝗿𝗲𝘀𝗶𝗱𝗲 & 𝗛𝗼𝘂𝘀𝗲 𝗣𝗮𝗿𝘁𝘆` → `their signature Residentials`. `𝗕𝘂𝗶𝗹𝗱 𝘄𝗶𝘁𝗵 𝗡𝗲𝘁𝗹𝗶𝗳𝘆: 𝗟𝗼𝗻𝗱𝗼𝗻` → `𝗕𝘂𝗶𝗹𝗱 𝘄𝗶𝘁𝗵 𝗡𝗲𝘁𝗹𝗶𝗳𝘆`. Drop trailing `: 𝗟𝗼𝗻𝗱𝗼𝗻`, `𝗩𝗼𝗹 𝗫`, subtitle clauses.

**Name the venue.** He adds venues constantly and I under-use them: Encode Club, Ramen Space, Granary Square, NQ64 Arcade Bar, 5050 HQ, Kings X, IDEALondon, Queens Wood, Dalston. `to Encode Club`, `at Granary Square (8am)`, `out in Dalston`. A venue is often more evocative than the event subtitle.

**Day headers are verbless and punchy, and vary within a post.** `Tue is the day for Physical AI.` · `Wed a mix of everything.` · `Thu lock in then out.` · `Sat, it's time to hack.` · `Thursday = Summer party time 🌞` · `Weds is the stacked one:`. The `=` connector is his. Day-label style is inconsistent by design — `Monday`/`Tuesday` in one post, `Mon -`/`Tue -`/`Weds` in another. Don't over-systematise.

**Secondary events are standalone connective lines, not `- also on:` bullets.** He strips my bullet prefixes and starts the line lowercase with a connective: `or head to Ramen Space for...` · `and watch Fifty Years film...` · `also on Weds: ...` · `and 𝗟𝗼𝗻𝗱𝗼𝗻 𝗧𝗲𝗰𝗵 𝗕𝗼𝗮𝗿𝗱𝗴𝗮𝗺𝗲𝘀 𝗡𝗶𝗴𝗵𝘁 by Remy Mess 👾` · `plus Matt Carey is in town for...`. Keep true `-` bullets for **themed clusters of 3+ on one day** (`Tuesday's stacked with pitches, patents and demos:` — that block survived verbatim).

**Conditional connectives as day openers.** `If you're not partied out by Friday, ...` · `If you need another hack on Sat, ...` · `Looking for something different? ...` · `then it's hack week to close out the month:`. The existing "theme-stitching" rule undersells these — they're a primary day-opener form, not just a mid-post pivot.

**"we/our", not "mine".** Drafted `Thursday's mine` → published `Thursday = Summer party time 🌞 / We're throwing a rooftop BBQ at Encode Club`. Also `We're hosting a few at London Calling`, `our Summer Picnic salon`, `𝗮𝗻𝗱 𝘄𝗲'𝗿𝗲 𝗿𝘂𝗻𝗻𝗶𝗻𝗴 𝗮 𝗳𝗲𝘄 𝗼𝗳 𝗼𝘂𝗿 𝗼𝘄𝗻:`. London Calling is a team.

**Own events can be a timed block.** A distinct format worth offering when he's hosting 3+:
```
𝗮𝗻𝗱 𝘄𝗲'𝗿𝗲 𝗿𝘂𝗻𝗻𝗶𝗻𝗴 𝗮 𝗳𝗲𝘄 𝗼𝗳 𝗼𝘂𝗿 𝗼𝘄𝗻:
Mon 6.30pm - scarcity & abundance salon
Thu 8am - hardware builder coffee
Thu 10am - co-working house w/ Sam Hooti
```

**Never an em dash. Anywhere, on either platform.** `Thursday - a rooftop BBQ`, `Residentials - Moises will be down for a chat`, `Encode Club - so you know where to find me`, `Mon - ease in with...`. He used to convert prose em dashes to ` - ` on LinkedIn every week, then ruled them out entirely on 2026-09-11 ("never use em dashes again!") after an X thread went out full of them. Use ` - `, a comma, or a line break. The archived posts in `docs/post-archive/` and the quoted examples in this skill still contain em dashes because they're verbatim captures; don't copy the habit from them.

**End on a tease or a question, after the sign-off.** The sign-off isn't always last: `Cooking up some exciting things for summer 👀` · `any events I'm missing..?` · `+ 𝙬𝙖𝙩𝙘𝙝 𝙤𝙪𝙩 𝙛𝙤𝙧 𝙖 𝙗𝙞𝙜 𝙖𝙣𝙣𝙤𝙪𝙣𝙘𝙚𝙢𝙚𝙣𝙩 𝙛𝙧𝗼𝗺 𝘆𝗼𝘂𝗿𝘀 𝘁𝗿𝘂𝗹𝘆` · `coming this October`. Plant a forward-tease or an engagement question when there's one to plant.

**Emoji vocabulary is wider than the X list.** Observed on LinkedIn: 🇬🇧 🌞 🚀 👾 🌳 🕺🪩 🫡 😍 🧪 ☕️ 🍜 ⚽ 🔌 ⬇️ 👇 👀 🔥 🏴󠁧󠁢󠁥󠁮󠁧󠁿. Per-event emoji is on-voice.

**Don't over-polish.** The published posts carry typos and rough edges he didn't fix (`Indispensible`, `has scene`, `and bringing` for "are bringing", `back fro another`). Don't introduce errors — but the lesson is that his copy is fast and spoken, and mine reads committee-smoothed. Prefer the loose spoken clause over the balanced one.

**He knows things the data doesn't.** He added `Liam Ward` where my notes said no host data, corrected `Founders Meet Up — Indispensable Room` to a Fifty Years film screening, resolved `Sam` → `Sam Hooti`, and added `Moises will be down for a chat`. Where an event is thin, say so in Notes and leave the line short — don't pad it with generic description he'll have to delete.

### LinkedIn, second batch: five more pairs (2026-08-03 → 2026-09-06)

These rules come from the second batch of pairs and are sharper than the ones above. In four of the five weeks the published post was **13–34% shorter** than my draft, with about half the blank lines. The fifth (08-03) grew, because tags expand to full page names and he added an aside. These five only have likes and comments (no impressions):

| Week | Opener | Likes | Comments |
|---|---|---|---|
| 08-22 | `London is back baby 🔥` / `...` | **62** | **19** |
| 08-10 | `London's got a new front room 🏠` / `Opens tomorrow.` | 49 | 4 |
| 08-29 | `"I hate London when it's not raining"` / `Groucho Marx was right.` | 35 | 7 |
| 09-06 | `Riding out a wave of optimism after yesterday's picnic 🌞` | 35 | 4 |
| 08-03 | `plug in or plug out? 🔌` / `August's landed and half of London's on a beach.` | 28 | 1 |

The two openers that start with "London" lead again, the same thing the reach table above found. It's only five posts, so treat it as a lean, not a law.

**One gloss per event, then stop.** Keep the first ` - ` clause and cut every sentence after it. That second sentence is what I add every week and he deletes every week: `Four panels, eight founders showcasing, and McKinsey Health Institute, Ultrahuman and Cooley all in the room.` · `No sales pitches, no recruitment, just systems` · `Nobody has designed this yet - no pattern library, no conventions...` · `Backed by Pillar VC and ARIA.` · `No human analysts allowed.` Judge, sponsor and speaker lists go too (`Accel, Cur8 and Muzz judging`, `Judged by X, powered by Cursor and Vercel`), and so does sub-venue detail (`in the Purcell Room`, `on Goswell Rd`, `in Fitzrovia`). The venue name stays; the street and the room go.

**Jokes are about people, not the event format.** He cuts my columnist asides: `𝙍𝙚𝙛𝙧𝙚𝙨𝙝𝙞𝙣𝙜.` · `nobody's checking.` · `maybe that's the point.` · `put the long tables away for` · `𝙏𝙤𝙤 𝙡𝙖𝙩𝙚 𝙩𝙤 𝙜𝙚𝙩 𝙖 𝙨𝙚𝙖𝙩, 𝙗𝙪𝙩 𝙬𝙖𝙩𝙘𝙝 𝙬𝙝𝙖𝙩 𝙡𝙖𝙣𝙙𝙨.` What he adds is in-group humour aimed at friends, the weather or himself: `I think they're going to need a bigger cafe 😂` · `[ Josh you lied to us ;P ]` · `(or partying in Peckham with the one and only Josh Tulloch 🔌 (JT) last night 👀)` · `so we're optimistic for the weather! ☀️` · `or does the storm take London... ☔️` · `and Chapel Down!!!`. I don't have what those jokes need, so don't manufacture a clever line in their place. Leave the event plain. Don't ask in Notes where he'll be or whether he wants an aside; he adds those himself.

**Tight blocks: no blank line inside a day.** The day header sits on its own line with its events directly under it, and the only blank lines are between days: `Tue is the day for robots.` ↵ `Lukas M. Ziegler is over from Germany...` · `Wed.` ↵ `Stephanie & Josh from 5050 run...` · `Thurs keeps giving` ↵ `- Replit throw...`. I put a blank line after every header and between every event, and he deletes about half of them every week.

**A day with 3+ events is a header plus `-` bullets, every time.** On 09-06 Thursday I wrote three separate paragraphs, and he turned them into `Thurs keeps giving` with three bullets. The header often has no colon.

**A thin day collapses to one line of titles.** `Tues, 𝗔𝗴𝗲𝗻𝘁𝗖𝗼𝗻 lands at London South Bank University, Isaac Tolley's 𝗝𝘂𝗻𝗼 𝘅 𝗖𝗼𝗿𝗴𝗶 𝗖𝗿𝗲𝗮𝘁𝗼𝗿 𝗕𝗿𝘂𝗻𝗰𝗵` has two events and no descriptions. This is the one exception to the no-comma-fusing rule: two title-only events on a minor day can share a line. He also gives a day a theme line when its events share one: `Mon - Biology takes over the pub.`

**Check the posting date and cut anything already over.** He posts Friday to Sunday morning (Sat 08-01, Fri 08-07, Sun 08-23, Sat 08-29, Sun 09-06). The 08-22 draft opened with two Saturday hacks, but it went out on Sunday, so both were cut. Ask which day it's going out, and drop events on or before that day.

**Don't re-feature last week's picks.** The 08-29 draft gave the weekend's Running Hackathon and Hardware Hack their own paragraphs, but both had been in the 08-22 post. He folded them into the opener: `There's a huge bank holiday weekend - running hacks, hardware hacks and coworking - and no excuse not to be there!` Read last week's published post before picking.

**Write org names the way the LinkedIn @mention will render.** Tagging in the composer swaps the text for the page's display name, so short forms get expanded anyway: `EF` → `Entrepreneurs First` · `Venture Café` → `Venture Café London` · `Encode` → `Encode: AI for Science Fellowship - Pillar VC x ARIA` · `TechThrive` → `TechThrive Ventures` · `the Deep Tech London Summit` → `Deep Tech London`. Use the full page name for orgs. People's display quirks (`Ian A.`, `Mike Butcher ✍️`, `Bryan M. Li`) are the tag doing that, so don't copy them into drafts. **Never put a taggable name inside a Unicode bold or italic run.** The tag turns it back to plain text and breaks the styling mid-line, so `𝙖𝙣𝙙 𝙧𝙖𝙧𝙚 𝙛𝙤𝙪𝙣𝙙𝙚𝙧𝙨 𝙖𝙧𝙚 𝙗𝙖𝙘𝙠` went out as `𝙖𝙣𝙙 Rare Founders 𝙖𝙧𝙚 𝙗𝙖𝙘𝙠`. Leave the name plain.

**Friends get first names and co-hosts.** The one-name rule is about cutting sponsor and judge chains, not the people he knows. He added co-hosts in four of the five posts: `Tijs Nieuwboer, Siena Kinsale & Rachel Macnaghten` · `Andy, Oscar & Pauline` · `( Davide Locatelli, Jake Dickson )` · `Stephanie & Josh from 5050` · `Hamzah from Callosum`. Regulars get first names: `Oscar opens the CoLoop office back up`, `Olha runs Healf's SWE Dinner`. Keep one full name in the copy, list every host in `# Tagging`, and flag repeat hosts in Notes so he can decide who gets added.

**Flag who's really behind an event; he corrects this most weeks.** `Wojtek Treyde and the Encode crew are back with 𝗨𝗻𝗯𝗹𝗼𝗰𝗸` → `CompMotifs team up with Encode...` · `after hours put 6 of their 40 startups` → `Redwood Founders put 6 of their 40 after hours startups` · `Albert Chun's AI Circle` → `AI Circle ... w/ Joséphine Parquet`. When Luma's host list, the calendar and the description disagree about who's running it, say so in Notes.

**The sign-off, the DTL tease and bold are all optional.** Only 2 of 5 kept a london calling line (`any I missed!?` ↵ `add them to london calling [dot] guide ofc!`). 08-10 ended `See you next week 🫡🇬🇧`, while 08-22 and 09-06 ended on the last event. He cut the DTL tease on 09-06, the week Deep Tech London had its own "one month out" post. 08-22 went out with no bold titles and no bullets, and it got the most comments of the five. Write one closing line at most, and don't treat it as required.

**Openers: anchor in yesterday, the weather or London.** He kept `Riding out a wave of optimism after yesterday's picnic 🌞` word for word. He swapped `Bank holiday, done properly 🌞` for a weather quote with attribution, and he put back the `...` beat I'd dropped on 08-22. A beat can also be a short piece of news (`Opens tomorrow.`) or a personal aside in brackets under the second line.

### Formatting: neither platform renders markdown — this is not optional

**LinkedIn and X both post literal asterisks if you leave `**bold**` or `*italic*` in the text.** Neither has real bold/italic in a normal post. Lachlan's actual voice uses real Unicode glyphs instead — Mathematical Sans-Serif Bold (`**text**` → `𝘁𝗲𝘅𝘁`) and Sans-Serif Bold Italic (`*text*` → `𝘵𝘦𝘹𝘵`). Hand-converting these one word at a time was the single biggest source of manual rework, so it's now a script step — see step 3a. Draft with plain `**`/`*` markdown as always (it's the easiest way for you to write it correctly); never hand it to Lachlan or `post-thread` with the markdown still literal.

**What gets bold vs. plain vs. italic — and why:** Lachlan tags every human and org by hand regardless of formatting, so bolding company/org names doesn't save him any work — keep those **plain text**. Reserve **bold** for event titles themselves, when the title is its own thing rather than just the company name (e.g. bold "Defence 101: Open Mic Pitching + Networking", not bold "Rare Founders"). Use *italic* (renders as bold-italic) for emphasis lines and asides — a callback, a quiet aside, the "watch this space" line — not for names at all.

## The loop

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

The script prints JSON to stdout: `{ from, to, mode, count, dayCounts[], highlights[], tagging[] }`. Each highlight has `event`, `hosts[]` (with `twitter` / `linkedin` / `isOrg` / `kbMatch` / `registryMatch` / `lumaMatch` / `peopleMatch` populated when found), `kbHints[]` (organiser matches in `communities`/`vcs`/`companies`), and `weekday` (e.g. `"Tue 5"`). `dayCounts[]` is `{ date, weekday, curated, total }` per day across the **whole** range — your density signal for shot-planning.

**`tagging[]` is the worksheet** — `{ event, weekday, people[] }` where each person is `{ name, linkedin, x }`, humans only (orgs filtered out), in Luma's host order. Drop this almost verbatim into the post's `# Tagging` block (step 4b). It's the manual-tagging cheat sheet: LinkedIn @mentions can't be API-posted, so Lachlan works down this list by hand in LinkedIn's composer — having every profile URL pre-resolved is what turns a 20-minute hunt into 2.

**Socials resolve in this order:** Luma host node (`lumaMatch` — carries both X *and* LinkedIn now, the broad default) → KB people-table (`kbMatch`, hand-curated, wins) → org handle registry (`docs/social-handles.yml`, `registryMatch`) → people registry (`docs/people-handles.yml`, `peopleMatch`). The **people registry auto-grows every run** — each resolved human is cached name→LinkedIn/X so next week they arrive pre-tagged; hand-edits to it are preserved. The org registry is grown by `npm run harvest-handles` (step 7).

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

(single post body — day-by-day or flat week-highlight shape, one bullet per event (never comma-fused), **bold** on event titles only (not companies), plain names + `:o`/emoji flavour, *italic* for asides, free-riff sign-off)

# Tagging

(manual-tag cheat sheet from the script's `tagging[]` — every human to @mention, in post order, each with LinkedIn URL + X handle. Stripped from the posted text; it's Lachlan's worksheet for the by-hand LinkedIn/X tagging.)

# Shots

(screenshot plan — one bullet per shot with rationale + the exact `npm run screenshot` command; omit if the week needs no screenshots. See step 5.)

# Notes

- KB matches: ...
- Missing handles: ...
- Suggested hooks I didn't use: ...
```

Use `---` as the X post separator (it's the standard Typefully thread delimiter, and how `post-thread` splits the thread). One post per day is the default, but **theme-grouping is fine** — e.g. merge the weekend's hackathons into a single "three hacks" post.

**What may and may not share a post.** Saturday and Sunday can share one ("the weekend"). **Friday never joins them** — it's a weeknight, and merging it reads as padding out a thin day. The only exception is a single event that genuinely spans Friday into the weekend (a hackathon running Fri→Sun), which is one event and therefore one post. A thin Friday gets its own one-line post instead; the "don't drop a thin day" rule already covers it. On 2026-09-20 I merged `𝗙𝗿𝗶 𝟮𝟱 & 𝗦𝗮𝘁 𝟮𝟲` into one post with one event each and Lachlan split them back out — that was the only change he made to the whole draft.

For each event, prefer in this order: KB-matched twitter handle → registry handle → Luma-extracted handle → just the host name (no @). For LinkedIn, prefer KB linkedin → bold name only.

### 3a. Convert markdown emphasis to real Unicode

Once the X thread and LinkedIn body are drafted with normal `**bold**`/`*italic*` markdown, run:

```bash
npm run style:unicode -- docs/posts/2026-07-13-week.md --write
```

This rewrites every `**...**` run to Sans-Serif Bold and every remaining `*...*` run to Sans-Serif Bold Italic, in place, leaving urls/@handles/emoji/`img:` lines untouched. Run it once, near the end of drafting, after the copy is settled — re-running it on already-converted text is harmless (it only matches literal asterisks, and there won't be any left). Do this before showing Lachlan the draft or running `post-thread` — he should never need to hand-convert a bolded word again.

### 4b. Build the `# Tagging` worksheet

This is the highest-leverage output — it kills the slowest manual step. Take the script's `tagging[]` and render it under `# Tagging` as a per-event checklist, **in the order the people appear in your post**, e.g.:

```
# Tagging

LinkedIn @mentions (type by hand in the composer — no API can do this):

Tue — Labs After Dark
- [ ] Francesco Moiraghi — linkedin.com/in/francesco-moiraghi  (X: @framoira)
- [ ] Subaita Rahman — linkedin.com/in/subaita-rahman  (X: @subaita_rahman)

Weekend — Building an AI Scientist
- [ ] Jonty Corrin — linkedin.com/in/jontycorrin
- [ ] Isabel Zhang — linkedin.com/in/isabel-zhang
```

Only include people you actually named in the post. If a host you want has no LinkedIn in `tagging[]`, flag it in gaps so Lachlan can hand-add it to `docs/people-handles.yml` (it'll stick for next week). This block is stripped by `post-thread`, so it never posts — it's purely the worksheet.

### 4. Surface KB and gaps

After drafting, list at the bottom of the file:
- Hosts with no handle anywhere (Lachlan may know them personally)
- KB hints that look interesting but you didn't use (e.g. organiser is a known VC)
- Hooks/themes you noticed but didn't fit (week's accidental theme — "first birthdays", "demos week", etc.)

Then tell the user the file is drafted and ask if they want edits before they paste.

### 5. Plan the shots, then add images

**The screenshot decision is not a separate guess — it falls out of the thread structure + `dayCounts`.** A screenshot earns its place when an image carries the content better than text, so the tweet shrinks to a hook + image (not a hook + a long list). Three patterns, decided while you draft:

1. **Dense day → day grid.** If `dayCounts` shows a day at ~6+ curated, that day is the week's centre of gravity. Make its post a `--day` grid: the tweet becomes "𝗧𝗵𝘂 𝟰 is stacked 👀" + the grid image, instead of enumerating all eight in text. A thin-but-important day can be padded to a full grid (8 = two clean rows of 4) in `/admin` first — flag this to Lachlan, don't do it silently.
2. **Themed cluster → select collage.** When one post bundles a coherent set of 2–4 events (the weekend's three hackathons, a night of three firesides), `--select` exactly those and let the collage talk; keep the text to the theme line.
3. **Single hero → cover.** One marquee event = just its Luma `coverUrl` via an `img:` URL. No screenshot.

4. **Opener 12-up → always with `--header`.** The root tweet's week collage (12 picks, three rows of 4) must always carry the London Calling title block on top. Never ship it as cards only.
   `npm run screenshot -- --week <week> --header --select "<12 titles>" --out week-12up.png`

**Nothing stays text-only.** Every day post gets one of the above: a collage for 2+ picks, a bare link or cover for a single pick. A day mixing a hosted event with an evening one (e.g. builder coffee + Nucleate) is a 2-card collage. Curated-only for `--select`; if a pick isn't curated, use its link instead. Don't collage events from different posts (the image implies they belong together).

**Emit a `# Shots` block.** When the thread calls for screenshots, append a `# Shots` section to the post `.md` — each planned shot with its one-line rationale and the **exact command** — and pre-write the matching `img:` lines in the thread so the files land where they're already referenced. Lachlan runs the commands (after any `/admin` padding); you don't run them. Example:

```
# Shots

- Thu 4 grid — Thursday is the week's big day (8 curated). → thu-curated.png
  npm run screenshot -- --week 2026-05-31 --day 2026-06-04
- Weekend hacks collage — the "three hacks" post bundles them. → sat-hacks.png
  npm run screenshot -- --week 2026-05-31 \
    --select "Agent Economy, Pop The Bubble, NVIDIA Hack for Impact, VibeHack" --out sat-hacks.png
```

Then the mechanics below produce those files.

Images attach to posts via an `img:` line (or `![](...)`) under the relevant post in the `.md`. The line is stripped from the posted text.

```markdown
**Thu 4**
... the day's narrative ...
img: docs/posts/assets/2026-05-31/thu-curated.png
```

- **Where files live:** `docs/posts/assets/<week-date>/`, descriptive names. Covers every source — Luma covers (paste a URL and the CLI downloads it), `/events`-page screenshots, admin select-and-view collages, past-event photos, London shots.
- **Native media, not links** — attaching the cover as an image keeps the graphic without the engagement/cost hit of a link.
- Multiple `img:` lines = multiple images on one tweet.

**Screenshot helper** (`npm run screenshot`) — automates the two recurring shots by driving the real `/events` UI with Playwright. **Start the dev server first** (`npm run dev`):

```bash
# Curated /events grid for one day (full page: header + cards) — the "Thursday" shot.
npm run screenshot -- --week 2026-05-31 --day 2026-06-04
# → docs/posts/assets/2026-05-31/thu-curated.png

# A hand-picked set as the 4-up card collage (cards only) — the "weekend hacks" shot.
# Match each event by a distinctive substring of its title. Needs ADMIN_SECRET.
npm run screenshot -- --week 2026-05-31 \
  --select "Agent Economy, Pop The Bubble, NVIDIA Hack for Impact, VibeHack" \
  --out sat-hacks.png
```

`--day` defaults the filename to `<weekday>-curated.png`; `--out` overrides. The grid fills better when the day has a healthy curated set — Lachlan sometimes pads a thin day in `/admin` first.

### 6. Push to Typefully

```bash
npm run post-thread -- 2026-05-31            # dry-run: prints the parsed thread + image count
npm run post-thread -- 2026-05-31 --send     # creates a Typefully DRAFT across X + LinkedIn
```

Parses the `.md` (X thread split on `---`, LinkedIn block, Notes excluded), uploads images as native media, and creates one Typefully draft spanning both platforms. Default (no `--publish`) saves a **draft** — Lachlan reviews and schedules inside Typefully. A `<week>.typefully.json` sidecar prevents double-pushing. Needs `TYPEFULLY_API_KEY` + `TYPEFULLY_SOCIAL_SET_ID` in `.env.local`.

### 7. Feed the registry

After the post is finalised:

```bash
npm run harvest-handles    # scrapes @handles from the new post into docs/social-handles.yml
```

Then, for any handle whose entry only matches itself, add the event's **luma username / org-name tokens** to its `match:` list so next week the script auto-tags it. This is the compounding step — a few aliases each week and drafts arrive pre-tagged.

## When to stop and ask

- A directed name has 0 matches → ask for clarification, don't guess
- A day has 4+ candidate events → ask which to feature (don't shotgun)
- Lachlan's own event is in the pool → ask how he wants to plug it (the salon line in 2026-05-03 was personal)
- The KB shows a host has both `twitter` and `linkedin` but they conflict (different identities) → flag it

## Don'ts

- Don't auto-publish. `post-thread` creates a Typefully **draft** (no `--publish`) — Lachlan reviews and schedules in Typefully.
- Don't fabricate handles. If the script didn't return one, leave the bold name and note it in the gaps section.
- Don't generate emojis the archive doesn't use — but the observed vocabulary is wider than it once was. Core: `!!!` `🔥` `🦄` `👀` `👋`. Also in published posts: `🇬🇧 🌞 🌤️ 🚀 👾 🌳 🕺🪩 🫡 😍 🧪 🤖 🏞️ ☕️ 🍜 🍹 ⚽ 🔌 ⬇️ 👇 🏠 🏴󠁧󠁢󠁥󠁮󠁧󠁿`.
- Don't open either platform by announcing the post is an events round-up. "The events you don't want to miss in London this week!!!" ran on both X and LinkedIn the same week and came **last on both** (317 root views; 1,633 impressions / 45% out-of-network).
- Don't drop a thin day from the X thread. He adds them back as one-liners.
- Don't hand over a day post with no image or link. Plan a shot or link for every post in `# Shots` before showing the draft.
- Don't markdown-wrap lu.ma links on X.
- Don't hand Lachlan (or `post-thread`) a draft with literal `**`/`*` still in it — run `npm run style:unicode` first (step 3a).
- Don't comma-fuse multiple events into one LinkedIn bullet. One event, one bullet.
- Don't mirror the X thread's full event list on LinkedIn. Cut to the strongest 2–4 per day.
- Don't summarise the events factually — that's not the voice. Always pick a hook.

## Future (not v1)

- "Already-highlighted" tracking by reading `docs/posts/*.md` event-id lists, so the auto picker excludes repeats
- Better ranker that uses `people.featured` + attendee count signals

Done (was future): Typefully API posting (step 6), images as native media + Playwright screenshot helper (step 5), handle registry (step 7).
