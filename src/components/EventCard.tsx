'use client'

import Image from 'next/image'
import { useState } from 'react'
import { format } from 'date-fns'
import { LondonEvent } from '@/lib/types'

interface EventCardProps {
  event: LondonEvent
  adminMode?: boolean
  adminKey?: string | null
  onEventUpdate?: (id: string, update: Partial<LondonEvent> | 'deleted') => void
}

export function EventCard({ event, adminMode, adminKey, onEventUpdate }: EventCardProps) {
  const [curated, setCurated] = useState(event.curated)
  const [pending, setPending] = useState(event.pending ?? false)
  const [deleted, setDeleted] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const formattedDate = format(new Date(event.startAt), 'EEE d MMM · h:mmaaa')

  async function toggleCurated(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const next = !curated
    setCurated(next)
    if (next) setPending(false)
    onEventUpdate?.(event.id, { curated: next, ...(next ? { pending: false } : {}) })
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-admin-key': adminKey ?? '' },
        body: JSON.stringify({ action: 'curate-event', id: event.id, curated: next }),
      })
      if (!res.ok) throw new Error('request failed')
    } catch {
      setCurated(!next)
      if (next) setPending(event.pending ?? false)
      onEventUpdate?.(event.id, { curated: !next, ...(next ? { pending: event.pending ?? false } : {}) })
    }
  }

  async function approvePending(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setPending(false)
    onEventUpdate?.(event.id, { pending: false })
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-admin-key': adminKey ?? '' },
        body: JSON.stringify({ action: 'approve-event', id: event.id }),
      })
      if (!res.ok) throw new Error('request failed')
    } catch {
      setPending(true)
      onEventUpdate?.(event.id, { pending: true })
    }
  }

  async function deleteEvent(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-admin-key': adminKey ?? '' },
        body: JSON.stringify({ action: 'delete-event', id: event.id }),
      })
      if (res.ok) {
        setDeleted(true)
        onEventUpdate?.(event.id, 'deleted')
      }
    } catch {
      // leave visible on failure
    }
    setConfirmingDelete(false)
  }

  if (deleted) return null

  const cardStyle = pending && !curated ? { borderColor: 'rgba(209,170,119,0.5)' } : curated ? { borderColor: 'var(--line-strong)' } : undefined

  return (
    <a
      href={event.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group terminal-panel relative flex flex-col overflow-hidden"
      style={cardStyle}
    >
      <div className="relative aspect-[4/3] overflow-hidden border-b" style={{ background: 'rgba(4,5,6,0.92)', borderColor: 'var(--line)' }}>
        {event.coverUrl ? (
          <Image
            src={event.coverUrl}
            alt={event.name}
            fill
            unoptimized
            className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 25vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="terminal-eyebrow">LDN</span>
          </div>
        )}

        {adminMode && pending && !curated && (
          <button onClick={approvePending} className="absolute left-2 top-2 terminal-action px-2 py-1 text-[9px]" title="Click to approve">
            pending
          </button>
        )}

        {adminMode ? (
          <button
            onClick={toggleCurated}
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center border text-xs"
            style={{ borderColor: 'var(--line)', background: 'rgba(0,0,0,0.52)', color: curated ? 'var(--accent-bright)' : 'var(--muted)' }}
            title={curated ? 'Remove curation' : 'Mark as curated'}
          >
            {curated ? '★' : '☆'}
          </button>
        ) : curated ? (
          <div className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center border text-xs" style={{ borderColor: 'var(--line-strong)', color: 'var(--accent-bright)' }}>
            ★
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="terminal-eyebrow">{formattedDate}</p>
        <h3 className="text-sm font-semibold leading-snug text-[var(--foreground)] transition-colors duration-150 group-hover:text-[var(--accent-bright)] line-clamp-2">
          {event.name}
        </h3>
        {event.locationName && <p className="terminal-copy--muted truncate">{event.locationName}</p>}
        <div className="terminal-tags mt-auto">
          {event.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="terminal-tag">{tag}</span>
          ))}
        </div>
        <div className="flex items-center gap-2 border-t pt-2" style={{ borderColor: 'var(--line)' }}>
          <span className="truncate text-[11px]" style={{ color: 'var(--muted)' }}>{event.organiserName}</span>
        </div>
      </div>

      {adminMode && (
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setConfirmingDelete(true)
          }}
          className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center border opacity-0 transition-all duration-150 group-hover:opacity-100"
          style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}
          title="Delete event"
        >
          x
        </button>
      )}

      {confirmingDelete && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/85 px-4 text-center backdrop-blur-sm">
          <p className="terminal-copy">Delete this event from the database?</p>
          <div className="flex gap-2">
            <button onClick={deleteEvent} className="terminal-action" style={{ color: 'var(--danger)' }}>delete</button>
            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmingDelete(false) }} className="terminal-ghost">cancel</button>
          </div>
        </div>
      )}
    </a>
  )
}
