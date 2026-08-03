import Link from 'next/link'

type EntityListItem = {
  id: string
  title: string
  subtitle?: string | null
  meta?: string | null
  href: string
}

export function EntityList({
  title,
  items,
  empty,
}: {
  title: string
  items: EntityListItem[]
  empty: string
}) {
  return (
    <section className="terminal-panel p-4 space-y-4">
      <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-[var(--accent-bright)]">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">{empty}</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <Link key={item.id} href={item.href} className="border border-[var(--line)] bg-[rgba(9,13,14,0.5)] p-4 space-y-2 hover:border-[var(--line-strong)] transition-colors">
              <p className="text-sm font-semibold text-[#f0ede6]">{item.title}</p>
              {item.subtitle ? <p className="text-xs text-[var(--muted-strong)]">{item.subtitle}</p> : null}
              {item.meta ? <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">{item.meta}</p> : null}
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
