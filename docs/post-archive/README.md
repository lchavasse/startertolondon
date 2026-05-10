# Post archive

Voice training corpus for the `event-highlights` skill. Each file is a real post Lachlan wrote, captured verbatim. The skill reads these to match tone when drafting new ones.

Conventions:
- `YYYY-MM-DD-<platform>-<slug>.md` — date is the publish date (or best guess)
- `platform` is `x` (thread) or `linkedin` (single post)
- Body is verbatim — line breaks, casing, `!!!`, emojis preserved
- Front-matter optional; only add if there's metadata worth keeping (week-of, source URL, post id)

Add a new file every time you write a post — voice drift is real and the corpus is how we keep it tight.
