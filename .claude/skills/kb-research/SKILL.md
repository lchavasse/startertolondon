---
name: kb-research
description: Research a KB entity (space, community, person, event_series, company, vc, programme) from a minimal user-provided seed — name + notes — into a complete fact set with verified links, geocodes, and source trail. Use during the Gather/Research phase of kb-batch, before drafting the YAML. Triggers when the user says "add X" with partial info ("the Solana community in Soho", "this office at <building>", "<name> who runs <thing>") and you need to fill in addresses, social links, lead identities, Luma IDs, etc.
---

# KB Research

The user gives you a name and a few facts. You produce a complete fact set ready to drop into a `docs/kb-seeds/*.md` batch. Pair with **kb-batch** (the full pipeline) and **kb-copy** (voice for description/strapline).

## Per-kind research checklist

What to hunt down for each entity kind. Don't draft the YAML until these are filled or marked as missing.

| Kind | Required | Strongly preferred | Nice to have |
|---|---|---|---|
| `space` | name, address, **lat/lng (geocode)**, area, access_type, cost_type | website, lead/operator, photos/og:image, opening hours | linkedin, instagram, capacity |
| `community` | name, primary_area, exclusivity, lead person | website, sectors, tags, luma_user_id or luma_cal_id, sister space | size_band, founding date |
| `person` | full name, current role, at least one verified link (linkedin **or** twitter) | tags (community-builder, founder, etc.) | bio, github, website, avatar_url |
| `event_series` | name, frequency, format, free_or_paid, hosted_at (space slug) | hosted_by (person slug), under (community slug), typical_size | luma_cal_id, meetup/eventbrite ID, recurring day/time |
| `company` | name, sector, website, founder | linkedin, london_hq, based_at (space slug), founded_year | stage, tags, strapline |
| `vc` | name, sectors, stages, website | linkedin, partners (people), portfolio companies | fund stage focus, cheque size |
| `programme` | name, programme_type, cost_type, website | cohort_size, applications_open, sectors | lead person, host space |

If a "Required" field can't be found in 3 attempts, ask the user — don't guess.

## The research moves

### 1. Site fetch + meta extraction

Most websites expose name, tagline, social handles, and a logo via og: / twitter: meta tags. Always start here.

```bash
curl -sL <url> | grep -oE '<meta[^>]+(description|title|og:[a-z]+|twitter:[a-z]+)[^>]*>' | head -20
```

If the site returns 403 to curl (e.g. Cloudflare-gated, common with `*.fun`, some Webflow):

```bash
# Try with a real browser UA
curl -sL -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36" <url> | grep -oE '<meta...>'
```

If that still 403s, use **WebFetch** with a prompt like "extract tagline, social links, lead person, address, any mention of <thing>". WebFetch handles JS-rendered and bot-gated sites that curl can't.

### 2. Luma extraction — get the IDs that link to the scraper

Luma is the primary event source for starter-london. Always extract the relevant ID:

```bash
# For luma.com/<slug> (could be a user, calendar, or discovery place)
curl -sL https://luma.com/<slug> | grep -oE '"api_id":"(cal|usr|discplace)-[A-Za-z0-9]+"' | sort -u | head -5
```

The first hit on the page is usually the primary entity. `cal-` = calendar, `usr-` = user profile, `discplace-` = discovery feed.

For a **user profile** (e.g. `luma.com/user/SuperteamUK`), grab the `usr-` ID and confirm via the API:

```bash
# Returns name, twitter_handle, instagram_handle, website, plus events_hosting / events_past
curl -sL "https://api2.luma.com/user/profile/events?username=usr-XXX"
```

For a single **event** (to confirm venue, coords, host):

```bash
# url-encode the event URL
curl -sL "https://api.lu.ma/url?url=https%3A%2F%2Fluma.com%2F<event-slug>"
```

Returns `geo_address_info`, `coordinate`, `calendar_api_id`, `user_api_id`, `start_at`, `timezone`. Useful for confirming a venue when the user only gives you "they meet at X every Friday".

**Trap:** A `cal-` ID may belong to a **global** calendar that hosts events from many countries. Inspect a few events on it before linking — if you see Mumbai, Kyiv, Istanbul on the same calendar, it's a global feed and you should link the **user_api_id** (UK chapter) on the community instead, not the global cal_id.

### 3. Geocoding with Nominatim

Required on every `space`. Always include the User-Agent — Nominatim rate-limits anonymous traffic.

```bash
curl -sL "https://nominatim.openstreetmap.org/search?format=json&limit=2&q=<URL_ENCODED_ADDRESS>" \
  -A "starter-london-seed/0.1 (lachlan.chavasse@gmail.com)"
```

Fallback ladder when the full address returns `[]`:
1. Drop unit/floor numbers — `1-2 Paris Garden, London SE1 8DP` → `Paris Garden, Southwark, London`
2. Drop postcode — sometimes Nominatim's index is stale on new postcodes
3. Use building name only — `Halkin building, London`
4. Last resort: street + neighbourhood — `Strand, Covent Garden, London`

Take the first result's `lat` / `lon`. Sanity-check by looking at the `display_name` — if it returned a building 200m away, that's still close enough for a map pin.

### 4. Identity verification — finding the lead

Users often refer to community leaders by nicknames or first names ("Cap runs it", "Fatema does the events"). To get a verifiable identity:

```
WebSearch: "<community name>" "<nickname or first name>" lead founder
```

Look for:
- A podcast/blog interview that names them (e.g. Solana Compass, Medium write-ups) — most reliable
- LinkedIn profile (`uk.linkedin.com/in/<handle>`) — best identity anchor
- Their personal X handle if they have one separate from the org account

If you can verify the LinkedIn but not the personal X, **set linkedin and skip twitter** — don't paste the org's X handle on a person row. The user can msg via the org account separately.

If you can't verify a full name, drop the person entity and let the user fill it in. Don't seed `name: "Cap"` — it'll bite you later.

### 5. Area labels — match user, but flag geography errors

The kb-batch skill says "use the area label the user gives you literally." Apply that — **except** when the label is geographically wrong (user says "Soho" for Somerset House, which is on the Strand). In that case:
- Use the accurate area in the YAML
- Flag the correction in your reply so the user can override

The /explore page filters by area, so wrong labels mean wrong groupings.

### 6. Evidence trail — top of the batch markdown

Every batch file gets a Sources block at the top. Format:

```markdown
**Sources used (snapshot YYYY-MM-DD):**
- Luma user profile: <url> (api_id `usr-XXX`, twitter `<handle>`, website `<url>`)
- Sample Luma event: <url> (`<event name>`, sublocality "<X>", coords lat,lng, day/time)
- LinkedIn co page: <url> (about copy, "<exact quote of tagline>")
- Lead identified via <source>: <url>
- Geocode: <query> → lat, lng (Nominatim)
```

This is the **diff that explains what was claimed about the world**. Future-you (or another contributor) needs to be able to retrace each fact to its source. If a claim doesn't have a source, you guessed — and that's the line that'll be wrong in 6 months.

## Common research pitfalls

- **Site loads in browser but 403s curl.** Use WebFetch or curl with browser UA. Don't give up and skip the meta tags.
- **Global vs national Luma calendar.** If a `cal-XXX` ID hosts events across continents, link the user_api_id (national chapter) on the community instead.
- **Nominatim returns the wrong building.** Adjacent buildings on the same street will share lat/lng to within ~50m. That's fine for /explore; if you need precision, use the building name in the query.
- **"Cap" / "Cappy" / single-name handles.** Always cross-reference to a LinkedIn before adding a person. Nicknames decay; full names persist.
- **Area mismatch.** Trust the user but verify against the address. "Soho" + "Somerset House" don't co-occur. Flag, don't silently override.
- **Slug collisions.** Slugs are scoped per-table — `space:unicorn-mafia` and `community:unicorn-mafia` coexist fine. But within a table, two `community:plugged` rows would clobber each other. Check existing kb-seeds files before picking a slug.
- **Description vs strapline.** Don't write either during research — leave them blank or as a one-line placeholder. Hand off to **kb-copy** for voice.

## Tool selection

| Need | Tool |
|---|---|
| Page meta tags, fast | `curl -sL <url> \| grep -oE '<meta...>'` |
| Page content from a 403/JS-rendered site | `WebFetch` |
| Find a person's full name from a nickname | `WebSearch` |
| Library/framework docs (rare in KB research) | `context7` MCP |
| Address → lat/lng | Nominatim curl (above) |
| Luma IDs and event details | `api2.luma.com` and `api.lu.ma` endpoints (above) |

Reach for `WebFetch` over `curl` when the site is JS-heavy or actively bot-gated. Reach for `curl` when you want to see raw HTML/JSON and grep for specific patterns.

## Workflow when called

1. **Read the user's seed.** Pull out: name, kind(s) implied, any URLs, any nicknames, any area/address hints.
2. **Pick the entity kinds** from kb-batch's modelling rules (community-led space → space + community; venue-only pub → space with `venue-only` tag; recurring meetup → event_series under community; etc.).
3. **For each entity, run the checklist above.** Parallelise the fetches — they're independent.
4. **Produce a research summary** — bullet list of what you found per entity, with source URLs. Show the user before drafting YAML.
5. **Hand off to kb-batch** for drafting the markdown and to kb-copy for description/strapline.

Stop at the research summary. Don't draft the YAML in this skill — that's kb-batch's job. Don't write copy in this skill — that's kb-copy's job.
