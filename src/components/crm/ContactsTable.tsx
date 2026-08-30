'use client'

import { Fragment, useCallback, useMemo, useRef, useState } from 'react'
import { postContact, postContactEvent } from '@/lib/crm/contact-client'
import {
  CRM_CONTACT_STATUSES,
  CONTACT_STATUS_LABELS,
  CONTACT_LABEL_SUGGESTIONS,
  type CrmContact,
  type CrmContactEvent,
  type CrmContactStatus,
} from '@/lib/crm/contacts'

// Every active lead, whatever lake it came from. The expo grid is this with one filter applied and
// the application form alongside; this is the plain sheet.

type ContactWithEvents = CrmContact & { events: CrmContactEvent[] }

const STATUS_COLOURS: Record<CrmContactStatus, string> = {
  new: 'text-[var(--muted)]',
  reviewing: 'text-[#ffb020]',
  contacted: 'text-[var(--accent-bright)]',
  in_conversation: 'text-[#4fd1c5]',
  confirmed: 'text-[var(--accent-yellow)]',
  declined: 'text-[#ff9d9d]',
  parked: 'text-[var(--muted)]',
}

const SOURCE_LABELS: Record<string, string> = {
  expo_application: 'expo form',
  waitlist: 'waitlist',
  people_pool: 'LinkedIn pool',
  scanner: 'scanner',
  founder_candidate: 'scanner founder',
  linkedin_url: 'pasted URL',
  manual: 'typed in',
}

const SORTS: Array<[string, string]> = [
  ['recent', 'recently updated'],
  ['due', 'follow-up soonest'],
  ['name', 'name A–Z'],
  ['company', 'company A–Z'],
]

export function ContactsTable({ contacts: initial }: { contacts: ContactWithEvents[] }) {
  const [contacts, setContacts] = useState(initial)
  const [failed, setFailed] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [sort, setSort] = useState('recent')
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set())
  const [labelFilter, setLabelFilter] = useState<Set<string>>(new Set())
  const [sourceFilter, setSourceFilter] = useState<Set<string>>(new Set())
  const [dueOnly, setDueOnly] = useState(false)
  const [q, setQ] = useState('')
  const [draft, setDraft] = useState<Record<string, string>>({})
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const patchLocal = (id: string, patch: Partial<ContactWithEvents>) =>
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))

  const save = useCallback(async (contact: ContactWithEvents, patch: Record<string, unknown>, revert: Partial<CrmContact>) => {
    try {
      await postContact({
        id: contact.id,
        full_name: contact.full_name,
        source_system: contact.source_system,
        source_ref: contact.source_ref,
        ...patch,
      })
      setFailed(null)
    } catch (error) {
      patchLocal(contact.id, revert)
      setFailed(error instanceof Error ? error.message : 'Could not save that change — it has been rolled back.')
    }
  }, [])

  const setStatus = (c: ContactWithEvents, status: string) => {
    patchLocal(c.id, { status: status as CrmContactStatus })
    void save(c, { status }, { status: c.status })
  }

  const toggleLabel = (c: ContactWithEvents, label: string) => {
    const next = c.labels.includes(label) ? c.labels.filter((l) => l !== label) : [...c.labels, label]
    patchLocal(c.id, { labels: next })
    void save(c, { labels: next }, { labels: c.labels })
  }

  const setNote = (c: ContactWithEvents, note: string) => {
    patchLocal(c.id, { note })
    clearTimeout(timers.current[c.id])
    timers.current[c.id] = setTimeout(() => void save(c, { note }, { note: c.note }), 700)
  }

  const setFollowUp = (c: ContactWithEvents, value: string) => {
    const next = value ? new Date(value).toISOString() : null
    patchLocal(c.id, { next_followup_at: next })
    void save(c, { next_followup_at: next }, { next_followup_at: c.next_followup_at })
  }

  const addEvent = async (c: ContactWithEvents, body: string, kind: string) => {
    try {
      const saved = await postContactEvent({ contact_id: c.id, body, kind })
      setContacts((prev) => prev.map((x) => (x.id === c.id ? { ...x, events: [saved, ...x.events] } : x)))
      setDraft((d) => ({ ...d, [c.id]: '' }))
      setFailed(null)
    } catch (error) {
      setFailed(error instanceof Error ? error.message : 'Could not add that timeline entry.')
    }
  }

  const allLabels = useMemo(() => [...new Set([...contacts.flatMap((c) => c.labels), ...CONTACT_LABEL_SUGGESTIONS])], [contacts])
  const allSources = useMemo(() => [...new Set(contacts.map((c) => c.source_system))], [contacts])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const now = Date.now()
    const filtered = contacts.filter((c) => {
      if (statusFilter.size && !statusFilter.has(c.status)) return false
      if (sourceFilter.size && !sourceFilter.has(c.source_system)) return false
      if (labelFilter.size && !c.labels.some((l) => labelFilter.has(l))) return false
      if (dueOnly && !(c.next_followup_at && new Date(c.next_followup_at).getTime() <= now)) return false
      if (needle) {
        const hay = `${c.full_name} ${c.company ?? ''} ${c.role ?? ''} ${c.note ?? ''} ${c.labels.join(' ')} ${c.email ?? ''}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
    return filtered.sort((a, b) => {
      if (sort === 'name') return a.full_name.localeCompare(b.full_name)
      if (sort === 'company') return (a.company ?? '').localeCompare(b.company ?? '')
      if (sort === 'due') {
        // Nulls last: a contact with no date set is not more urgent than one with a date.
        if (!a.next_followup_at) return b.next_followup_at ? 1 : 0
        if (!b.next_followup_at) return -1
        return a.next_followup_at.localeCompare(b.next_followup_at)
      }
      return b.updated_at.localeCompare(a.updated_at)
    })
  }, [contacts, statusFilter, sourceFilter, labelFilter, dueOnly, q, sort])

  const dueCount = useMemo(
    () => contacts.filter((c) => c.next_followup_at && new Date(c.next_followup_at).getTime() <= Date.now()).length,
    [contacts],
  )

  const chip = (active: boolean) =>
    `font-mono text-[11px] border px-2 py-1 transition-colors ${
      active
        ? 'bg-[var(--accent-yellow)] text-black border-[var(--accent-yellow)] font-semibold'
        : 'border-[var(--line)] text-[var(--muted-strong)] hover:text-[#f0ede6]'
    }`

  const toggleIn = (set: Set<string>, setter: (s: Set<string>) => void, key: string) => {
    const next = new Set(set)
    next.has(key) ? next.delete(key) : next.add(key)
    setter(next)
  }

  if (!contacts.length) {
    return (
      <section className="terminal-panel p-6 space-y-2">
        <p className="text-sm text-[#f0ede6]">No active leads yet.</p>
        <p className="text-sm text-[var(--muted-strong)]">
          Contacts land here when you pull someone up from a source or log them from a sentence:
          <code className="ml-1">npm run crm:log</code>, or <code>/crm-log</code> in Claude Code.
          Reviewing an expo application on the Expo tab creates one too.
        </p>
      </section>
    )
  }

  return (
    <div className="space-y-4">
      {failed ? (
        <p className="border border-[#ff6b6b] bg-[rgba(255,107,107,0.08)] p-3 font-mono text-xs text-[#ff9d9d]">{failed}</p>
      ) : null}

      <section className="terminal-panel space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-16 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Status</span>
          {CRM_CONTACT_STATUSES.map((s) => {
            const n = contacts.filter((c) => c.status === s).length
            if (!n) return null
            return (
              <button key={s} type="button" onClick={() => toggleIn(statusFilter, setStatusFilter, s)} className={chip(statusFilter.has(s))} aria-pressed={statusFilter.has(s)}>
                {CONTACT_STATUS_LABELS[s]} <span className="opacity-60">{n}</span>
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="w-16 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Source</span>
          {allSources.map((s) => (
            <button key={s} type="button" onClick={() => toggleIn(sourceFilter, setSourceFilter, s)} className={chip(sourceFilter.has(s))} aria-pressed={sourceFilter.has(s)}>
              {SOURCE_LABELS[s] ?? s} <span className="opacity-60">{contacts.filter((c) => c.source_system === s).length}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="w-16 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Label</span>
          {allLabels.map((l) => {
            const n = contacts.filter((c) => c.labels.includes(l)).length
            if (!n) return null
            return (
              <button key={l} type="button" onClick={() => toggleIn(labelFilter, setLabelFilter, l)} className={chip(labelFilter.has(l))} aria-pressed={labelFilter.has(l)}>
                {l} <span className="opacity-60">{n}</span>
              </button>
            )
          })}
          <button type="button" onClick={() => setDueOnly((v) => !v)} className={chip(dueOnly)} aria-pressed={dueOnly}>
            due now <span className="opacity-60">{dueCount}</span>
          </button>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="name, company, role, note…"
            aria-label="Search contacts"
            className="border border-[var(--line)] bg-[rgba(9,13,14,0.5)] px-3 py-1.5 font-mono text-xs text-[#f0ede6] placeholder:text-[var(--muted)]"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Sort"
            className="ml-auto border border-[var(--line)] bg-[rgba(9,13,14,0.5)] px-2 py-1.5 font-mono text-[11px] text-[var(--muted-strong)]"
          >
            {SORTS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3 border border-[var(--line)] bg-[rgba(9,13,14,0.5)] p-3">
        <span className="font-mono text-sm text-[var(--accent-bright)]">{rows.length}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">showing</span>
        <span className="font-mono text-sm text-[#f0ede6]">{contacts.length}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">active leads</span>
        <span className="font-mono text-sm text-[#ffb020]">{dueCount}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">due now</span>
      </div>

      <div className="overflow-x-auto border border-[var(--line)]">
        <table className="w-full min-w-[1100px] border-collapse">
          <thead>
            <tr className="border-b border-[var(--line)] bg-[rgba(9,13,14,0.6)] text-left">
              {['Person', 'Source', 'Status', 'Labels', 'Note', 'Last contact', 'Resurface', 'Log'].map((h) => (
                <th key={h} className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--muted)]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const isOpen = expanded === c.id
              const isDue = Boolean(c.next_followup_at && new Date(c.next_followup_at).getTime() <= Date.now())
              return (
                <Fragment key={c.id}>
                  <tr className={`border-b border-[var(--line)] align-top ${isDue ? 'bg-[rgba(255,176,32,0.07)]' : ''}`}>
                    <td className="px-3 py-2">
                      {c.linkedin_url ? (
                        <a href={c.linkedin_url} target="_blank" rel="noopener" className="text-sm font-semibold text-[#f0ede6] hover:text-[var(--accent-yellow)]">{c.full_name}</a>
                      ) : (
                        <span className="text-sm font-semibold text-[#f0ede6]">{c.full_name}</span>
                      )}
                      <div className="text-xs text-[var(--muted-strong)]">{[c.role, c.company].filter(Boolean).join(' · ') || '—'}</div>
                      {c.email ? <a href={`mailto:${c.email}`} className="font-mono text-[10px] text-[var(--muted)] hover:text-[var(--accent-yellow)]">{c.email}</a> : null}
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px] text-[var(--muted)]">{SOURCE_LABELS[c.source_system] ?? c.source_system}</td>
                    <td className="px-3 py-2">
                      <select
                        value={c.status}
                        onChange={(e) => setStatus(c, e.target.value)}
                        aria-label={`Status for ${c.full_name}`}
                        className={`border border-[var(--line)] bg-[rgba(9,13,14,0.5)] px-1 py-0.5 font-mono text-[11px] ${STATUS_COLOURS[c.status]}`}
                      >
                        {CRM_CONTACT_STATUSES.map((s) => <option key={s} value={s}>{CONTACT_STATUS_LABELS[s]}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <details>
                        <summary className="cursor-pointer list-none">
                          {c.labels.length
                            ? c.labels.map((l) => <span key={l} className="mr-1 inline-block border border-[var(--line)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--muted-strong)]">{l}</span>)
                            : <span className="font-mono text-[10px] text-[var(--muted)]">add labels</span>}
                        </summary>
                        <div className="mt-2 grid grid-cols-2 gap-x-3 border border-[var(--line)] bg-[rgba(9,13,14,0.8)] p-2">
                          {allLabels.map((l) => (
                            <label key={l} className="flex cursor-pointer items-center gap-1.5 font-mono text-[10px] text-[var(--muted-strong)]">
                              <input type="checkbox" checked={c.labels.includes(l)} onChange={() => toggleLabel(c, l)} className="h-3 w-3 accent-[var(--accent-yellow)]" />
                              {l}
                            </label>
                          ))}
                        </div>
                      </details>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        defaultValue={c.note ?? ''}
                        onChange={(e) => setNote(c, e.target.value)}
                        placeholder="note…"
                        aria-label={`Note for ${c.full_name}`}
                        className={`w-full min-w-[130px] border-b bg-transparent px-1 py-1 font-mono text-[11px] ${c.note ? 'border-[#ffb020] text-[#ffb020]' : 'border-[var(--line)] text-[#f0ede6]'}`}
                      />
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-[var(--muted-strong)]">
                      {c.last_contacted_at ? c.last_contacted_at.slice(0, 10) : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="date"
                        value={c.next_followup_at ? c.next_followup_at.slice(0, 10) : ''}
                        onChange={(e) => setFollowUp(c, e.target.value)}
                        aria-label={`Resurface date for ${c.full_name}`}
                        className={`border border-[var(--line)] bg-[rgba(9,13,14,0.5)] px-1 py-1 font-mono text-[11px] ${isDue ? 'text-[#ffb020]' : 'text-[var(--muted-strong)]'}`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => setExpanded(isOpen ? null : c.id)} className="font-mono text-[11px] text-[var(--accent-bright)] hover:text-[var(--accent-yellow)]">
                        {c.events.length ? `${c.events.length} ▾` : 'open ▾'}
                      </button>
                    </td>
                  </tr>

                  {isOpen ? (
                    <tr className="border-b border-[var(--line)] bg-[rgba(9,13,14,0.45)]">
                      <td colSpan={8} className="px-3 py-4">
                        <div className="max-w-3xl space-y-3">
                          <form
                            onSubmit={(e) => {
                              e.preventDefault()
                              const body = (draft[c.id] ?? '').trim()
                              if (body) void addEvent(c, body, 'note')
                            }}
                            className="flex gap-2"
                          >
                            <input
                              type="text"
                              value={draft[c.id] ?? ''}
                              onChange={(e) => setDraft((d) => ({ ...d, [c.id]: e.target.value }))}
                              placeholder="what you said, what they said…"
                              aria-label={`Add timeline entry for ${c.full_name}`}
                              className="flex-1 border border-[var(--line)] bg-[rgba(9,13,14,0.5)] px-2 py-1.5 font-mono text-[11px] text-[#f0ede6] placeholder:text-[var(--muted)]"
                            />
                            <button type="submit" className="border border-[var(--line)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-[var(--accent-yellow)] hover:bg-[var(--accent-yellow)] hover:text-black">Note</button>
                            <button
                              type="button"
                              onClick={() => { const body = (draft[c.id] ?? '').trim(); if (body) void addEvent(c, body, 'outreach') }}
                              className="border border-[var(--line)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-[var(--muted-strong)] hover:text-[#f0ede6]"
                            >
                              Contacted
                            </button>
                          </form>

                          {c.events.length ? (
                            <ul className="space-y-2">
                              {c.events.map((e) => (
                                <li key={e.id} className="border-l-2 border-[var(--line)] pl-3">
                                  <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
                                    {e.happened_at.slice(0, 10)} · {e.kind.replace('_', ' ')}
                                  </div>
                                  <div className="text-[12px] text-[#f0ede6]">{e.body}</div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="font-mono text-[11px] text-[var(--muted)]">Nothing logged yet.</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              )
            })}
          </tbody>
        </table>
        {!rows.length ? <p className="p-8 text-center text-sm text-[var(--muted)]">Nobody matches those filters.</p> : null}
      </div>
    </div>
  )
}
