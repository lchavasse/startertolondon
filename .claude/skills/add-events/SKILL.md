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
- Cards link to relative `/events/<uuid>` — use `https://community.venturecafelondon.org/events/<uuid>` as `url`. **Don't trust WebFetch's URLs** (it has invented `gatherus.com` / `gatherus-app.com` hosts); cross-check the uuids with `curl -A "Mozilla/5.0 ..." <homepage> | grep -oE 'href="/events/[a-f0-9-]{36}"'`. Each event page's embedded data has `start_date` with offset.
- Covers: the `<img>` inside each card, `storage.googleapis.com/gatherus-app/event_images/thumbnails/thumb_*.webp`. Tag `["thursday-gathering"]`.
- Default venue: `1 Triton Square, London NW1 3BF`. Confirm in the WebFetch output.
- Times are typically `18:00–21:00 Europe/London`.
- `organiserName: "Venture Café London"`, `calendarSlug: "venturecafe"`.

### AI Tinkerers London

`https://london.aitinkerers.org/` — Cloudflare-walled. Homepage and event pages return 403 to plain HTTP. **Use `llms-full.txt` instead** — they explicitly allow it for AI agents in `robots.txt`.

```bash
curl -s "https://london.aitinkerers.org/llms-full.txt"
```

The file is one `### <title>` section per event, each shaped like:

```
### <title>

> Source: <url>
> Last updated: <iso timestamp>

![<alt>](<cover image url>)
<body prose — contains the date, times and sometimes the venue>
```

Per event:
- `name`: the `###` heading
- `url`: the `> Source:` line
- `startAt` / `endAt`: **read out of the body prose** — there is no structured date field. Look for an `### Event Details` block (`**Date:** 8th June`, `**Time:** 6:15pm - 8:30pm`) or an inline mention (`"On August 16th"`, `"9am to 7pm in central London"`). The year is not always stated — infer from `> Last updated`. Use `+01:00` for BST, `+00:00` for GMT (Nov–Mar).
- `coverUrl`: the first `![...](...)` after the Source block. Take the bare `images.aitinkerers.org` / `sloppy-joe-app.imgix.net` URL — no need to add imgix or `cdn-cgi/image` params. **Verify it resolves** before writing (`curl -o /dev/null -r 0-0 -w '%{http_code} %{content_type}'`); later `![](...)` images in a section are sponsor logos, not covers.
- `locationName`: `"London"` unless the body names a venue (often "Address shared on acceptance"). Admin can enrich via `/admin`.
- `organiserName`: `"AI Tinkerers London"`
- `tags`: from the body — hackathon → `["ai", "hackathon"]`, dinner → `["ai", "dinner"]`, VIP/invite-only → `["ai", "invite-only"]`, default `["ai"]`.
- `calendarSlug`: `"aitinkerers"`

**Filter to upcoming dates only** before piping — the file lists past events too.

Gotchas:
- `llms.txt` (not `-full`) has a `## Recent Event Pages` link list that is **more complete** than the full corpus — cross-check it. Pages can appear there but be absent from `llms-full.txt`, in which case there's no cover or date to extract.
- **Newer event pages often have no date in the prose.** Detail pages (`/p/<slug>`) return 200 to browser-UA `curl` (as of Sep 2026) and embed JSON-LD with exact `startDate` / `endDate` (with offset) and `location.address` — grep it: `curl -s -A "Mozilla/5.0 ... Chrome/120.0 Safari/537.36" <url> | grep -oE '"(start|end)Date"[^,]*|"location":\{[^}]*\}[^}]*\}'`. `/events` still 403s; `/api/agents/v1` needs a member `sk_` API key. If neither prose nor JSON-LD has a date, ask the user rather than guessing.
- Re-running with the same `url` + `startAt` upserts in place (id is `sha1(url|startAt)`), so this is the safe way to backfill a cover onto an event already in KV. Changing `startAt` mints a *new* id and leaves a duplicate behind.

### A new site you haven't seen

1. Try `WebFetch` first. Works for ~80% of sites.
2. If 403, try `curl -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36" <url>`.
3. If still blocked, probe machine-readable endpoints — many bot-walled sites leave these open: `/llms.txt`, `/llms-full.txt`, `/robots.txt`, `/sitemap.xml`, `/feed.xml`, `/rss`.
4. If the page is an empty SPA shell (`<div id="root">`), download the JS bundle from the
   `<script type="module" src="/assets/...">` tag and `grep -oE '"/api/[a-z0-9/_-]+"'` it —
   these apps usually expose a public JSON endpoint (e.g. `/api/event`) with clean event data.
5. If all fail, ask the user to paste the page source into a temp file, then parse that.
6. **Do not** install Playwright, cheerio, or any new dep without confirming with the user.

After a successful run on a new site, append a recipe block above so the next run is one-step.

## Things to watch

- The script prints `[update]` for events already in KV (re-seeded). Tell the user how many were updates vs adds — it's signal that the source data hasn't changed.
- `[skip blocked]` means the admin previously deleted that event via `/admin`. Don't try to override.
- If `startAt` parsing fails, the script throws. Most common cause: passing a string like `"6:00 PM GMT+1"` instead of ISO. Convert upstream.
- Auto-publish is the default (`pending: false`). If the source feels low-trust, set `pending: true` per event so it lands in the admin review queue first.
