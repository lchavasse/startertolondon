import Link from 'next/link'

type UrgentItem = {
  id: string
  title: string
  meta?: string | null
  href?: string | null
}

export function UrgentList({
  title,
  empty,
  items,
}: {
  title: string
  empty: string
  items: UrgentItem[]
}) {
  return (
    <section className="terminal-panel p-4 space-y-3">
      <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-[var(--accent-bright)]">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">{empty}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="border border-[var(--line)] bg-[rgba(9,13,14,0.5)] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[#f0ede6]">{item.title}</p>
                  {item.meta ? <p className="text-xs text-[var(--muted-strong)]">{item.meta}</p> : null}
                </div>
                {item.href ? (
                  <Link href={item.href} className="font-mono text-[10px] uppercase tracking-widest text-[var(--accent-yellow)]">
                    open
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
