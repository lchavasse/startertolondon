// Supabase enforces db-max-rows (1000 by default) and silently truncates to it — a `.limit(5000)`
// returns 1000 rows with no error and no indication anything is missing. Any query over a table
// that can exceed a thousand rows must page explicitly.
//
// Found the hard way: /crm/people-pool showed 1000 of 2631 people and looked complete.

const PAGE = 1000

interface Pageable<T> {
  range(from: number, to: number): PromiseLike<{ data: T[] | null; error: { message: string } | null }>
}

export async function fetchAllRows<T>(
  build: () => Pageable<T>,
  { pageSize = PAGE, hardCap = 50_000 }: { pageSize?: number; hardCap?: number } = {},
): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; from < hardCap; from += pageSize) {
    const { data, error } = await build().range(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    const batch = data ?? []
    out.push(...batch)
    if (batch.length < pageSize) break
  }
  return out
}
