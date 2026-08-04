'use client'

import { useMemo, useState, useRef, useCallback } from 'react'
import { CRM_PILLARS, CRM_PEOPLE_GROUPS, GROUP_LABELS, type CrmPoolPerson } from '@/lib/crm/pillars'

// Saves are optimistic and per-field: the row updates immediately and the write goes out behind it,
// because waiting on a round trip before showing a tick makes bulk shortlisting unusable. A failed
// save rolls the row back and says so rather than leaving a lie on screen.

type Filters = {
  groups: Set<string>
  pillars: Set<string>
  route: Set<string>
  q: string
}

const ROUTE_FILTERS: Array<[string, string]> = [
  ['talked', 'in conversation'],
  ['conn', 'connection'],
  ['cold', 'not connected'],
  ['owe', 'you owe a reply'],
  ['london', 'London'],
  ['picked', 'shortlisted'],
  ['flagged', 'has a note'],
  ['physical', 'builds physical'],
]

export function PeoplePool({ people: initial }: { people: CrmPoolPerson[] }) {
  const [people, setPeople] = useState(initial)
  const [filters, setFilters] = useState<Filters>({ groups: new Set(), pillars: new Set(), route: new Set(), q: '' })
  const [shown, setShown] = useState(200)
  const [failed, setFailed] = useState<string | null>(null)
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const save = useCallback(async (slug: string, patch: Record<string, unknown>, revert: Partial<CrmPoolPerson>) => {
    try {
      const res = await fetch('/api/crm/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, ...patch }),
      })
      if (!res.ok) throw new Error(String(res.status))
      setFailed(null)
    } catch {
      setPeople((prev) => prev.map((p) => (p.slug === slug ? { ...p, ...revert } : p)))
      setFailed('Could not save that change — it has been rolled back.')
    }
  }, [])

  const patchLocal = (slug: string, patch: Partial<CrmPoolPerson>) =>
    setPeople((prev) => prev.map((p) => (p.slug === slug ? { ...p, ...patch } : p)))

  const toggleShortlist = (p: CrmPoolPerson) => {
    patchLocal(p.slug, { shortlisted: !p.shortlisted })
    save(p.slug, { shortlisted: !p.shortlisted }, { shortlisted: p.shortlisted })
  }

  const setNote = (p: CrmPoolPerson, note: string) => {
    patchLocal(p.slug, { note })
    clearTimeout(timers.current[p.slug])
    // Debounced: a note is typed a character at a time and every keystroke must not be a request.
    timers.current[p.slug] = setTimeout(() => save(p.slug, { note }, { note: p.note }), 600)
  }

  const setGroup = (p: CrmPoolPerson, event_group: string) => {
    patchLocal(p.slug, { event_group, corrected: true })
    save(p.slug, { event_group }, { event_group: p.event_group, corrected: p.corrected })
  }

  const togglePillar = (p: CrmPoolPerson, pillar: string) => {
    const next = p.pillars.includes(pillar) ? p.pillars.filter((x) => x !== pillar) : [...p.pillars, pillar]
    patchLocal(p.slug, { pillars: next, corrected: true })
    save(p.slug, { pillars: next }, { pillars: p.pillars, corrected: p.corrected })
  }

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase()
    return people.filter((p) => {
      if (filters.groups.size && !filters.groups.has(p.event_group)) return false
      if (filters.pillars.size && !p.pillars.some((x) => filters.pillars.has(x))) return false
      if (filters.route.size) {
        const checks: Record<string, boolean> = {
          talked: Boolean(p.last_message_at),
          conn: !p.last_message_at && p.is_connection,
          cold: !p.last_message_at && !p.is_connection,
          owe: p.awaiting_reply_from === 'lachlan',
          london: /London/i.test(p.location ?? ''),
          picked: p.shortlisted,
          flagged: Boolean(p.note),
          physical: p.is_physical === true,
        }
        for (const f of filters.route) if (!checks[f]) return false
      }
      if (q) {
        const hay = `${p.full_name ?? ''} ${p.company ?? ''} ${p.note ?? ''} ${p.scanner_sector ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [people, filters])

  const counts = useMemo(() => ({
    shortlisted: people.filter((p) => p.shortlisted).length,
    flagged: people.filter((p) => p.note).length,
    corrected: people.filter((p) => p.corrected).length,
  }), [people])

  const toggle = (bucket: 'groups' | 'pillars' | 'route', key: string) =>
    setFilters((f) => {
      const next = new Set(f[bucket])
      next.has(key) ? next.delete(key) : next.add(key)
      setShown(200)
      return { ...f, [bucket]: next }
    })

  const exportUrl = () => {
    const params = new URLSearchParams()
    if (filters.groups.size === 1) params.set('group', [...filters.groups][0])
    if (filters.pillars.size === 1) params.set('pillar', [...filters.pillars][0])
    if (filters.route.has('picked')) params.set('shortlisted', '1')
    if (filters.route.has('flagged')) params.set('flagged', '1')
    return `/api/crm/people/export?${params.toString()}`
  }

  const chip = (active: boolean) =>
    `font-mono text-[11px] border px-2 py-1 transition-colors ${
      active
        ? 'bg-[var(--accent-yellow)] text-black border-[var(--accent-yellow)] font-semibold'
        : 'border-[var(--line)] text-[var(--muted-strong)] hover:text-[#f0ede6]'
    }`

  return (
    <div className="space-y-4">
      {failed ? (
        <p className="border border-[#ff6b6b] bg-[rgba(255,107,107,0.08)] p-3 font-mono text-xs text-[#ff9d9d]">{failed}</p>
      ) : null}

      <section className="terminal-panel space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-16 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Group</span>
          {CRM_PEOPLE_GROUPS.filter((g) => g !== 'none').map((g) => {
            const n = people.filter((p) => p.event_group === g).length
            if (!n) return null
            return (
              <button key={g} type="button" onClick={() => toggle('groups', g)} className={chip(filters.groups.has(g))} aria-pressed={filters.groups.has(g)}>
                {GROUP_LABELS[g] ?? g} <span className="opacity-60">{n}</span>
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="w-16 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Pillar</span>
          {CRM_PILLARS.map((x) => {
            const n = people.filter((p) => p.pillars.includes(x)).length
            return (
              <button key={x} type="button" onClick={() => toggle('pillars', x)} className={chip(filters.pillars.has(x))} aria-pressed={filters.pillars.has(x)}>
                {x.replace(/_/g, ' ')} <span className="opacity-60">{n}</span>
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="w-16 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Filter</span>
          {ROUTE_FILTERS.map(([k, lbl]) => (
            <button key={k} type="button" onClick={() => toggle('route', k)} className={chip(filters.route.has(k))} aria-pressed={filters.route.has(k)}>
              {lbl}
            </button>
          ))}
          <input
            type="search"
            value={filters.q}
            onChange={(e) => { setFilters((f) => ({ ...f, q: e.target.value })); setShown(200) }}
            placeholder="name, company, note…"
            aria-label="Search"
            className="border border-[var(--line)] bg-[rgba(9,13,14,0.5)] px-3 py-1.5 font-mono text-xs text-[#f0ede6] placeholder:text-[var(--muted)]"
          />
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3 border border-[var(--line)] bg-[rgba(9,13,14,0.5)] p-3">
        <span className="font-mono text-sm text-[var(--accent-bright)]">{filtered.length}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">showing</span>
        <span className="font-mono text-sm text-[var(--accent-yellow)]">{counts.shortlisted}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">shortlisted</span>
        <span className="font-mono text-sm text-[#ffb020]">{counts.flagged}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">flagged</span>
        <span className="font-mono text-sm text-[var(--muted-strong)]">{counts.corrected}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">corrected</span>
        <a href={exportUrl()} className="ml-auto border border-[var(--accent-yellow)] px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-[var(--accent-yellow)] hover:bg-[var(--accent-yellow)] hover:text-black">
          Download CSV
        </a>
        <a href="/api/crm/people/export?shortlisted=1" className="border border-[var(--line)] px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-[var(--muted-strong)] hover:text-[#f0ede6]">
          Shortlist only
        </a>
      </div>

      <div className="overflow-x-auto border border-[var(--line)]">
        <table className="w-full min-w-[1000px] border-collapse">
          <thead>
            <tr className="border-b border-[var(--line)] bg-[rgba(9,13,14,0.6)] text-left">
              {['', 'Person', 'Group', 'Pillars', 'Location', 'Route', 'Fit', 'Note'].map((h) => (
                <th key={h} className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--muted)]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, shown).map((p) => (
              <tr key={p.slug} className={`border-b border-[var(--line)] align-top ${p.shortlisted ? 'bg-[rgba(200,255,0,0.06)]' : ''}`}>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={p.shortlisted}
                    onChange={() => toggleShortlist(p)}
                    aria-label={`Shortlist ${p.full_name ?? 'person'}`}
                    className="h-4 w-4 accent-[var(--accent-yellow)]"
                  />
                </td>
                <td className="px-3 py-2">
                  <a href={p.profile_url} target="_blank" rel="noopener" className="text-sm font-semibold text-[#f0ede6] hover:text-[var(--accent-yellow)]">
                    {p.full_name ?? '—'}
                  </a>
                  <div className="text-xs text-[var(--muted-strong)]">{p.company ?? '—'}</div>
                  {p.evidence ? <div className="mt-1 max-w-[42ch] text-[11px] text-[var(--muted)]">{p.evidence}</div> : null}
                </td>
                <td className="px-3 py-2">
                  <select
                    value={p.event_group}
                    onChange={(e) => setGroup(p, e.target.value)}
                    aria-label={`Group for ${p.full_name ?? 'person'}`}
                    className="border border-[var(--line)] bg-[rgba(9,13,14,0.5)] px-1 py-0.5 font-mono text-[11px] text-[var(--accent-yellow)]"
                  >
                    {CRM_PEOPLE_GROUPS.map((g) => <option key={g} value={g}>{GROUP_LABELS[g] ?? g}</option>)}
                  </select>
                  {p.corrected ? <div className="mt-1 font-mono text-[9px] uppercase tracking-widest text-[#ffb020]">corrected</div> : null}
                </td>
                <td className="px-3 py-2">
                  <details>
                    <summary className="cursor-pointer list-none">
                      {p.pillars.length
                        ? p.pillars.map((x) => <span key={x} className="mr-1 inline-block border border-[var(--line)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--muted-strong)]">{x.replace(/_/g, ' ')}</span>)
                        : <span className="font-mono text-[10px] text-[var(--muted)]">set pillars</span>}
                    </summary>
                    <div className="mt-2 grid grid-cols-2 gap-x-3 border border-[var(--line)] bg-[rgba(9,13,14,0.8)] p-2">
                      {CRM_PILLARS.map((x) => (
                        <label key={x} className="flex cursor-pointer items-center gap-1.5 font-mono text-[10px] text-[var(--muted-strong)]">
                          <input type="checkbox" checked={p.pillars.includes(x)} onChange={() => togglePillar(p, x)} className="h-3 w-3 accent-[var(--accent-yellow)]" />
                          {x.replace(/_/g, ' ')}
                        </label>
                      ))}
                    </div>
                  </details>
                </td>
                <td className="px-3 py-2 font-mono text-[11px] text-[var(--muted-strong)]">
                  {(p.location ?? '—').replace(', United Kingdom', '')}
                </td>
                <td className="px-3 py-2 font-mono text-[11px]">
                  <span className={p.last_message_at ? 'text-[#4fd1c5]' : p.is_connection ? 'text-[var(--accent-bright)]' : 'text-[var(--muted)]'}>
                    {p.last_message_at ? `talked ${p.last_message_at.slice(0, 10)}` : p.is_connection ? 'connection' : 'not connected'}
                  </span>
                  {p.awaiting_reply_from === 'lachlan' ? (
                    <div className="mt-1 inline-block border border-[#ffb020] px-1 font-mono text-[9px] uppercase tracking-widest text-[#ffb020]">you owe a reply</div>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  <div className="font-mono text-sm font-semibold text-[var(--accent-yellow)]">{p.fit}</div>
                  {p.scanner_sector ? <div className="mt-0.5 max-w-[22ch] font-mono text-[10px] text-[var(--muted)]">{p.scanner_sector}</div> : null}
                  {p.is_physical ? <div className="font-mono text-[10px] text-[#4fd1c5]">physical</div> : null}
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    defaultValue={p.note ?? ''}
                    onChange={(e) => setNote(p, e.target.value)}
                    placeholder="flag…"
                    aria-label={`Note for ${p.full_name ?? 'person'}`}
                    className={`w-full min-w-[130px] border-b bg-transparent px-1 py-1 font-mono text-[11px] ${
                      p.note ? 'border-[#ffb020] text-[#ffb020]' : 'border-[var(--line)] text-[#f0ede6]'
                    }`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length ? <p className="p-8 text-center text-sm text-[var(--muted)]">No one matches those filters.</p> : null}
      </div>

      {filtered.length > shown ? (
        <div className="flex justify-center">
          <button type="button" onClick={() => setShown((s) => s + 300)} className="border border-[var(--line)] px-5 py-2 font-mono text-xs text-[var(--muted-strong)] hover:border-[var(--accent-yellow)] hover:text-[var(--accent-yellow)]">
            Show more ({filtered.length - shown} hidden)
          </button>
        </div>
      ) : null}
    </div>
  )
}
