# Starter London Events API

Community events in London, curated and scraped daily from Luma and other sources.

## Authentication

All requests require an API key, passed as either:

- Query parameter: `?key=YOUR_API_KEY`
- Header: `X-API-Key: YOUR_API_KEY`

**API Key:** `sldn-pk-2f8a7c3e9d1b4f6a`

## Endpoint

```
GET https://starter-london.vercel.app/api/events
```

### Query Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `key` | Yes | API key (or use `X-API-Key` header instead) |
| `curated` | No | Set to `true` to only return hand-picked events |
| `raw` | No | Set to `true` to get the internal `LondonEvent` format instead of `CalendarEvent` |

### Example Request

```bash
curl "https://starter-london.vercel.app/api/events?key=sldn-pk-2f8a7c3e9d1b4f6a"
```

### Response

```json
{
  "events": [
    {
      "id": "evt-abc123",
      "summary": "AI Meetup London",
      "description": "Hosted by AI Circle | Tags: ai, meetup",
      "location": "Shoreditch, London",
      "start": { "dateTime": "2026-03-15T18:00:00.000Z", "timeZone": "Europe/London" },
      "end": { "dateTime": "2026-03-15T21:00:00.000Z", "timeZone": "Europe/London" },
      "htmlLink": "https://lu.ma/ai-meetup",
      "externalUrl": "https://lu.ma/ai-meetup",
      "imageUrl": "https://images.lumacdn.com/...",
      "hostedByUM": false
    }
  ],
  "count": 42,
  "updatedAt": "2026-03-10T06:00:00.000Z"
}
```

Events match the `CalendarEvent` type — same shape as Google Calendar events, so they can be merged directly.

### Rate Limits

60 requests per minute. The `X-RateLimit-Remaining` header shows how many requests you have left.

### Caching

Responses are cached for 5 minutes on the CDN. Events are scraped fresh once daily at 6am UTC.

---

## Integration: Replacing community-events.yaml

If you currently load community events from a YAML file, replace `loadCommunityEventsFromYaml()` with this:

```typescript
const STARTER_API_KEY = "sldn-pk-2f8a7c3e9d1b4f6a";

async function loadCommunityEvents(): Promise<CalendarEvent[]> {
  try {
    const res = await fetch(
      `https://starter-london.vercel.app/api/events?key=${STARTER_API_KEY}`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.events ?? [];
  } catch (err) {
    console.error("Failed to fetch Starter London events:", err);
    return [];
  }
}
```

This is a drop-in replacement — same return type, same `hostedByUM: false`, same URL in `externalUrl`.

---

## Deduplication: Merging with Google Calendar Events

If you also fetch events from Google Calendar, the same event might appear in both sources (e.g. someone adds a Luma event to your Google Calendar). Use the helpers below to deduplicate.

The strategy: build a set of all URLs found in your Google Calendar events, then filter out any API events whose URL already appears. Google Calendar events always win (they may have your custom edits).

```typescript
function normalizeUrl(url: string): string {
  return url
    .replace(/\/+$/, "")
    .replace(/^https?:\/\/(www\.)?/, "")
    .toLowerCase();
}

const URL_REGEX = /https?:\/\/[^\s<>"')\]]+/g;

function deduplicateEvents(
  googleEvents: CalendarEvent[],
  apiEvents: CalendarEvent[]
): CalendarEvent[] {
  const knownUrls = new Set<string>();

  for (const e of googleEvents) {
    if (e.externalUrl) knownUrls.add(normalizeUrl(e.externalUrl));
    if (e.htmlLink) knownUrls.add(normalizeUrl(e.htmlLink));
    if (e.description) {
      for (const match of e.description.matchAll(URL_REGEX)) {
        knownUrls.add(normalizeUrl(match[0]));
      }
    }
  }

  const unique = apiEvents.filter((e) => {
    const url = e.externalUrl ?? e.htmlLink ?? "";
    return url !== "" && !knownUrls.has(normalizeUrl(url));
  });

  return [...googleEvents, ...unique];
}
```

### Putting It Together

```typescript
// Fetch both sources
const [googleEvents, communityEvents] = await Promise.all([
  fetchGoogleCalendarEvents(),  // your existing function
  loadCommunityEvents(),        // the new function above
]);

// Merge, removing duplicates
const allEvents = deduplicateEvents(googleEvents, communityEvents);
```

The merged array contains all your Google Calendar events plus any Starter London events that aren't already in your calendar. From there, your existing filter/sort logic works unchanged.
