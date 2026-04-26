# KB Card Hierarchy — design notes

> **Status:** notes only. Not implemented. Current `fetchHighlights()` is hardcoded to space-rooted cards.

## The rule

A highlight card has one **root entity** and nests subordinate entities under it. Priority order:

1. **space** — if a featured entity has an associated space, the space is root.
2. **community** — if no space, the community is root (e.g. virtual-only or floating communities).
3. **event_series** — if neither, an event series can stand on its own.

No card is rooted on `people`, `vcs`, or `programmes` directly. Those nest under whatever the root is.

## What nests under what

| Root            | Nested sections (in order)                  |
| --------------- | ------------------------------------------- |
| `space`         | community → event_series → people → programmes |
| `community`     | event_series → people → programmes          |
| `event_series`  | people                                      |

Empty sections are omitted entirely (the card collapses naturally).

## Open questions before implementing

1. **Ambiguity when an entity has multiple parents.** A community can `lives_at` more than one space, or a programme can run at multiple spaces. Which space "owns" the card? Options: pick the first by id; add an explicit `primary` flag on the join row; let the data team curate.
2. **Multiple featured entities pointing at the same space.** If both `ramen-space` and `ramen-club` are featured, we want one card, not two. The fetcher needs a dedup pass: walk featured entities → roll up to root → emit one card per root.
3. **A featured community whose space is *not* featured.** Does the unfeatured space still get pulled in as root? Probably yes — the priority rule should win regardless of which entity flipped the `featured` bit.
4. **`vc` as a special case.** VCs aren't currently fittable into this hierarchy. Keep them out for now or add a `vc` root tier?
5. **Card type indicator.** The `[ space ]` label in the title bar would change to `[ community ]` or `[ event_series ]` depending on root. Make sure the visual still reads well when the root is non-space.

## Implementation sketch

```ts
// pseudocode
async function fetchHighlights(): Promise<HighlightCard[]> {
  // 1. Fetch all featured entities (spaces, communities, event_series)
  // 2. For each, resolve its root by walking up:
  //      space -> itself
  //      community -> first lives_at space || itself
  //      event_series -> first hosted_at space || under community || itself
  // 3. Dedup by root id
  // 4. For each root, fetch all nested entities one level deep
  // 5. Return [{ root, type, nested: { communities, eventSeries, people, programmes } }]
}
```

The card component would switch on `type` to render the right title-bar label and section order.

## When to do this

When a fourth highlight lands that can't be space-rooted — most likely a virtual community or a standalone event series. Until then the hardcoded space-rooted path is fine and keeps `fetchHighlights` simple to read.
