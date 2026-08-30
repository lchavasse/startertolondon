'use client'

import { Fragment, useMemo, useState } from 'react'
import { CRM_CONTACT_STATUSES, CONTACT_STATUS_LABELS, type CrmContactStatus } from '@/lib/crm/contacts'
import { useContactReview, type ContactWithEvents } from '@/lib/crm/use-contact-review'
import { Field, LabelPicker, NoteInput, StatusSelect, Timeline, chipClass, toggleIn } from './ReviewCells'

// The application row is owned by the public form in the deeptech-ldn repo. Nothing here writes to
// it — the verdict, labels, note and timeline all live in crm_contacts, linked back by source_ref.
// That separation is the point: the form can change shape without touching review state, and a
// resubmission cannot wipe a decision.

export interface ExpoApplication {
  id: string
  created_at: string
  name: string
  company: string
  email: string
  phone: string | null
  bring: string
  space: string | null
  payment: string
  support: string[] | null
  referral: string | null
  communities: string[] | null
  communities_other: string | null
  funding_stage: string | null
  goals: string[] | null
  goals_other: string | null
  one_liner: string | null
  logo_path: string | null
  logo_url?: string | null
}

const EXPO_SOURCE = 'expo_application'

const PAYMENT_LABELS: Record<string, string> = {
  yes: 'can pay',
  subsidised: 'needs subsidy',
  chat: 'wants to chat',
}

const SORTS: Array<[string, string]> = [
  ['newest', 'newest first'],
  ['oldest', 'oldest first'],
  ['company', 'company A–Z'],
  ['status', 'status'],
]

export function ExpoApplications({
  applications,
  contacts: initialContacts,
}: {
  applications: ExpoApplication[]
  contacts: ContactWithEvents[]
}) {
  const { contacts, failed, addEvent, setStatus, toggleLabel, setNote } = useContactReview<ExpoApplication>({
    sourceSystem: EXPO_SOURCE,
    identity: (a) => ({
      source_ref: a.id,
      full_name: a.name,
      company: a.company,
      email: a.email,
      phone: a.phone,
    }),
    initial: initialContacts,
  })

  const [expanded, setExpanded] = useState<string | null>(null)
  const [sort, setSort] = useState('newest')
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set())
  const [paymentFilter, setPaymentFilter] = useState<Set<string>>(new Set())
  const [q, setQ] = useState('')

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const filtered = applications.filter((a) => {
      const c = contacts[a.id]
      if (statusFilter.size && !statusFilter.has(c?.status ?? 'new')) return false
      if (paymentFilter.size && !paymentFilter.has(a.payment)) return false
      if (needle) {
        const hay = `${a.name} ${a.company} ${a.email} ${a.bring} ${a.one_liner ?? ''} ${c?.note ?? ''}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
    const order = [...CRM_CONTACT_STATUSES]
    return filtered.sort((a, b) => {
      if (sort === 'oldest') return a.created_at.localeCompare(b.created_at)
      if (sort === 'company') return a.company.localeCompare(b.company)
      if (sort === 'status') {
        return order.indexOf(contacts[a.id]?.status ?? 'new') - order.indexOf(contacts[b.id]?.status ?? 'new')
      }
      return b.created_at.localeCompare(a.created_at)
    })
  }, [applications, contacts, statusFilter, paymentFilter, q, sort])

  const counts = useMemo(() => {
    const byStatus: Record<string, number> = {}
    for (const a of applications) {
      const s = contacts[a.id]?.status ?? 'new'
      byStatus[s] = (byStatus[s] ?? 0) + 1
    }
    return byStatus
  }, [applications, contacts])

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
          <span className="w-16 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Payment</span>
          {Object.entries(PAYMENT_LABELS).map(([k, label]) => (
            <button key={k} type="button" onClick={() => toggleIn(paymentFilter, setPaymentFilter, k)} className={chipClass(paymentFilter.has(k))} aria-pressed={paymentFilter.has(k)}>
              {label} <span className="opacity-60">{applications.filter((a) => a.payment === k).length}</span>
            </button>
          ))}
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="company, person, what they're bringing…"
            aria-label="Search applications"
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
        <span className="font-mono text-sm text-[#f0ede6]">{applications.length}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">applications</span>
        <span className="font-mono text-sm text-[var(--accent-yellow)]">{counts.confirmed ?? 0}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">confirmed</span>
        <span className="font-mono text-sm text-[#ffb020]">{applications.filter((a) => a.payment === 'subsidised').length}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">need subsidy</span>
      </div>

      <div className="overflow-x-auto border border-[var(--line)]">
        <table className="w-full min-w-[1040px] border-collapse">
          <thead>
            <tr className="border-b border-[var(--line)] bg-[rgba(9,13,14,0.6)] text-left">
              {['Applied', 'Company', 'Applicant', 'Payment', 'Status', 'Labels', 'Note', 'Log'].map((h) => (
                <th key={h} className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--muted)]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const c = contacts[a.id]
              const status = (c?.status ?? 'new') as CrmContactStatus
              const isOpen = expanded === a.id
              return (
                <Fragment key={a.id}>
                  <tr className={`border-b border-[var(--line)] align-top ${status === 'confirmed' ? 'bg-[rgba(200,255,0,0.06)]' : ''}`}>
                    <td className="px-3 py-2 font-mono text-[11px] text-[var(--muted-strong)]">{a.created_at.slice(0, 10)}</td>
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => setExpanded(isOpen ? null : a.id)} className="text-left text-sm font-semibold text-[#f0ede6] hover:text-[var(--accent-yellow)]">
                        {a.company}
                      </button>
                      {a.one_liner ? <div className="mt-0.5 max-w-[36ch] text-[11px] text-[var(--muted)]">{a.one_liner}</div> : null}
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-xs text-[#f0ede6]">{a.name}</div>
                      <a href={`mailto:${a.email}`} className="font-mono text-[10px] text-[var(--muted)] hover:text-[var(--accent-yellow)]">{a.email}</a>
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px]">
                      <span className={a.payment === 'yes' ? 'text-[var(--accent-bright)]' : a.payment === 'subsidised' ? 'text-[#ffb020]' : 'text-[var(--muted-strong)]'}>
                        {PAYMENT_LABELS[a.payment] ?? a.payment}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <StatusSelect status={status} label={a.company} onChange={(next) => setStatus(a, next)} />
                    </td>
                    <td className="px-3 py-2">
                      <LabelPicker labels={c?.labels ?? []} onToggle={(l) => toggleLabel(a, l)} />
                    </td>
                    <td className="px-3 py-2">
                      <NoteInput note={c?.note} label={a.company} onChange={(value) => setNote(a, value)} />
                    </td>
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => setExpanded(isOpen ? null : a.id)} className="font-mono text-[11px] text-[var(--accent-bright)] hover:text-[var(--accent-yellow)]">
                        {c?.events?.length ? `${c.events.length} ▾` : 'open ▾'}
                      </button>
                    </td>
                  </tr>

                  {isOpen ? (
                    <tr className="border-b border-[var(--line)] bg-[rgba(9,13,14,0.45)]">
                      <td colSpan={8} className="px-3 py-4">
                        <div className="grid gap-6 lg:grid-cols-2">
                          <div className="space-y-3">
                            <Field label="What they'll bring" value={a.bring} />
                            <Field label="Space needed" value={a.space} />
                            <Field label="Funding stage" value={a.funding_stage} />
                            <Field label="Communities" value={[...(a.communities ?? []), a.communities_other].filter(Boolean).join(', ')} />
                            <Field label="Goals" value={[...(a.goals ?? []), a.goals_other].filter(Boolean).join(', ')} />
                            <Field label="Support asked for" value={(a.support ?? []).join(', ')} />
                            <Field label="Heard about us via" value={a.referral} />
                            <Field label="Phone" value={a.phone} />
                            {a.logo_url ? (
                              <div>
                                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Logo</p>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={a.logo_url} alt={`${a.company} logo`} className="mt-1 max-h-20 border border-[var(--line)] bg-[rgba(255,255,255,0.04)] p-2" />
                              </div>
                            ) : a.logo_path ? (
                              <Field label="Logo" value="uploaded (could not sign URL)" />
                            ) : null}
                          </div>

                          <Timeline events={c?.events ?? []} label={a.company} onAdd={(body, kind) => void addEvent(a, body, kind)} />
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              )
            })}
          </tbody>
        </table>
        {!rows.length ? <p className="p-8 text-center text-sm text-[var(--muted)]">No applications match those filters.</p> : null}
      </div>
    </div>
  )
}
