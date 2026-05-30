/**
 * Handle harvester for the event-highlights workflow.
 *
 * Lachlan tags heavily on X, so every past post is a labelled dataset of
 * "@handle was the right tag". This scans the `# X thread` section of every
 * post in docs/posts/ + docs/post-archive/, pulls each @handle, and merges
 * them into docs/social-handles.yml — the registry the highlights script reads
 * to pre-fill `twitter` on hosts so future drafts arrive already tagged.
 *
 * Merge is non-destructive: hand-edited `match` aliases / `linkedin` / `credit`
 * on existing entries are preserved; only `seen` / `last_seen` / `contexts`
 * get refreshed and brand-new handles get appended.
 *
 * Usage: npm run harvest-handles
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parse, stringify } from 'yaml'

const POST_DIRS = ['docs/posts', 'docs/post-archive']
const REGISTRY_PATH = 'docs/social-handles.yml'

// X handles: 1–15 chars, letters/digits/underscore. We only trust handles that
// appear in the X thread (LinkedIn @mentions are display names, not slugs).
const HANDLE_RE = /@([A-Za-z0-9_]{1,15})\b/g

interface Entry {
  x: string
  match: string[]
  linkedin?: string
  credit?: string
  seen: number
  last_seen?: string
  contexts?: string[]
}

interface Registry {
  handles: Entry[]
}

/** Extract just the `# X thread` body from a post file (stops at next `# `). */
function extractXThread(md: string): string {
  const start = md.search(/^#\s+X thread\s*$/im)
  if (start === -1) return ''
  const after = md.slice(start)
  const nextHeading = after.slice(1).search(/^#\s+/m) // skip the X-thread `#` itself
  return nextHeading === -1 ? after : after.slice(0, nextHeading + 1)
}

/** week_of date from frontmatter, for last_seen; falls back to filename. */
function weekOf(md: string, file: string): string {
  const m = md.match(/^week_of:\s*([0-9-]+)/m)
  if (m) return m[1]
  const f = file.match(/(\d{4}-\d{2}-\d{2})/)
  return f ? f[1] : file
}

function collect(): Map<string, { count: number; contexts: Set<string>; last: string }> {
  const acc = new Map<string, { count: number; contexts: Set<string>; last: string }>()

  for (const dir of POST_DIRS) {
    if (!existsSync(dir)) continue
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.md')) continue
      const md = readFileSync(join(dir, file), 'utf8')
      const thread = extractXThread(md)
      if (!thread) continue
      const week = weekOf(md, file)

      // Walk per post so we can attach a context snippet to each handle.
      for (const post of thread.split(/^---$/m)) {
        const handles = [...post.matchAll(HANDLE_RE)].map((m) => m[1])
        if (handles.length === 0) continue
        // Context = the shortest informative line in the post (usually the hook).
        const context = post
          .split('\n')
          .map((l) => l.trim())
          .find((l) => l && !l.startsWith('**') && !l.startsWith('http')) ?? ''
        for (const h of handles) {
          const key = h.toLowerCase()
          const cur = acc.get(key) ?? { count: 0, contexts: new Set<string>(), last: week }
          cur.count += 1
          if (context) cur.contexts.add(context.slice(0, 120))
          if (week > cur.last) cur.last = week
          // preserve canonical casing from first sighting via a sentinel
          acc.set(key, cur)
        }
      }
    }
  }
  return acc
}

function loadRegistry(): Registry {
  if (!existsSync(REGISTRY_PATH)) return { handles: [] }
  const parsed = parse(readFileSync(REGISTRY_PATH, 'utf8')) as Registry | null
  return parsed?.handles ? parsed : { handles: [] }
}

function main() {
  const harvested = collect()
  const registry = loadRegistry()
  const byKey = new Map(registry.handles.map((e) => [e.x.toLowerCase(), e]))

  let added = 0
  for (const [key, info] of harvested) {
    const existing = byKey.get(key)
    if (existing) {
      existing.seen = info.count
      existing.last_seen = info.last
      existing.contexts = [...info.contexts].slice(0, 3)
      // match / linkedin / credit are hand-curated — leave them alone.
    } else {
      byKey.set(key, {
        x: key,
        match: [key], // seed: the handle matches itself; add luma usernames by hand
        seen: info.count,
        last_seen: info.last,
        contexts: [...info.contexts].slice(0, 3),
      })
      added += 1
    }
  }

  const out: Registry = {
    handles: [...byKey.values()].sort((a, b) => b.seen - a.seen),
  }

  const header =
    '# Social handle registry — auto-maintained by `npm run harvest-handles`.\n' +
    '#\n' +
    '# The highlights script fills a host\'s `twitter` when the host\'s luma username\n' +
    '# or name matches an entry\'s `match` list. Seeded matches only contain the\n' +
    '# handle itself — add luma usernames / org-name tokens to `match` so future\n' +
    '# drafts auto-tag. `credit`/`linkedin` are optional display overrides.\n' +
    '#\n' +
    '# Hand edits to match/linkedin/credit are preserved on re-harvest.\n\n'

  writeFileSync(REGISTRY_PATH, header + stringify(out))
  console.log(
    `[harvest] ${harvested.size} unique handles across ${POST_DIRS.join(', ')} — ${added} new, ${out.handles.length} total → ${REGISTRY_PATH}`
  )
}

main()
