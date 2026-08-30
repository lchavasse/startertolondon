---
name: crm-log
description: Turn a line of text about a person into a CRM contact, a timeline entry and a date to resurface them on. Triggers on "log this contact", "add X to the CRM", "met X today", "emailed X", "/crm-log", or any sentence naming a person plus something that happened with them. Hands off to the enrich-lead skill when a profile URL or more detail is wanted.
---

# CRM log

One sentence in, one contact out. `"Jason CEO of Ginkgo Bioworks - emailed today 26/08/26, keen to be updated about Deep Tech London next year"` becomes a row in `crm_contacts`, an entry on their timeline, and a `next_followup_at` six months out that surfaces on `/crm` when it comes round.

You do the reading. The script does the writing — so the same sentence run twice produces one contact with two timeline entries, never two contacts.

## The primitive

`scripts/crm-log.ts` — takes JSON, resolves identity, upserts, logs, schedules.

```bash
npm run crm:log -- entry.json
echo '{...}' | npm run crm:log -- -          # stdin (note the trailing -)
npm run crm:log -- entry.json --dry-run      # says CREATE or UPDATE without writing
```

Accepts a single object or an array.

## Fields

```json
{
  "full_name": "Jason Kelly",
  "company": "Ginkgo Bioworks",
  "role": "CEO",
  "email": "jason@ginkgobioworks.com",
  "linkedin_url": "https://linkedin.com/in/jasonkelly",
  "labels": ["sponsor", "biotech"],
  "status": "contacted",
  "note": "warm on next year, not this one",
  "owner": "Lachlan",

  "log": "emailed, keen to be updated about Deep Tech London next year",
  "kind": "outreach",
  "happened_at": "2026-08-26",

  "resurface_in": "6 months"
}
```

Only `full_name` is required.

- **`log`** is the timeline entry — what actually happened, in their words or yours. `kind` is one of `note` (default), `outreach`, `reply`, `meeting`. Use `outreach` when you contacted them and `reply` when they came back: both stamp `last_contacted_at`, `note` does not.
- **`resurface_in`** takes `"6 months"`, `"2 weeks"`, `"10 days"`, `"1 year"`, counted from `happened_at`. Use `follow_up_at` instead for a fixed date. **Never do the date arithmetic yourself** — the script does it, because a reminder that lands in the wrong month never fires.
- **`status`**: `new`, `reviewing`, `contacted`, `in_conversation`, `confirmed`, `declined`, `parked`. Changing it auto-writes a `status_change` entry to the timeline, so don't also log one by hand.
- **`labels`** are free text, lowercased. Reuse existing ones where they fit — `expo`, `speaker`, `sponsor`, `attendee`, `investor`, `community`, `press`, `hot`, `needs-reply`.
- **`source_system`**: `manual` (default) when typed, `linkedin_url` when from a pasted profile, or `people_pool` / `scanner` / `founder_candidate` / `expo_application` when pulling an existing lake row up into the working layer — pair those with `source_ref` set to that row's id so it links back rather than duplicating.

## Identity

The script resolves an existing contact before creating one, in this order: explicit `id`, then `source_system`+`source_ref`, then normalised `linkedin_url`, then `email`, then `full_name`+`company` together.

Name alone never matches. Two people called James is a certainty at this scale, and a wrong merge is worse than a duplicate. If you only have a first name, say so and ask rather than guessing.

## Enrichment

The script does not fetch anything — pass enrichment in via the `enrichment` object, which is free-form jsonb.

When a LinkedIn URL is given or the user wants more than the sentence carries,
use the **`enrich-lead`** skill — it holds the cost-ordered ladder (what we already
know → free web → `brightdata` → `apify` → Apollo → `exa-websets`) and the rules
about not spending on an unqualified lead. Do not pick a scraper straight off the
top of your head; the cheap rungs answer most questions.

Put whatever you find under `enrichment` and lift `role`, `company`, `email`, `linkedin_url` up to the real columns. Setting `enrichment` stamps `enriched_at` automatically.

## After writing

Report back what changed: created or updated, the timeline entry, and the resurface date in plain language ("back in front of you on 26 Feb 2027"). Confirm rather than assume when the sentence is ambiguous about who the person is or when the follow-up should land.

## Where it shows up

- `/crm` — the **Due to resurface** panel lists contacts whose date has arrived.
- `GET /api/crm?entity=due&days=30` — same thing for an agent or a cron, `Authorization: Bearer $CRM_AGENT_TOKEN`.
- `GET /api/crm?entity=contacts` — everything, each with its timeline.
