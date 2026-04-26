---
name: kb-copy
description: Write KB descriptions and straplines in starter-london's voice — short, punchy, casual. Use when editing or creating description/strapline fields in docs/kb-seeds/*.md, or any user-facing copy for KB entities (spaces, communities, vcs, programmes, people, event_series).
---

# KB Copy Style

User-facing copy in starter-london is short, punchy, casual. Match the energy of the user's own writing:

- "the cool Shoreditch house for web3 and AI builders"
- "the home for indie hackers, solopreneurs and more"
- "the community every founder wishes they had + workshops, open houses and the odd party"
- "Shoreditch pub. IndieBeers HQ."

## Rules

### Strapline — under 12 words, single line
- One beat. No "X — and Y, but also Z" stacking.
- Lowercase casual is fine. Title case is also fine. Match the surrounding entries.
- Drop corporate adjectives: emerging, leading, vibrant, innovative, premier, dynamic, bustling, thriving.
- A pithy phrase or a tight noun phrase wins.

Good: `London's indie-hacker mothership` / `Free Friday coworking at Encode Hub` / `Members-only founder coworking + workshops`
Bad: `A vibrant community for ambitious founders building tomorrow's startups today` / `The premier coworking destination in East London`

### Description — 1–2 short sentences, ~20 words total
- State the most useful fact, then the next-most-useful fact. Stop.
- Sentence fragments are fine when tighter. `Free Friday coworking. Open to the Encode Club community.` beats a comma-spliced sentence.
- Don't recap fields the reader can already see (area, address, website, exclusivity). The card shows those alongside.
- Don't synthesize ("Known for X and Y") — just state.

Good: `Encode Club's Shoreditch base. Free Friday coworking. Open for AI and web3 events.`
Bad: `Encode Hub is a vibrant coworking destination located in Shoreditch where members of the Encode Club community gather every Friday for free coworking and various AI/web3 events.`

### Tone
- Conversational, like a friend tipping you off. Not marketing. Not estate-agent.
- If the user gives a one-liner, treat it as authoritative voice. Don't "improve" it. Don't add a CTA.
- It's fine to be a bit cheeky if the entity has personality.

## Anti-patterns

- ❌ Three-clause sentences with subordinate clauses
- ❌ Corporate vocabulary (vibrant, ambitious, premier, leading, innovative)
- ❌ Repeating area/address/website that's already in adjacent fields
- ❌ "Whether you're X or Y, this is the place for Z"
- ❌ "Known for...", "Famous for...", "Widely regarded as..."

## When to apply

**Use this skill when:**
- Editing or creating any `description:` or `strapline:` field in `docs/kb-seeds/*.md`
- Writing copy for any user-facing KB content (entity cards on /explore, /guide ranking output)
- Asked to rewrite an existing KB entry's copy

**Don't apply to:**
- Internal docs (CLAUDE.md, brainstorm requirements, plan docs) — those use normal prose
- Chat replies — keep conversational tone there as usual
- Field values that aren't user-facing prose (slugs, tags, addresses)

## Workflow when called

1. Look at the entity's other fields (name, area, sectors) — don't repeat them in the description.
2. Identify the 1–2 most useful facts a reader would want at the card-skim level.
3. Draft strapline first (under 12 words). Then description (1–2 fragments).
4. Read it back. If it sounds like a brochure, rewrite shorter.
5. If unsure between two versions, pick the shorter.
