'use client'

import { useRef, useState } from 'react'
import { postContact, postContactEvent } from './contact-client'
import type { CrmContact, CrmContactEvent } from './contacts'

// The review state shared by every grid that sits over a source table — expo applications,
// volunteer signups, whatever comes next. The source row is read-only and owned elsewhere; the
// verdict, labels, note and timeline live in crm_contacts, keyed back by (source_system,
// source_ref). Each grid supplies only how to read an identity off one of its rows.

export type ContactWithEvents = CrmContact & { events: CrmContactEvent[] }

// Only the fields a given source actually holds. An omitted key is never sent, so a grid with no
// LinkedIn column cannot blank a URL that enrichment or /crm-log filled in.
export interface ContactIdentity {
  source_ref: string
  full_name: string
  company?: string | null
  email?: string | null
  phone?: string | null
  linkedin_url?: string | null
}

export function useContactReview<Row>({
  sourceSystem,
  identity,
  initial,
}: {
  sourceSystem: string
  identity: (row: Row) => ContactIdentity
  initial: ContactWithEvents[]
}) {
  const [contacts, setContacts] = useState<Record<string, ContactWithEvents>>(() =>
    Object.fromEntries(initial.filter((c) => c.source_ref).map((c) => [c.source_ref as string, c])),
  )
  const [failed, setFailed] = useState<string | null>(null)
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // Every write goes through upsert-contact, which resolves an existing row by
  // (source_system, source_ref) before deciding insert vs update — so the first edit on a source
  // row creates its contact and later edits patch it, with no create step to forget.
  async function saveContact(row: Row, patch: Record<string, unknown>): Promise<ContactWithEvents | null> {
    const id = identity(row)
    const fields = Object.fromEntries(Object.entries(id).filter(([, value]) => value !== undefined))
    try {
      const saved = await postContact({ ...fields, source_system: sourceSystem, ...patch })
      const merged: ContactWithEvents = { ...saved, events: contacts[id.source_ref]?.events ?? [] }
      setContacts((prev) => ({ ...prev, [id.source_ref]: merged }))
      setFailed(null)
      return merged
    } catch {
      setFailed('Could not save that change. Nothing was written — try again.')
      return null
    }
  }

  async function addEvent(row: Row, body: string, kind: string) {
    const ref = identity(row).source_ref
    const contact = contacts[ref] ?? (await saveContact(row, {}))
    if (!contact) return
    try {
      const saved = await postContactEvent({ contact_id: contact.id, body, kind })
      setContacts((prev) => ({ ...prev, [ref]: { ...prev[ref], events: [saved, ...(prev[ref]?.events ?? [])] } }))
      setFailed(null)
    } catch {
      setFailed('Could not add that timeline entry.')
    }
  }

  function setStatus(row: Row, status: string) {
    void saveContact(row, { status })
  }

  function toggleLabel(row: Row, label: string) {
    const current = contacts[identity(row).source_ref]?.labels ?? []
    const next = current.includes(label) ? current.filter((l) => l !== label) : [...current, label]
    void saveContact(row, { labels: next })
  }

  // Typing is debounced, but the local copy updates immediately so the field never fights the user.
  function setNote(row: Row, note: string) {
    const ref = identity(row).source_ref
    setContacts((prev) => ({ ...prev, [ref]: { ...(prev[ref] ?? ({} as ContactWithEvents)), note } as ContactWithEvents }))
    clearTimeout(timers.current[ref])
    timers.current[ref] = setTimeout(() => void saveContact(row, { note }), 700)
  }

  return { contacts, failed, saveContact, addEvent, setStatus, toggleLabel, setNote }
}
