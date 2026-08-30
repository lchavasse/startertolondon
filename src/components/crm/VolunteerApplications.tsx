'use client'

import { Fragment, useMemo, useState } from 'react'
import { CRM_CONTACT_STATUSES, CONTACT_STATUS_LABELS, type CrmContactStatus } from '@/lib/crm/contacts'
import { useContactReview, type ContactWithEvents } from '@/lib/crm/use-contact-review'
import { Field, LabelPicker, NoteInput, StatusSelect, Timeline, chipClass, toggleIn } from './ReviewCells'

// The signup row is owned by the public volunteer form in the deeptech-ldn repo. Nothing here
// writes to it — the verdict, labels, note and timeline live in crm_contacts, linked back by
// source_ref, so a resubmission cannot wipe a decision.

export interface Volunteer {
  id: string
  created_at: string
  name: string
  email: string
  phone: string
  linkedin: string | null
  motivation: string | null
  events_experience: string | null
  available_oct_8: boolean
  windows: string[]
  longer_term: boolean
  briefing_call: boolean
}

const VOLUNTEER_SOURCE = 'volunteer_application'

// Mirrors SHIFT_WINDOWS in deeptech-ldn/lib/config.ts. Any window not in this list still renders —
// it just means the form changed shape and this list has not caught up yet.
const SHIFT_WINDOWS = ['08:00–12:00', '12:00–16:00', '16:00–20:00']

const FLAGS: Array<[keyof Volunteer, string]> = [
  ['available_oct_8', 'free on the day'],
  ['longer_term', 'longer term'],
  ['briefing_call', 'wants a briefing call'],
]

const SORTS: Array<[string, string]> = [
  ['newest', 'newest first'],
  ['oldest', 'oldest first'],
  ['name', 'name A–Z'],
  ['status', 'status'],
  ['cover', 'most shifts offered'],
]

export function VolunteerApplications({
  volunteers,
  contacts: initialContacts,
}: {
  volunteers: Volunteer[]
  contacts: ContactWithEvents[]
}) {
  const { contacts, failed, addEvent, setStatus, toggleLabel, setNote } = useContactReview<Volunteer>({
    sourceSystem: VOLUNTEER_SOURCE,
    identity: (v) => ({
      source_ref: v.id,
      full_name: v.name,
      email: v.email,
      phone: v.phone,
      linkedin_url: v.linkedin,
    }),
    initial: initialContacts,
  })

  const [expanded, setExpanded] = useState<string | null>(null)
  const [sort, setSort] = useState('newest')
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set())
  const [windowFilter, setWindowFilter] = useState<Set<string>>(new Set())
  const [flagFilter, setFlagFilter] = useState<Set<string>>(new Set())
  const [q, setQ] = useState('')

  // Every window anyone actually ticked, in shift order, with unknown ones appended rather than
  // dropped.
  const windows = useMemo(() => {
    const seen = new Set(volunteers.flatMap((v) => v.windows))
    return [...SHIFT_WINDOWS.filter((w) => seen.has(w)), ...[...seen].filter((w) => !SHIFT_WINDOWS.includes(w)).sort()]
  }, [volunteers])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const filtered = volunteers.filter((v) => {
      const c = contacts[v.id]
      if (statusFilter.size && !statusFilter.has(c?.status ?? 'new')) return false
      if (windowFilter.size && !v.windows.some((w) => windowFilter.has(w))) return false
      for (const flag of flagFilter) if (!v[flag as keyof Volunteer]) return false
      if (needle) {
        const hay = `${v.name} ${v.email} ${v.motivation ?? ''} ${v.events_experience ?? ''} ${c?.note ?? ''}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
    const order = [...CRM_CONTACT_STATUSES]
    return filtered.sort((a, b) => {
      if (sort === 'oldest') return a.created_at.localeCompare(b.created_at)
      if (sort === 'name') return a.name.localeCompare(b.name)
      if (sort === 'cover') return b.windows.length - a.windows.length || a.created_at.localeCompare(b.created_at)
      if (sort === 'status') {
        return order.indexOf(contacts[a.id]?.status ?? 'new') - order.indexOf(contacts[b.id]?.status ?? 'new')
      }
      return b.created_at.localeCompare(a.created_at)
    })
  }, [volunteers, contacts, statusFilter, windowFilter, flagFilter, q, sort])

  const counts = useMemo(() => {
    const byStatus: Record<string, number> = {}
    for (const v of volunteers) {
      const s = contacts[v.id]?.status ?? 'new'
      byStatus[s] = (byStatus[s] ?? 0) + 1
    }
    return byStatus
  }, [volunteers, contacts])

  // The question this page exists to answer: is every shift covered by people you have actually
  // confirmed, not by everyone who ever filled the form in.
  const coverage = useMemo(
    () =>
      windows.map((w) => ({
        window: w,
        offered: volunteers.filter((v) => v.windows.includes(w)).length,
        confirmed: volunteers.filter((v) => v.windows.includes(w) && contacts[v.id]?.status === 'confirmed').length,
      })),
    [windows, volunteers, contacts],
  )

  return (
    <div className="space-y-4">
      {failed ? (
        <p className="border border-[#ff6b6b] bg-[rgba(255,107,107,0.08)] p-3 font-mono text-xs text-[#ff9d9d]">{failed}</p>
      ) : null}

      <section className="terminal-panel space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-16 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Status</span>
          {CRM_CONTACT_STATUSES.map((s) => (
            <button key={s} type="button" onClick={() => toggleIn(statusFilter, setStatusFilter, s)} className={chipClass(statusFilter.has(s))} aria-pressed={statusFilter.has(s)}>
              {CONTACT_STATUS_LABELS[s]} <span className="opacity-60">{counts[s] ?? 0}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="w-16 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Shift</span>
          {windows.map((w) => (
            <button key={w} type="button" onClick={() => toggleIn(windowFilter, setWindowFilter, w)} className={chipClass(windowFilter.has(w))} aria-pressed={windowFilter.has(w)}>
              {w} <span className="opacity-60">{volunteers.filter((v) => v.windows.includes(w)).length}</span>
            </button>
          ))}
          {!windows.length ? <span className="font-mono text-[11px] text-[var(--muted)]">no shifts picked yet</span> : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="w-16 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Filter</span>
          {FLAGS.map(([key, label]) => (
            <button key={key} type="button" onClick={() => toggleIn(flagFilter, setFlagFilter, key)} className={chipClass(flagFilter.has(key))} aria-pressed={flagFilter.has(key)}>
              {label} <span className="opacity-60">{volunteers.filter((v) => v[key]).length}</span>
            </button>
          ))}
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="name, email, why they want to help…"
            aria-label="Search volunteers"
            className="border border-[var(--line)] bg-[rgba(9,13,14,0.5)] px-3 py-1.5 font-mono text-xs text-[#f0ede6] placeholder:text-[var(--muted)]"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Sort"
            className="ml-auto border border-[var(--line)] bg-[rgba(9,13,14,0.5)] px-2 py-1.5 font-mono text-[11px] text-[var(--muted-strong)]"
          >
            {SORTS.map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3 border border-[var(--line)] bg-[rgba(9,13,14,0.5)] p-3">
        <span className="font-mono text-sm text-[var(--accent-bright)]">{rows.length}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">showing</span>
        <span className="font-mono text-sm text-[#f0ede6]">{volunteers.length}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">signups</span>
        <span className="font-mono text-sm text-[var(--accent-yellow)]">{counts.confirmed ?? 0}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">confirmed</span>
        <span className="ml-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Cover</span>
        {coverage.map((c) => (
          <span key={c.window} className="font-mono text-[11px] text-[var(--muted-strong)]">
            {c.window}{' '}
            <span className={c.confirmed ? 'text-[var(--accent-yellow)]' : 'text-[#ffb020]'}>{c.confirmed}</span>
            <span className="opacity-60">/{c.offered}</span>
          </span>
        ))}
      </div>

      <div className="overflow-x-auto border border-[var(--line)]">
        <table className="w-full min-w-[1040px] border-collapse">
          <thead>
            <tr className="border-b border-[var(--line)] bg-[rgba(9,13,14,0.6)] text-left">
              {['Signed up', 'Volunteer', 'Contact', 'Shifts', 'Status', 'Labels', 'Note', 'Log'].map((h) => (
                <th key={h} className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--muted)]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => {
              const c = contacts[v.id]
              const status = (c?.status ?? 'new') as CrmContactStatus
              const isOpen = expanded === v.id
              return (
                <Fragment key={v.id}>
                  <tr className={`border-b border-[var(--line)] align-top ${status === 'confirmed' ? 'bg-[rgba(200,255,0,0.06)]' : ''}`}>
                    <td className="px-3 py-2 font-mono text-[11px] text-[var(--muted-strong)]">{v.created_at.slice(0, 10)}</td>
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => setExpanded(isOpen ? null : v.id)} className="text-left text-sm font-semibold text-[#f0ede6] hover:text-[var(--accent-yellow)]">
                        {v.name}
                      </button>
                      <div className="mt-0.5 flex flex-wrap gap-1.5 font-mono text-[10px] text-[var(--muted)]">
                        {v.longer_term ? <span className="text-[var(--accent-bright)]">longer term</span> : null}
                        {v.briefing_call ? <span>briefing call</span> : null}
                        {v.linkedin ? (
                          <a href={v.linkedin} target="_blank" rel="noreferrer" className="hover:text-[var(--accent-yellow)]">
                            linkedin
                          </a>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <a href={`mailto:${v.email}`} className="font-mono text-[10px] text-[var(--muted)] hover:text-[var(--accent-yellow)]">
                        {v.email}
                      </a>
                      <div className="font-mono text-[10px] text-[var(--muted)]">{v.phone}</div>
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px]">
                      {v.available_oct_8 ? (
                        v.windows.length ? (
                          v.windows.map((w) => (
                            <div key={w} className="text-[var(--accent-bright)]">
                              {w}
                            </div>
                          ))
                        ) : (
                          <span className="text-[#ffb020]">free, no shift picked</span>
                        )
                      ) : (
                        <span className="text-[var(--muted)]">not on the day</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <StatusSelect status={status} label={v.name} onChange={(s) => setStatus(v, s)} />
                    </td>
                    <td className="px-3 py-2">
                      <LabelPicker labels={c?.labels ?? []} onToggle={(l) => toggleLabel(v, l)} />
                    </td>
                    <td className="px-3 py-2">
                      <NoteInput note={c?.note} label={v.name} onChange={(value) => setNote(v, value)} />
                    </td>
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => setExpanded(isOpen ? null : v.id)} className="font-mono text-[11px] text-[var(--accent-bright)] hover:text-[var(--accent-yellow)]">
                        {c?.events?.length ? `${c.events.length} ▾` : 'open ▾'}
                      </button>
                    </td>
                  </tr>

                  {isOpen ? (
                    <tr className="border-b border-[var(--line)] bg-[rgba(9,13,14,0.45)]">
                      <td colSpan={8} className="px-3 py-4">
                        <div className="grid gap-6 lg:grid-cols-2">
                          <div className="space-y-3">
                            <Field label="Why they want to help" value={v.motivation} />
                            <Field label="Events experience" value={v.events_experience} />
                            <Field label="Available 8 October" value={v.available_oct_8 ? 'yes' : 'no'} />
                            <Field label="Shifts offered" value={v.windows.join(', ')} />
                            <Field label="Up for longer term" value={v.longer_term ? 'yes' : null} />
                            <Field label="Wants a briefing call" value={v.briefing_call ? 'yes' : null} />
                            <Field label="Phone" value={v.phone} />
                            <Field label="LinkedIn" value={v.linkedin} />
                          </div>

                          <Timeline events={c?.events ?? []} label={v.name} onAdd={(body, kind) => void addEvent(v, body, kind)} />
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              )
            })}
          </tbody>
        </table>
        {!rows.length ? <p className="p-8 text-center text-sm text-[var(--muted)]">No volunteers match those filters.</p> : null}
      </div>
    </div>
  )
}
