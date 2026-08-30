'use client'

import { useState } from 'react'
import {
  CRM_CONTACT_STATUSES,
  CONTACT_STATUS_LABELS,
  CONTACT_LABEL_SUGGESTIONS,
  type CrmContactEvent,
  type CrmContactStatus,
} from '@/lib/crm/contacts'

// The cells every source-row review grid shares. Only the source columns differ between expo
// applications and volunteers — the verdict half of the row is the same in both.

export const STATUS_COLOURS: Record<CrmContactStatus, string> = {
  new: 'text-[var(--muted)]',
  reviewing: 'text-[#ffb020]',
  contacted: 'text-[var(--accent-bright)]',
  in_conversation: 'text-[#4fd1c5]',
  confirmed: 'text-[var(--accent-yellow)]',
  declined: 'text-[#ff9d9d]',
  parked: 'text-[var(--muted)]',
}

export const chipClass = (active: boolean) =>
  `font-mono text-[11px] border px-2 py-1 transition-colors ${
    active
      ? 'bg-[var(--accent-yellow)] text-black border-[var(--accent-yellow)] font-semibold'
      : 'border-[var(--line)] text-[var(--muted-strong)] hover:text-[#f0ede6]'
  }`

export function toggleIn(set: Set<string>, setter: (s: Set<string>) => void, key: string) {
  const next = new Set(set)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  setter(next)
}

export function StatusSelect({
  status,
  label,
  onChange,
}: {
  status: CrmContactStatus
  label: string
  onChange: (status: string) => void
}) {
  return (
    <select
      value={status}
      onChange={(e) => onChange(e.target.value)}
      aria-label={`Status for ${label}`}
      className={`border border-[var(--line)] bg-[rgba(9,13,14,0.5)] px-1 py-0.5 font-mono text-[11px] ${STATUS_COLOURS[status]}`}
    >
      {CRM_CONTACT_STATUSES.map((s) => (
        <option key={s} value={s}>
          {CONTACT_STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  )
}

export function LabelPicker({ labels, onToggle }: { labels: string[]; onToggle: (label: string) => void }) {
  return (
    <details>
      <summary className="cursor-pointer list-none">
        {labels.length ? (
          labels.map((l) => (
            <span key={l} className="mr-1 inline-block border border-[var(--line)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--muted-strong)]">
              {l}
            </span>
          ))
        ) : (
          <span className="font-mono text-[10px] text-[var(--muted)]">add labels</span>
        )}
      </summary>
      <div className="mt-2 grid grid-cols-2 gap-x-3 border border-[var(--line)] bg-[rgba(9,13,14,0.8)] p-2">
        {CONTACT_LABEL_SUGGESTIONS.map((l) => (
          <label key={l} className="flex cursor-pointer items-center gap-1.5 font-mono text-[10px] text-[var(--muted-strong)]">
            <input type="checkbox" checked={labels.includes(l)} onChange={() => onToggle(l)} className="h-3 w-3 accent-[var(--accent-yellow)]" />
            {l}
          </label>
        ))}
      </div>
    </details>
  )
}

export function NoteInput({
  note,
  label,
  placeholder = 'verdict…',
  onChange,
}: {
  note: string | null | undefined
  label: string
  placeholder?: string
  onChange: (value: string) => void
}) {
  return (
    <input
      type="text"
      defaultValue={note ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={`Note for ${label}`}
      className={`w-full min-w-[140px] border-b bg-transparent px-1 py-1 font-mono text-[11px] ${
        note ? 'border-[#ffb020] text-[#ffb020]' : 'border-[var(--line)] text-[#f0ede6]'
      }`}
    />
  )
}

export function Timeline({
  events,
  label,
  onAdd,
}: {
  events: CrmContactEvent[]
  label: string
  onAdd: (body: string, kind: string) => void
}) {
  const [draft, setDraft] = useState('')

  const submit = (kind: string) => {
    const body = draft.trim()
    if (!body) return
    onAdd(body, kind)
    setDraft('')
  }

  return (
    <div className="space-y-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Timeline</p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit('note')
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="what you said, what they said…"
          aria-label={`Add timeline entry for ${label}`}
          className="flex-1 border border-[var(--line)] bg-[rgba(9,13,14,0.5)] px-2 py-1.5 font-mono text-[11px] text-[#f0ede6] placeholder:text-[var(--muted)]"
        />
        <button type="submit" className="border border-[var(--line)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-[var(--accent-yellow)] hover:bg-[var(--accent-yellow)] hover:text-black">
          Note
        </button>
        <button
          type="button"
          onClick={() => submit('outreach')}
          className="border border-[var(--line)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-[var(--muted-strong)] hover:text-[#f0ede6]"
        >
          Contacted
        </button>
      </form>

      {events.length ? (
        <ul className="space-y-2">
          {events.map((e) => (
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
  )
}

export function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">{label}</p>
      <p className="whitespace-pre-wrap text-[12px] text-[#f0ede6]">{value}</p>
    </div>
  )
}
