'use client'

import { useEffect, useState } from 'react'
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
  const [curatedOnly, setCuratedOnly] = useState(forceAdminMode ? false : true)
  const [adminKey, setAdminKey] = useState<string | null>(forceAdminKey ?? null)
  const [adminMode, setAdminMode] = useState(forceAdminMode ?? false)

  useEffect(() => {
    if (forceAdminMode) return
    const stored = sessionStorage.getItem('admin-key')
    if (stored) setAdminKey(stored)
  }, [forceAdminMode])

  const availableSources = [
    ...new Set(events.map((e) => getSourceGroup(e.source))),
  ] as SourceGroup[]

  // Default to all available sources (no hidden sources)
  const [activeSources, setActiveSources] = useState<SourceGroup[]>(availableSources)

  const filtered = events
    .filter((e) => activeSources.includes(getSourceGroup(e.source)))
    .filter((e) => activeTags.length === 0 || e.tags.some((t) => activeTags.includes(t)))
    .filter((e) => !curatedOnly || e.curated)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <SourceFilter
          available={availableSources}
          active={activeSources}
          onChange={setActiveSources}
        />
        <button
          onClick={() => setCuratedOnly((v) => !v)}
          className={`flex-shrink-0 px-3 py-1 text-[10px] font-mono uppercase tracking-widest border transition-all duration-150 rounded-sm ${
            curatedOnly
              ? 'bg-[#c8ff00] text-black border-[#c8ff00]'
              : 'bg-transparent text-[#555] border-[#2a2a2a] hover:border-[#555] hover:text-[#888]'
          }`}
        >
          ★ Curated
        </button>
        {!forceAdminMode && adminKey && (
          <button
            onClick={() => setAdminMode((v) => !v)}
            className={`flex-shrink-0 ml-auto px-3 py-1 text-[10px] font-mono uppercase tracking-widest border transition-all duration-150 rounded-sm ${
              adminMode
                ? 'bg-[#2a2a2a] text-[#888] border-[#444]'
                : 'bg-transparent text-[#666] border-[#1e1e1e] hover:border-[#2a2a2a] hover:text-[#555]'
            }`}
          >
            Admin
          </button>
        )}
      </div>

      <div className="border-t border-[#1a1a1a] pt-4">
        <TagFilter tags={tags} active={activeTags} onChange={setActiveTags} />
      </div>

      {filtered.length === 0 ? (
        <div className="py-24 text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-[#666]">
            No events match your selection
          </p>
        </div>
      ) : (
        <>
          <p className="font-mono text-[10px] text-[#666] uppercase tracking-widest">
            {filtered.length} events
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
