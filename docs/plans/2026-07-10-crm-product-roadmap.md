# DeepTech London CRM Product Roadmap

Goal: turn starter-london CRM from a passive import bucket into an operator-grade system that materially increases Lachlan and Barrett's throughput on speakers, sponsors, outreach, and follow-up.

Core product thesis:
- The product should not be "a place records go to die".
- It should answer, every day:
  - who matters now?
  - what should we do next?
  - who should we contact?
  - how do we contact them?
  - what did we already try?
  - what are we missing on speakers/topics/sponsors?

Non-goals for now:
- enterprise permissions theatre
- pretty dashboards with no workflow value
- over-automated enrichment before core operator flows exist

---

## Product pillars

### 1. Opportunity-centric workbench
Every sponsor, speaker, topic, expo, or partner thread needs a real page with:
- status
- owner
- next action
- next due date
- linked people
- linked organisations
- contact routes
- outreach history
- notes and provenance

This is the immediate build priority.

### 2. Sponsor prospecting engine
For each sponsor org, the system should support:
- target account page
- likely buyer roles to pursue
- discovered contacts
- best channel per contact
- outreach cadence
- reply/no-reply state
- suggested next move

This turns sponsor work from vague spreadsheet rummaging into a queue.

### 3. Topic and speaker intelligence
For each topic, the system should support:
- topic brief
- current suggested speakers
- backup speakers
- quality/confidence notes
- source/provenance
- gaps: not enough women, not enough founders, not enough operators, etc.

This stops speaker sourcing from restarting from zero each time.

### 4. Daily operator console
Each day, Lachlan and Barrett should get:
- top sponsor follow-ups
- top speaker asks
- stale items needing decision
- missing-contact research queue
- today's concrete outreach tasks

This is the actual 10x surface.

---

## Build order

## Phase 1 — Fix the foundations that block real work
Status: in progress

Ship:
- real opportunity detail pages
- contact points
- outreach logs
- working links from dashboard and boards
- quick-add forms for outreach and contact capture

Success condition:
- you can open a sponsor opportunity, add a contact, log outreach, and set next action in under 60 seconds

## Phase 2 — Sponsor account workflow

Add:
- sponsor pipeline view with filters:
  - no contacts
  - no outreach yet
  - waiting on reply
  - stale > 7 days
- sponsor target checklist:
  - ideal roles to find
  - contact count
  - last outreach
  - next due
- company detail page sections for:
  - why they fit
  - warm routes
  - objection notes
  - proposed package / ask

Success condition:
- we can run sponsor outreach from the product without consulting the old sheet

## Phase 3 — Speaker/topic system

Add:
- workstream-specific opportunity types for topics and speakers
- topic pages with linked speaker candidates
- speaker candidate scoring fields:
  - fit to topic
  - stage presence confidence
  - warm intro availability
  - status (idea/contacted/interested/booked/passed)
- suggestion capture from research/imports/notes

Success condition:
- for any event theme, the product can show a usable longlist and a serious shortlist

## Phase 4 — Research and enrichment workflows

Add:
- research queue for companies with no contacts
- research queue for topics with thin candidate pools
- browser-assisted enrichment workflow to capture:
  - website
  - LinkedIn
  - role/title
  - contact route
  - source URL
- suggested email pattern / outreach route notes

Success condition:
- the system actively helps discover who to contact, instead of waiting for manual entry forever

## Phase 5 — Daily/weekly work packaging

Add:
- Today page with ranked work package for Lachlan and Barrett
- weekly review surface:
  - stale opps
  - no-next-action opps
  - no-owner opps
  - no-contact sponsor targets
  - thin topic coverage
- generated action bundles like:
  - "Contact these 5 sponsor targets"
  - "Research contacts for these 3 orgs"
  - "Source 8 more speakers for robotics"

Success condition:
- the CRM becomes the first tab to open in the morning because it is genuinely useful, not because we are pretending to be organised

---

## Data model direction

Needed entities beyond current base:
- crm_contact_points
- crm_outreach_entries
- possibly crm_topic_candidates
- possibly crm_research_tasks
- maybe crm_playbooks later, but not yet

Important principle:
- provenance stays first-class
- user notes outrank scraped fluff
- structure should support action, not ceremony

---

## UX principles

- One-click navigation to the thing that matters
- Fast inline capture
- Minimal required fields
- Defaults that match real work
- Lists sorted by urgency and missingness, not alphabet soup

Key ranking heuristics:
- stale with no next action
- overdue next due date
- sponsor org with zero contacts
- topic with too few speaker candidates
- outreach sent with no reply after threshold

---

## The actual 10x outcomes we want

1. Sponsor work becomes a queue, not a scavenger hunt
2. Speaker sourcing compounds over time instead of resetting each week
3. Outreach history is visible, so we stop duplicating or forgetting
4. Daily priorities are generated from the data, not reconstructed from memory
5. Lachlan/Barrett can split work cleanly without ball-dropping

---

## Immediate next implementation slice

Do now:
- finish opportunity detail route
- finish contact-point schema/API/UI
- finish outreach-log schema/API/UI
- wire dashboard open links to real pages
- verify end-to-end

Then immediately after:
- build sponsor pipeline filters
- build company account page improvements
- add topic/speaker candidate model

This is the right order. Anything else is decorative cowardice.
