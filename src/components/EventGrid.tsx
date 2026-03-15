'use client'

import { useState } from 'react'
import { LondonEvent } from '@/lib/types'
import { EventCard } from './EventCard'
import { TagFilter } from './TagFilter'
import { SourceFilter, SourceGroup, getSourceGroup } from './SourceFilter'

interface EventGridProps {
  events: LondonEvent[]
  tags: string[]
  forceAdminMode?: boolean
  forceAdminKey?: string
  onEventUpdate?: (id: string, update: Partial<LondonEvent> | 'deleted') => void
}

export function EventGrid({ events, tags, forceAdminMode, forceAdminKey, onEventUpdate }: EventGridProps) {
  const [activeTags, setActiveTags] = useState<string[]>([])
  const [curatedOnly, setCuratedOnly] = useState(false)
  const [adminKey] = useState<string | null>(() => {
    if (forceAdminKey) return forceAdminKey
    if (typeof window === 'undefined' || forceAdminMode) return null
    return sessionStorage.getItem('admin-key')
  })
  const [adminMode, setAdminMode] = useState(forceAdminMode ?? false)

  const availableSources = [...new Set(events.map((e) => getSourceGroup(e.source)))] as SourceGroup[]
  const [activeSources, setActiveSources] = useState<SourceGroup[]>(availableSources)

  const filtered = events
    .filter((e) => activeSources.includes(getSourceGroup(e.source)))
    .filter((e) => activeTags.length === 0 || e.tags.some((t) => activeTags.includes(t)))
    .filter((e) => !curatedOnly || e.curated)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <SourceFilter available={availableSources} active={activeSources} onChange={setActiveSources} />
        <button
          onClick={() => setCuratedOnly((value) => !value)}
          className={curatedOnly ? 'filter-chip--active px-3 py-1 text-[10px] uppercase tracking-widest' : 'filter-chip px-3 py-1 text-[10px] uppercase tracking-widest'}
        >
          curated only
        </button>
        {!forceAdminMode && adminKey && (
          <button
            onClick={() => setAdminMode((value) => !value)}
            className={adminMode ? 'filter-chip--active ml-auto px-3 py-1 text-[10px] uppercase tracking-widest' : 'filter-chip ml-auto px-3 py-1 text-[10px] uppercase tracking-widest'}
          >
            admin
          </button>
        )}
      </div>

      <div className="border-t pt-4" style={{ borderColor: 'var(--line)' }}>
        <TagFilter tags={tags} active={activeTags} onChange={setActiveTags} />
      </div>

      {filtered.length === 0 ? (
        <div className="py-24 text-center">
          <p className="terminal-hint">No events match your selection</p>
        </div>
      ) : (
        <>
          <p className="app-section__meta">{filtered.length} events</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {filtered.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                adminMode={adminMode}
                adminKey={adminKey}
                onEventUpdate={onEventUpdate}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
