# CLAUDE.md — starter-london

## Project Overview

Next.js app serving London tech events scraped from the Luma API. Events page only for now; architecture is designed to expand to VCs, workspaces, etc. (the broader "starter-london" vision).

## Key Architecture

```
Vercel Cron (6am UTC daily)
  → /api/cron/scrape
    → runAllScrapers()
    → saveEvents() → Upstash Redis

Browser → /events
  → Server Component → getEvents() from Redis
  → EventGrid (client) → EventCard tiles
```

**Storage**: Upstash Redis via `@upstash/redis`. Single key `events:london` holds a JSON array of all events, sorted chronologically. `getEvents()` filters to future events (startAt >= now - 1hr).

## Scraper System

Four scrapers run in parallel via `Promise.allSettled`. Deduplication by event `id` in the orchestrator.

| Scraper | File | Sources |
|---------|------|---------|
| `luma-discovery` | `luma-discovery.ts` | London curated discovery feed (hardcoded place ID) |
| `luma-calendar` | `luma-calendar.ts` | All calendars in `CALENDAR_SOURCES` |
| `luma-user` | `luma-user.ts` | All users in `USER_SOURCES` |
| `luma-channel` | `luma-channel.ts` | Community/topic pages in `CHANNEL_SOURCES` (auto-detects discovery vs calendar) |

**To add a new source**: edit `src/lib/scrapers/sources.ts` — add to the appropriate array. That's it.

**To add a new scraper type**: implement `EventScraper` (`name`, `run()`), add to the `scrapers` array in `index.ts`.

**Luma API reference**: `/Users/lchavasse/code/web_scraping/luma-api.md`

Key endpoints:
- Discovery feed: `api.lu.ma/discover/get-paginated-events?discover_place_api_id=<discplace-id>`
- Calendar events: `api2.luma.com/calendar/get-items?calendar_api_id=<cal-id>&period=upcoming`
- User events: `api2.luma.com/user/profile/events?username=<username-or-usr-id>`

Filter for London: `location_type === 'offline'` AND `geo_address_info.city === 'London'`

Cal-id extraction: fetch `luma.com/<slug>`, regex `__NEXT_DATA__` for `"api_id":"(cal-[A-Za-z0-9]+)"`.
Channel type detection: same page fetch — look for `discplace-` first, then `cal-`.

## Environment Variables

```
KV_REST_API_URL       # Upstash Redis REST URL
KV_REST_API_TOKEN     # Upstash Redis token
CRON_SECRET           # Auth token for /api/cron/scrape endpoint
```

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/types.ts` | `LondonEvent` and `EventScraper` interfaces |
| `src/lib/kv.ts` | `saveEvents()` / `getEvents()` |
| `src/lib/scrapers/index.ts` | Add new scrapers here |
| `src/app/events/page.tsx` | Server Component, `revalidate = 3600` |
| `src/app/api/cron/scrape/route.ts` | Cron endpoint (Bearer auth) |
| `vercel.json` | Cron schedule config |
| `scripts/scrape.ts` | Local CLI runner (`npm run scrape`) |

## Conventions

- Tags come from `calendar.name` initially — designed for keyword-based auto-tagging later
- `source` field on events tracks which scraper produced them (`luma-discovery` | `luma-calendar` | `luma-profile`)
- Event URLs: always stored as full `https://lu.ma/<slug>`
- Dates: always stored as ISO 8601 strings, timezone in separate field

## Running Locally

```bash
npm run scrape   # scrape and seed KV
npm run dev      # dev server → localhost:3000/events
```

## Design

Dark theme, electric yellow (`#c8ff00`) accent. Brutalist/urban aesthetic. Cards are square cover images with mono date overlay.
