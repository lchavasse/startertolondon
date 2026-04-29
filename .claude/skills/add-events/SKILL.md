---
name: add-events
description: Ingest events from non-Luma/Eventbrite/Meetup sources into the events:manual KV path so they show up on /events. Triggers on "add events from <url>", "ingest aitinkerers", "pull venture café events", "add this event manually", or any request to populate the events page from sources outside the existing scraper pipeline. Auto-publishes by default; admin can hide via /admin if needed.
---

# Add Events

Use this skill to surface events from sites the cron scraper doesn't cover. You're writing to `events:manual` — a KV path that `getEvents()` already merges into the live `/events` feed and that the scraper pipeline never overwrites.

## The primitive

`scripts/add-event.ts` — takes a JSON array of event input objects, upserts to KV.

```bash
npm run add-event -- path/to/events.json     # from file
echo '[{...}]' | npm run add-event -- -      # from stdin (note the trailing -)
npm run add-event -- path/to/events.json --dry-run
```

JSON shape per event:

```json
{
  "name": "AI Tinkerers London – 5th May",
  "startAt": "2026-05-05T18:00:00+01:00",
  "url": "https://london.aitinkerers.org/p/...",
  "locationName": "London",

  "endAt": "2026-05-05T21:00:00+01:00",
  "coverUrl": "https://...",
  "organiserName": "AI Tinkerers London",
  "tags": ["ai", "demo-night"],
  "timezone": "Europe/London",
  "calendarSlug": "aitinkerers"
}
```

Required: `name`, `startAt` (ISO 8601), `url`, `locationName`. Everything else is optional with sensible defaults (`endAt = startAt + 2h`, `coverUrl = null`, `tags = []`, `timezone = Europe/London`).

IDs are minted as `manual-<sha1(url|startAt)>`, so re-running on the same input upserts cleanly. Updates preserve the existing `pending` flag — admin approvals/holds aren't trampled. IDs in `events:blocklist` (events the admin deleted) are skipped.

## Workflow

1. Identify the source(s) the user wants ingested.
2. For each source, follow the recipe below — or improvise for new sites.
3. Build the JSON array. **Convert all datetimes to ISO 8601 with London offset** (`+01:00` BST, `+00:00` GMT). The script trusts what you give it.
4. Filter to `startAt >= now` — past events are wasted writes.
5. Write to a temp file under `/tmp/add-events-<source>.json`, then `npm run add-event -- <file>`. (Stdin works too but a file is debuggable.)
6. Report back: how many added / updated / blocked.

If the data quality is at all uncertain, run with `--dry-run` first.

## Site recipes

### Venture Café London

`https://community.venturecafelondon.org/` — open page, WebFetch works first try.

```
WebFetch(
  url: "https://community.venturecafelondon.org/",
  prompt: "Extract all upcoming events. For each return: title, start date/time
           (with timezone), end date/time, full event URL, cover image URL,
           venue/location. JSON array."
)
```

Notes:
- Event detail URLs go to `gatherus-app.com/events/<uuid>`. Use those as `url`.
- Default venue: `1 Triton Square, London NW1 3BF`. Confirm in the WebFetch output.
- Times are typically `18:00–21:00 Europe/London`.
- `organiserName: "Venture Café London"`, `calendarSlug: "venturecafe"`.

### AI Tinkerers London

`https://london.aitinkerers.org/` — Cloudflare-walled. Homepage and event pages return 403 to plain HTTP. **Use `llms-full.txt` instead** — they explicitly allow it for AI agents in `robots.txt`.

```bash
curl -s "https://london.aitinkerers.org/llms-full.txt"
```

Look for the `## Recent Event Pages` section. Lines are shaped like:

```
- [<title> [AI Tinkerers - London]](<url>): <type> - <Mon DD, YYYY> - London
```

Per event:
- `name`: the title (strip the trailing ` [AI Tinkerers - London]`)
- `startAt`: `<date>T18:00:00+01:00` for BST months, `+00:00` for GMT (Nov–Mar). The llms file only gives day-precision; 18:00 is the typical meetup start.
- `url`: the link
- `locationName`: `"London"` (full venue isn't in llms.txt; admin can enrich via `/admin`)
- `coverUrl`: `null`
- `organiserName`: `"AI Tinkerers London"`
- `tags`: derive from `<type>` — `Hackathon` → `["ai", "hackathon"]`, `Dinner` → `["ai", "dinner"]`, `Vip Event` → `["ai", "invite-only"]`, default `["ai"]`.
- `calendarSlug`: `"aitinkerers"`

**Filter to upcoming dates only** before piping — the file lists past events too.

### A new site you haven't seen

1. Try `WebFetch` first. Works for ~80% of sites.
2. If 403, try `curl -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36" <url>`.
3. If still blocked, probe machine-readable endpoints — many bot-walled sites leave these open: `/llms.txt`, `/llms-full.txt`, `/robots.txt`, `/sitemap.xml`, `/feed.xml`, `/rss`.
4. If all fail, ask the user to paste the page source into a temp file, then parse that.
5. **Do not** install Playwright, cheerio, or any new dep without confirming with the user.

After a successful run on a new site, append a recipe block above so the next run is one-step.

## Things to watch

- The script prints `[update]` for events already in KV (re-seeded). Tell the user how many were updates vs adds — it's signal that the source data hasn't changed.
- `[skip blocked]` means the admin previously deleted that event via `/admin`. Don't try to override.
- If `startAt` parsing fails, the script throws. Most common cause: passing a string like `"6:00 PM GMT+1"` instead of ISO. Convert upstream.
- Auto-publish is the default (`pending: false`). If the source feels low-trust, set `pending: true` per event so it lands in the admin review queue first.
