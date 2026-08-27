'use client'

import type { CrmContact, CrmContactEvent } from './contacts'

// The browser half of the contact writes. Both grids post the same two actions, so the shape lives
// here rather than being retyped per component — the server half is contact-writes.ts and the two
// are meant to stay in step.

async function post<T>(action: string, fields: Record<string, unknown>): Promise<T> {
  const res = await fetch('/api/crm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, fields }),
  })
  if (!res.ok) {
    const detail = await res.json().catch(() => null)
    throw new Error(detail?.error ?? `Request failed (${res.status})`)
  }
  return res.json() as Promise<T>
}

export const postContact = (fields: Record<string, unknown>) => post<CrmContact>('upsert-contact', fields)

export const postContactEvent = (fields: Record<string, unknown>) => post<CrmContactEvent>('add-contact-event', fields)
