---
title: Next.js Server Component → Client Component Supabase KB Pattern
problem_type: best_practice
component: development_workflow
root_cause: inadequate_documentation
resolution_type: documentation_update
severity: medium
category: best-practices
date: 2026-03-26
tags:
  - next-js
  - supabase
  - server-components
  - admin-auth
  - tagged-union
  - git-workflow
  - typescript
---

# Next.js Server Component → Client Component Supabase KB Pattern

## Problem

Wiring a Supabase knowledge base into a Next.js App Router page requires coordinating several non-obvious patterns: async Server Component data fetching, typed entity unions, client-side filtering with optimistic updates, and a sessionStorage-based admin edit flow. Getting any one of these wrong produces type errors, stale data, or broken auth.

## Symptoms

During implementation, the following concrete issues surfaced:

1. **Build error**: `Cannot find module '@vercel/analytics/next'` — package missing from node_modules despite being imported after a branch merge
2. **Git rebase stall**: `git checkout --theirs <file>` reported "Updated 0 paths from the index" when files were already partially staged from a prior interrupted session
3. **Write tool rejection**: Tool refused to overwrite a file that had been read via Bash `cat` rather than the Read tool — the precondition was not satisfied
4. **TypeScript type mismatch**: `'programme'` not assignable to `GuideCategory` (`'space' | 'community' | 'company'`) — programmes were a first-class KB type but `GuideCategory` hadn't been updated

## What Didn't Work

- **`git checkout --theirs` for conflict resolution** when index state is already partial: succeeds silently but does nothing. Must use `git add` directly.
- **Reading files with Bash `cat` before editing**: The Write tool tracks file reads via the Read tool only — Bash does not satisfy the precondition.
- **Silent type cast for `GuideCategory` mismatch**: Mapping `programme` to `'community'` compiles but hides a domain model inconsistency. Left as P2 tech debt for human resolution.

## Solution

### 1. Data layer: typed KB entities with discriminant union

```typescript
// src/lib/kb.ts
export interface KBSpace {
  _type: 'space'
  id: string
  name: string
  strapline: string | null
  description: string | null
  area: string | null
  access_type: string | null
  crowd_tags: string[] | null
  tags: string[] | null
  cover_image: string | null
  website: string | null
  featured: boolean | null
}
// KBCommunity, KBVC, KBProgramme — same shape, different _type

export type KBEntity = KBSpace | KBCommunity | KBVC | KBProgramme
export type KBEntityType = KBEntity['_type']

// Parallel fetch — add _type discriminant on read
export async function fetchAllKBEntities() {
  const [spacesRes, communitiesRes, vcsRes, programmesRes] = await Promise.all([
    supabase.from('spaces').select('id, slug, name, strapline, description, area, access_type, crowd_tags, tags, cover_image, website, featured').order('name'),
    supabase.from('communities').select('id, slug, name, strapline, description, primary_area, exclusivity, sectors, tags, cover_image, website, featured').order('name'),
    supabase.from('vcs').select('id, slug, name, strapline, description, sectors, tags, cover_image, website, featured, london_team').order('name'),
    supabase.from('programmes').select('id, slug, name, strapline, description, programme_type, cost_type, sectors, tags, cover_image, website, featured, applications_open').order('name'),
  ])
  return {
    spaces: (spacesRes.data ?? []).map((s) => ({ _type: 'space' as const, ...s })),
    communities: (communitiesRes.data ?? []).map((c) => ({ _type: 'community' as const, ...c })),
    vcs: (vcsRes.data ?? []).map((v) => ({ _type: 'vc' as const, ...v })),
    programmes: (programmesRes.data ?? []).map((p) => ({ _type: 'programme' as const, ...p })),
  }
}
```

### 2. Server Component → Client Component data-passing pattern

```typescript
// src/app/explore/page.tsx — Server Component
export const dynamic = 'force-dynamic'   // always hit Supabase, no ISR cache

export default async function ExplorePage() {
  const { spaces, communities, vcs, programmes } = await fetchAllKBEntities()
  const availableSectors = deriveSectors({ spaces, communities, vcs, programmes })
  return (
    <main>
      <AppNav />
      <ExploreGrid
        spaces={spaces}
        communities={communities}
        vcs={vcs}
        programmes={programmes}
        availableSectors={availableSectors}
      />
    </main>
  )
}

// src/components/ExploreGrid.tsx — Client Component
// Receives data as props, manages filter state locally
export function ExploreGrid({ spaces, communities, vcs, programmes, availableSectors }: ExploreGridProps) {
  const allEntities: KBEntity[] = [...spaces, ...communities, ...vcs, ...programmes]
  const [activeType, setActiveType] = useState<KBEntityType | 'all'>('all')
  const [activeSectors, setActiveSectors] = useState<string[]>([])
  const [entities, setEntities] = useState<KBEntity[]>(allEntities)  // allows optimistic updates
  // ...filter logic in useMemo...
}
```

### 3. Admin auth pattern (sessionStorage → header → env var)

```typescript
// Client: read from sessionStorage, send as custom header
const adminKey = typeof window !== 'undefined' ? sessionStorage.getItem('admin-key') : ''
await fetch('/api/admin/kb', {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-admin-key': adminKey ?? '' },
  body: JSON.stringify({ entityType, id, fields }),
})

// On 401 — clear the stored key immediately
if (res.status === 401) {
  try { sessionStorage.removeItem('admin-key') } catch { /* ignore */ }
  setError('Admin key invalid.')
  setSaving(false)
  return
}

// API route: compare against env var
function isAuthorized(req: NextRequest): boolean {
  return req.headers.get('x-admin-key') === process.env.ADMIN_SECRET
}

// Startup warning if env var unset
if (!process.env.ADMIN_SECRET) {
  console.warn('ADMIN_SECRET is not set — admin KB API will reject all requests')
}

// ALLOWED_TABLES: use `satisfies` to get type-checking without losing literal types
const ALLOWED_TABLES = {
  space: 'spaces',
  community: 'communities',
  vc: 'vcs',
  programme: 'programmes',
} as const satisfies Record<KBEntityType, string>
```

### 4. Service-role client for mutations (never the anon client)

```typescript
// src/app/api/admin/kb/route.ts
function getServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
// Use service role to bypass RLS for admin mutations.
// Log DB errors server-side; return generic message to client.
if (error) {
  console.error('KB update error:', error.message)
  return NextResponse.json({ error: 'Update failed.' }, { status: 500 })
}
```

### 5. sessionStorage try/catch (SSR safety)

```typescript
// Any component that reads sessionStorage at init time
const [adminMode] = useState<boolean>(() => {
  if (typeof window === 'undefined') return false
  try {
    return !!sessionStorage.getItem('admin-key')
  } catch {
    return false   // private browsing or storage blocked
  }
})
```

### 6. Env var assertions (fail fast)

```typescript
// src/lib/supabase.ts
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!supabaseUrl) throw new Error('Missing env var: NEXT_PUBLIC_SUPABASE_URL')
if (!supabaseAnonKey) throw new Error('Missing env var: NEXT_PUBLIC_SUPABASE_ANON_KEY')
```

### 7. Git rebase with partially-staged files

When `git checkout --theirs <file>` reports "Updated 0 paths from the index", the index already has entries from a prior partial resolution. Fix:

```bash
# Stage files directly — don't use checkout --theirs/--ours
git add src/components/EventCard.tsx src/components/EventGrid.tsx src/app/events/page.tsx
# etc. for each conflicted file you've resolved manually

git rebase --continue   # now succeeds
```

## Why This Works

**Tagged union discriminant**: Each entity type carries `_type`, enabling exhaustive TypeScript narrowing without casts. Adding a new entity type to the union immediately surfaces unhandled cases as compile errors.

**Server → Client split**: Fetching data server-side keeps the initial render fast and correct. The Client Component receives immutable prop data, owns local filter state, and handles optimistic updates — this is the right boundary for App Router.

**`force-dynamic`**: Without it, Next.js may ISR-cache the page and serve stale KB data. KB pages are curated and frequently edited, so always-dynamic is correct.

**Admin auth via env var**: sessionStorage key survives page reloads but not cross-origin leaks. The env-var comparison happens server-side only, meaning key rotation takes effect on next deploy without client changes. Clearing on 401 prevents an invalid key from being silently retried on every mutation.

**`satisfies` assertion on ALLOWED_TABLES**: `as const satisfies Record<KBEntityType, string>` gives you literal type inference (so `.space` narrows to `'spaces'` not `string`) while also type-checking that every `KBEntityType` is covered.

## Prevention

**1. Read tool before Write — always**
The Write tool validates that a file was read in the current session via the Read tool. Bash `cat`/`head`/`tail` do not count. Always use the Read tool before any edit or overwrite operation.

**2. `git add` over `git checkout --theirs` for rebase conflicts**
Resolve each conflicted file manually, then stage with `git add <file>`. `git checkout --theirs` silently no-ops when the index already has an entry. Use `git status` to verify all conflicts are resolved before `git rebase --continue`.

**3. Validate env vars at startup, not at call site**
Throw at module initialisation time. A missing `NEXT_PUBLIC_SUPABASE_URL` should blow up the server on boot, not produce a cryptic Supabase error on the first request.

**4. Use `sessionStorage` try/catch everywhere**
Private-browsing mode and certain browser policies throw on `sessionStorage` access. Wrap in try/catch and default to `false` — the UI degrades gracefully.

**5. Return generic error messages from API routes**
Log the specific Supabase error server-side; return only `"Update failed."` to the client. This prevents leaking table names, column names, or constraint details to the browser.

**6. Flag type mismatches as explicit tech debt**
When a domain type (`GuideCategory`) is missing a value (`'programme'`), don't silently cast. Mark the workaround in code with a comment and file a P2 finding for human decision. Silence here causes downstream confusion.

**7. `AppNav` active state: use `startsWith`, not `===`**
`pathname === '/explore'` breaks if the user lands on `/explore/something`. Use `pathname.startsWith('/explore')` to handle nested routes correctly.

## Related

- Origin brainstorm: `docs/brainstorms/2026-03-25-kb-explore-ui-requirements.md`
- Implementation plan: `docs/plans/2026-03-25-001-feat-kb-explore-guide-live-data-plan.md`
- Events page for Server Component reference pattern: `src/app/events/page.tsx`
- Admin auth established in earlier admin route: `src/app/api/admin/route.ts`
