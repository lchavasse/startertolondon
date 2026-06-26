'use client'

import Image from 'next/image'
import { useState } from 'react'
import { format } from 'date-fns'
import { LondonEvent } from '@/lib/types'
import { SECTORS, SECTOR_LABELS, type Sector } from '@/lib/sectors'
import { withUtm } from '@/lib/utm'

interface EventCardProps {
  event: LondonEvent
  adminMode?: boolean
  adminKey?: string | null
  onEventUpdate?: (id: string, update: Partial<LondonEvent> | 'deleted') => void
  selectMode?: boolean
  selected?: boolean
  onToggleSelect?: () => void
}

export function EventCard({
  event,
  adminMode,
  adminKey,
  onEventUpdate,
  selectMode,
  selected,
  onToggleSelect,
}: EventCardProps) {
  const [curated, setCurated] = useState(event.curated)
  const [pending, setPending] = useState(event.pending ?? false)
  const [deleted, setDeleted] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [sectorTags, setSectorTags] = useState<Sector[]>(event.sectorTags ?? [])
  const [sectorEditorOpen, setSectorEditorOpen] = useState(false)
  const [coverError, setCoverError] = useState(false)
  const formattedDate = format(new Date(event.startAt), "EEE d MMM · h:mmaaa")

  async function persistSectors(next: Sector[]) {
    const previous = sectorTags
    setSectorTags(next)
    onEventUpdate?.(event.id, { sectorTags: next })
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-admin-key': adminKey ?? '' },
        body: JSON.stringify({ action: 'set-event-sectors', id: event.id, sectors: next }),
      })
      if (!res.ok) {
        setSectorTags(previous)
        onEventUpdate?.(event.id, { sectorTags: previous })
      }
    } catch {
      setSectorTags(previous)
      onEventUpdate?.(event.id, { sectorTags: previous })
    }
  }

  function toggleSector(sector: Sector, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const next = sectorTags.includes(sector)
      ? sectorTags.filter((s) => s !== sector)
      : [...sectorTags, sector]
    void persistSectors(next)
  }

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
        headers: {
          'content-type': 'application/json',
          'x-admin-key': adminKey ?? '',
        },
        body: JSON.stringify({ action: 'curate-event', id: event.id, curated: next }),
      })
      if (!res.ok) {
        setCurated(!next)
        if (next) setPending(event.pending ?? false)
        onEventUpdate?.(event.id, { curated: !next, ...(next ? { pending: event.pending ?? false } : {}) })
      }
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
        headers: {
          'content-type': 'application/json',
          'x-admin-key': adminKey ?? '',
        },
        body: JSON.stringify({ action: 'approve-event', id: event.id }),
      })
      if (!res.ok) {
        setPending(true)
        onEventUpdate?.(event.id, { pending: true })
      }
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
        headers: {
          'content-type': 'application/json',
          'x-admin-key': adminKey ?? '',
        },
        body: JSON.stringify({ action: 'delete-event', id: event.id }),
      })
      if (res.ok) {
        setDeleted(true)
        onEventUpdate?.(event.id, 'deleted')
      }
    } catch { /* card stays visible on failure */ }
    setConfirmingDelete(false)
  }

  if (deleted) return null

  let borderClass = 'border-[#1e1e1e] hover:border-[#c8ff00]'
  if (adminMode) {
    if (pending && !curated) {
      borderClass = 'border-amber-500/60 hover:border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
    } else if (curated) {
      borderClass = 'border-[#c8ff00]/50 hover:border-[#c8ff00] shadow-[0_0_12px_rgba(200,255,0,0.1)]'
    }
  }
  if (selectMode && selected) {
    borderClass = 'border-amber-400 shadow-[0_0_16px_rgba(245,158,11,0.35)]'
  } else if (selectMode) {
    borderClass = 'border-[#1e1e1e] hover:border-amber-400/60'
  }

  const handleCardClick = (e: React.MouseEvent) => {
    if (!selectMode) return
    e.preventDefault()
    e.stopPropagation()
    onToggleSelect?.()
  }

  return (
    <a
      href={withUtm(event.url)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleCardClick}
      className={`group relative flex flex-col bg-[#111111] border overflow-hidden transition-colors duration-150 ${borderClass} ${selectMode ? 'cursor-pointer' : ''}`}
    >
      {/* Cover */}
      <div className="relative aspect-square overflow-hidden bg-[#0a0a0a]">
        {event.coverUrl && !coverError ? (
          <Image
            src={event.coverUrl}
            alt={event.name}
            fill
            unoptimized
            onError={() => setCoverError(true)}
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#1c1c1c] via-[#0f0f0f] to-[#080808] flex items-center justify-center">
            <span className="text-[#1e1e1e] text-5xl font-black select-none">LDN</span>
          </div>
        )}

        {adminMode && pending && !curated && (
          <button
            onClick={approvePending}
            className={`absolute ${selectMode ? 'top-10 left-2' : 'top-2 left-2'} px-1.5 py-0.5 bg-amber-500/90 hover:bg-green-500 text-black text-[8px] font-mono font-black uppercase tracking-wider transition-colors cursor-pointer`}
            title="Click to approve"
          >
            pending
          </button>
        )}

        {selectMode && (
          <div
            className={`absolute top-2 left-2 w-6 h-6 flex items-center justify-center text-xs font-black leading-none select-none transition-colors rounded-sm ${
              selected
                ? 'bg-amber-400 text-black'
                : 'bg-black/60 text-[#888] border border-[#444]'
            }`}
            title={selected ? 'Selected' : 'Click card to select'}
          >
            {selected ? '✓' : ''}
          </div>
        )}

        {adminMode ? (
          <button
            onClick={toggleCurated}
            className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-xs font-black leading-none select-none transition-colors"
            style={{ color: curated ? '#c8ff00' : '#444', background: 'rgba(0,0,0,0.5)' }}
            title={curated ? 'Remove curation' : 'Mark as curated'}
          >
            {curated ? '★' : '☆'}
          </button>
        ) : curated ? (
          <div className="absolute top-2 right-2 w-6 h-6 bg-[#c8ff00] flex items-center justify-center text-black text-xs font-black leading-none select-none">
            ★
          </div>
        ) : null}

      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 p-4 gap-3">
        <h3 className="font-bold text-[#f0ede6] text-sm leading-snug line-clamp-2 group-hover:text-[#c8ff00] transition-colors duration-150">
          {event.name}
        </h3>

        <p className="font-mono text-[10px] uppercase tracking-widest text-[#c8ff00]">
          {formattedDate}
        </p>

        {event.locationName && (
          <p className="text-[11px] text-[#888] truncate font-mono">
            {event.locationName}
          </p>
        )}

        {(sectorTags.length > 0 || adminMode) && (
          <div
            className="flex flex-wrap gap-1 mt-auto"
            onClick={adminMode ? (e) => { e.preventDefault(); e.stopPropagation() } : undefined}
          >
            {sectorTags.map((sector) =>
              adminMode ? (
                <button
                  key={sector}
                  onClick={(e) => toggleSector(sector, e)}
                  className="text-[9px] font-mono uppercase tracking-widest px-2 py-0.5 border border-[#c8ff00]/40 bg-[#c8ff00]/10 text-[#c8ff00] rounded-full hover:bg-red-500/20 hover:border-red-500/60 hover:text-red-400 transition-colors"
                  title={`Remove ${SECTOR_LABELS[sector]}`}
                >
                  {SECTOR_LABELS[sector]} ×
                </button>
              ) : (
                <span
                  key={sector}
                  className="text-[9px] font-mono uppercase tracking-widest px-2 py-0.5 border border-[#c8ff00]/30 bg-[#c8ff00]/5 text-[#c8ff00]/80 rounded-full"
                >
                  {SECTOR_LABELS[sector]}
                </span>
              )
            )}
            {adminMode && (
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setSectorEditorOpen((v) => !v)
                }}
                className={`text-[9px] font-mono uppercase tracking-widest px-2 py-0.5 border rounded-full transition-colors ${
                  sectorEditorOpen
                    ? 'border-[#c8ff00] text-[#c8ff00] bg-[#c8ff00]/10'
                    : 'border-[#2a2a2a] text-[#666] hover:border-[#555] hover:text-[#888]'
                }`}
                title={sectorEditorOpen ? 'Close picker' : 'Edit sector tags'}
              >
                {sectorEditorOpen ? '×' : '+ tag'}
              </button>
            )}
          </div>
        )}

        {adminMode && sectorEditorOpen && (
          <div
            className="flex flex-wrap gap-1 -mt-2 pt-2 border-t border-[#1a1a1a]"
            onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
          >
            {SECTORS.filter((s) => !sectorTags.includes(s)).map((sector) => (
              <button
                key={sector}
                onClick={(e) => toggleSector(sector, e)}
                className="text-[9px] font-mono uppercase tracking-widest px-2 py-0.5 border border-[#2a2a2a] text-[#888] rounded-full hover:border-[#c8ff00] hover:text-[#c8ff00] transition-colors"
              >
                {SECTOR_LABELS[sector]}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 pt-3 border-t border-[#1a1a1a]">
          {event.organiserAvatarUrl ? (
            <div className="relative w-5 h-5 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-[#2a2a2a]">
              <Image
                src={event.organiserAvatarUrl}
                alt={event.organiserName}
                fill
                className="object-cover"
                sizes="20px"
              />
            </div>
          ) : (
            <div className="w-5 h-5 rounded-full bg-[#c8ff00]/10 border border-[#c8ff00]/20 flex items-center justify-center flex-shrink-0">
              <span className="text-[9px] font-mono font-bold text-[#c8ff00]/60">
                {event.organiserName ? event.organiserName.charAt(0).toUpperCase() : '?'}
              </span>
            </div>
          )}
          <span className="text-[11px] text-[#666] truncate font-mono">{event.organiserName}</span>
        </div>
      </div>

      {/* Admin delete button */}
      {adminMode && (
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setConfirmingDelete(true)
          }}
          className="absolute bottom-2 right-2 w-7 h-7 flex items-center justify-center rounded bg-transparent text-[#555] hover:bg-red-600 hover:text-white transition-all duration-150 opacity-0 group-hover:opacity-100"
          title="Delete event"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
        </button>
      )}

      {/* Delete confirmation overlay */}
      {confirmingDelete && (
        <div
          className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm"
          onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
        >
          <p className="font-mono text-xs text-[#f0ede6] mb-4 px-4 text-center">
            Delete this event from the database?
          </p>
          <div className="flex gap-2">
            <button
              onClick={deleteEvent}
              className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white font-mono text-[10px] uppercase tracking-widest font-bold transition-colors"
            >
              Delete
            </button>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmingDelete(false) }}
              className="px-4 py-1.5 border border-[#333] hover:border-[#555] text-[#888] hover:text-[#f0ede6] font-mono text-[10px] uppercase tracking-widest font-bold transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </a>
  )
}
