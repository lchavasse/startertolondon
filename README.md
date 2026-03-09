# starter-london

London tech events, scraped daily from Luma. Built with Next.js, deployed on Vercel.

## What it does

- Scrapes London in-person events from the Luma discovery feed daily via Vercel Cron
- Stores events in Upstash Redis (KV)
- Serves them at `/events` with tag filtering

## Stack

- **Next.js 16** (App Router, TypeScript)
- **Tailwind CSS v4**
- **Upstash Redis** — event storage
- **Vercel** — hosting + cron

## Local Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Create an Upstash Redis database**
   - Go to [upstash.com](https://upstash.com) → create a free Redis database
   - Copy the REST URL and token

3. **Set up env vars** — create `.env.local`:
   ```
   KV_REST_API_URL=https://your-db.upstash.io
   KV_REST_API_TOKEN=your_token_here
   CRON_SECRET=any-random-32-char-string
   ```
   Generate a secret: `openssl rand -hex 16`

4. **Seed events**
   ```bash
   npm run scrape
   ```

5. **Run dev server**
   ```bash
   npm run dev
   ```
   Visit [localhost:3000/events](http://localhost:3000/events)

## Deployment

```bash
npx vercel --prod
```

Add the same 3 env vars in Vercel Dashboard → Settings → Environment Variables.

The cron job (`vercel.json`) registers automatically on deploy — visible under Settings → Crons.

**Trigger first scrape manually after deploy:**
```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-site.vercel.app/api/cron/scrape
```

## Adding Event Sources

Each source implements `EventScraper`:

```ts
// src/lib/scrapers/my-scraper.ts
export class MyCalendarScraper implements EventScraper {
  name = 'my-calendar'
  async run(): Promise<LondonEvent[]> { ... }
}
```

Then add one line in `src/lib/scrapers/index.ts`:
```ts
const scrapers = [new LumaDiscoveryScraper(), new MyCalendarScraper()]
```

See `web_scraping/luma-api.md` for Luma API details (calendar and user profile endpoints).

## Project Structure

```
src/
├── app/
│   ├── events/page.tsx           # Server Component, reads from KV
│   └── api/cron/scrape/route.ts  # Cron endpoint
├── components/
│   ├── EventCard.tsx
│   ├── EventGrid.tsx             # Client, owns filter state
│   └── TagFilter.tsx
└── lib/
    ├── types.ts                  # LondonEvent interface
    ├── kv.ts                     # saveEvents / getEvents
    └── scrapers/
        ├── index.ts              # Orchestrator (add new scrapers here)
        └── luma-discovery.ts    # Luma London discovery feed
scripts/
└── scrape.ts                     # Local CLI: npm run scrape
vercel.json                       # Cron schedule (6am UTC daily)
```
