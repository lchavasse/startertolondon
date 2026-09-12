# Post archive

Voice training corpus for the `event-highlights` skill. Each file is a real post Lachlan wrote, captured verbatim. The skill reads these to match tone when drafting new ones.

Conventions:
- `YYYY-MM-DD-<platform>-<slug>.md` — date is the publish date (or best guess)
- `platform` is `x` (thread) or `linkedin` (single post)
- Body is verbatim — line breaks, casing, `!!!`, emojis preserved
- Front-matter optional; only add if there's metadata worth keeping (week-of, source URL, post id)
- `status: published` vs `draft` — published means it's the version that actually went out, which is the one worth learning from
- `metrics:` when known. LinkedIn: `impressions`, `members_reached`, `in_network`, `out_of_network` — out-of-network share is the useful one, it's how hard the algorithm pushed the post past Lachlan's own network. X: `root_views`, `likes`, `reply_views[]` — root views measure the opener, reply views measure handle density.

**Refreshing X threads:** they render logged-out, so no auth needed.
```bash
agent-browser --session voice open "https://x.com/lachlan_xyz/status/<id>" && sleep 5 && agent-browser --session voice get text body
```
Single tweets (text, date, like count) also come off the syndication endpoint without a browser:
`curl -s "https://cdn.syndication.twimg.com/tweet-result?id=<id>&token=a&lang=en"`

Add a new file every time you write a post — voice drift is real and the corpus is how we keep it tight.

**The pairs are the point.** Where a published file has a matching draft in `docs/posts/<week>.md`, the diff between them is the training signal — it shows what Lachlan rewrites, not just what good looks like. `2026-06-15` → `2026-07-27` are six such pairs; the learnings are folded into the LinkedIn section of `.claude/skills/event-highlights/SKILL.md`.

Both platforms have six published pairs each for 2026-06-15 → 2026-07-27, with metrics. LinkedIn has five more for 2026-08-03 → 2026-09-06, pulled with Bright Data (`bd posts --urls`) — likes and comments only, no impressions. Their learnings are in the "second batch" section of the skill.
