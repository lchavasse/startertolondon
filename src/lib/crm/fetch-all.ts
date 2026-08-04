// Supabase enforces db-max-rows (1000 by default) and truncates to it silently — a `.limit(5000)`
// returns 1000 rows with no error and nothing to say the rest exist. Any query over a table that
// can exceed a thousand rows has to page.
//
// Paging has its own trap: each .range() call is a separate query, so if the sort has ties the
// database may order them differently between calls. A tied row then lands on two pages while
// another is skipped. That produced a CSV with the right row count and the wrong people — 12
// duplicated, 12 missing. ALWAYS order by something unique (the primary key) as the last sort key.
//
// `key` is not optional in practice: pass it and the duplicate check turns a silent data error into
// a loud one.

const PAGE = 1000

interface Pageable<T> {
  range(from: number, to: number): PromiseLike<{ data: T[] | null; error: { message: string } | null }>
}

export async function fetchAllRows<T>(
  build: () => Pageable<T>,
  opts: { pageSize?: number; hardCap?: number; key?: (row: T) => string } = {},
): Promise<T[]> {
  const { pageSize = PAGE, hardCap = 50_000, key } = opts
  const out: T[] = []
  const seen = key ? new Set<string>() : null

  for (let from = 0; from < hardCap; from += pageSize) {
    const { data, error } = await build().range(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    const batch = data ?? []

    for (const row of batch) {
      if (seen && key) {
        const k = key(row)
        if (seen.has(k)) {
          throw new Error(
            `fetchAllRows: row "${k}" returned on more than one page. The query's sort is not ` +
            `deterministic — add a unique column (the primary key) as the final .order().`,
          )
        }
        seen.add(k)
      }
      out.push(row)
    }

    if (batch.length < pageSize) break
  }
  return out
}
