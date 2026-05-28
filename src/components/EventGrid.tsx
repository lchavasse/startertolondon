'use client'

import { useEffect, useMemo, useState } from 'react'
import { LondonEvent } from '@/lib/types'
import { type Sector } from '@/lib/sectors'
import { EventCard } from './EventCard'
import { TagFilter } from './TagFilter'
import { SourceFilter, SourceGroup, getSourceGroup } from './SourceFilter'
import { DayFilter, londonDay } from './DayFilter'

interface EventGridProps {
  events: LondonEvent[]
  forceAdminMode?: boolean
  forceAdminKey?: string
  onEventUpdate?: (id: string, update: Partial<LondonEvent> | 'deleted') => void
}

export function EventGrid({ events, forceAdminMode, forceAdminKey, onEventUpdate }: EventGridProps) {
  const [activeSectors, setActiveSectors] = useState<Sector[]>([])
  const [showUncategorised, setShowUncategorised] = useState(false)
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

  // Sectors actually present on the current event set — drives chip visibility.
  const availableSectors = useMemo<readonly Sector[]>(() => {
    const set = new Set<Sector>()
    for (const e of events) {
      for (const s of e.sectorTags ?? []) set.add(s)
    }
    return [...set]
  }, [events])

  const hasUncategorised = useMemo(
    () => events.some((e) => e.curated && (!e.sectorTags || e.sectorTags.length === 0)),
    [events]
  )

  // Default to all available sources (no hidden sources)
  const [activeSources, setActiveSources] = useState<SourceGroup[]>(availableSources)
  const [activeDay, setActiveDay] = useState<string | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)

  // Admin selection mode — pick a subset of events to view in isolation.
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [viewSelectedOnly, setViewSelectedOnly] = useState(false)

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const matchesSectorFilter = (e: LondonEvent): boolean => {
    if (activeSectors.length === 0 && !showUncategorised) return true
    const tags = e.sectorTags ?? []
    if (activeSectors.length > 0 && tags.some((t) => activeSectors.includes(t))) return true
    if (showUncategorised && tags.length === 0) return true
    return false
  }

  const beforeCurated = events
    .filter((e) => activeSources.includes(getSourceGroup(e.source)))
    .filter(matchesSectorFilter)
    .filter((e) => !activeDay || londonDay(new Date(e.startAt)) === activeDay)

  const filteredByControls = curatedOnly ? beforeCurated.filter((e) => e.curated) : beforeCurated
  // When viewing only the selected subset, bypass other filters so the user
  // sees exactly what they picked.
  const filtered = viewSelectedOnly
    ? events.filter((e) => selectedIds.has(e.id))
    : filteredByControls
  const curatedCount = beforeCurated.filter((e) => e.curated).length
  const extraFiltersActive =
    activeSectors.length > 0 ||
    showUncategorised ||
    activeDay !== null ||
    activeSources.length !== availableSources.length

  // Preview mode — render the selection as it would appear on /events,
  // with only an edit affordance to go back to selection.
  if (adminMode && viewSelectedOnly) {
    const curatedTotal = events.filter((e) => e.curated).length
    return (
      <div className="space-y-6">
        <button
          onClick={() => {
            setViewSelectedOnly(false)
            setSelectMode(true)
          }}
          title="Edit selection"
          aria-label="Edit selection"
          className="fixed top-3 right-3 z-50 inline-flex items-center justify-center w-8 h-8 border border-[#2a2a2a] bg-[#0a0a0a]/80 text-[#888] hover:border-[#c8ff00] hover:text-[#c8ff00] transition-colors rounded-sm"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
          </svg>
        </button>

        <div>
          <h1 className="font-mono text-xs uppercase tracking-[0.3em] text-[#c8ff00] mb-2">
            London Calling
          </h1>
          <p className="text-[#f0ede6] text-3xl font-bold">Tech Events</p>
          {curatedTotal > 0 && (
            <p className="text-[#666] text-xs font-mono mt-2">
              {curatedTotal} upcoming events
            </p>
          )}
          <p className="text-[#7ea1c4] text-xs font-mono mt-2">
            There are many events lists. This one is{' '}
            <a
              href="https://x.com/lachlan_xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#7ea1c4] hover:text-[#c8ff00] underline"
            >
              mine
            </a>
            .
          </p>
        </div>

        {filtered.length === 0 ? (
          <div className="py-24 text-center">
            <p className="font-mono text-xs uppercase tracking-widest text-[#666]">
              No events selected
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {filtered.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <button
          onClick={() => setCuratedOnly((v) => !v)}
          className={`flex-shrink-0 px-3 py-1 text-[10px] font-mono uppercase tracking-widest border transition-all duration-150 rounded-sm ${
            curatedOnly
              ? 'bg-[#c8ff00] text-black border-[#c8ff00]'
              : 'bg-transparent text-[#555] border-[#2a2a2a] hover:border-[#555] hover:text-[#888]'
          }`}
        >
          ★ Curated · {curatedCount}/{beforeCurated.length}
        </button>
        <button
          onClick={() => setFiltersOpen((v) => !v)}
          aria-label={filtersOpen ? 'Hide filters' : 'Show filters'}
          aria-expanded={filtersOpen}
          className={`flex-shrink-0 inline-flex items-center justify-center px-2 py-1 border transition-all duration-150 rounded-sm relative ${
            filtersOpen
              ? 'bg-[#2a2a2a] text-[#c8ff00] border-[#444]'
              : 'bg-transparent text-[#555] border-[#2a2a2a] hover:border-[#555] hover:text-[#888]'
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="square"
            strokeLinejoin="miter"
            aria-hidden="true"
          >
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          {extraFiltersActive && !filtersOpen && (
            <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-[#c8ff00]" />
          )}
        </button>
        {adminMode && !selectMode && !viewSelectedOnly && (
          <button
            onClick={() => setSelectMode(true)}
            className="flex-shrink-0 ml-auto px-3 py-1 text-[10px] font-mono uppercase tracking-widest border border-[#2a2a2a] text-[#888] hover:border-[#c8ff00] hover:text-[#c8ff00] transition-all duration-150 rounded-sm"
          >
            Select
          </button>
        )}
        {!forceAdminMode && adminKey && (
          <button
            onClick={() => setAdminMode((v) => !v)}
            className={`flex-shrink-0 ${adminMode && !selectMode && !viewSelectedOnly ? '' : 'ml-auto'} px-3 py-1 text-[10px] font-mono uppercase tracking-widest border transition-all duration-150 rounded-sm ${
              adminMode
                ? 'bg-[#2a2a2a] text-[#888] border-[#444]'
                : 'bg-transparent text-[#666] border-[#1e1e1e] hover:border-[#2a2a2a] hover:text-[#555]'
            }`}
          >
            Admin
          </button>
        )}
      </div>

      {/* Selection action bar — shown when actively selecting or viewing a subset */}
      {adminMode && (selectMode || viewSelectedOnly) && (
        <div className="flex items-center gap-2 flex-wrap p-2 border border-amber-500/40 bg-amber-500/5">
          <span className="font-mono text-[10px] uppercase tracking-widest text-amber-400 px-1">
            {viewSelectedOnly
              ? `Viewing ${selectedIds.size} selected`
              : `${selectedIds.size} selected`}
          </span>
          {selectMode && !viewSelectedOnly && (
            <>
              <button
                disabled={selectedIds.size === 0}
                onClick={() => setViewSelectedOnly(true)}
                className="px-3 py-1 font-mono text-[10px] uppercase tracking-widest border border-[#c8ff00]/40 text-[#c8ff00] hover:bg-[#c8ff00]/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed rounded-sm"
              >
                View selected ({selectedIds.size})
              </button>
              <button
                disabled={selectedIds.size === 0}
                onClick={() => setSelectedIds(new Set())}
                className="px-3 py-1 font-mono text-[10px] uppercase tracking-widest border border-[#2a2a2a] text-[#888] hover:border-[#555] hover:text-[#aaa] transition-colors disabled:opacity-30 disabled:cursor-not-allowed rounded-sm"
              >
                Clear
              </button>
              <button
                onClick={() => {
                  setSelectMode(false)
                  setSelectedIds(new Set())
                }}
                className="ml-auto px-3 py-1 font-mono text-[10px] uppercase tracking-widest border border-[#2a2a2a] text-[#888] hover:border-[#555] hover:text-[#aaa] transition-colors rounded-sm"
              >
                Cancel
              </button>
            </>
          )}
          {viewSelectedOnly && (
            <>
              <button
                onClick={() => {
                  setViewSelectedOnly(false)
                  setSelectMode(true)
                }}
                className="px-3 py-1 font-mono text-[10px] uppercase tracking-widest border border-[#2a2a2a] text-[#888] hover:border-[#c8ff00] hover:text-[#c8ff00] transition-colors rounded-sm"
              >
                Edit selection
              </button>
              <button
                onClick={() => {
                  setViewSelectedOnly(false)
                  setSelectMode(false)
                  setSelectedIds(new Set())
                }}
                className="ml-auto px-3 py-1 font-mono text-[10px] uppercase tracking-widest border border-[#2a2a2a] text-[#888] hover:border-[#555] hover:text-[#aaa] transition-colors rounded-sm"
              >
                Show all
              </button>
            </>
          )}
        </div>
      )}

      {filtersOpen && (
        <div className="space-y-4 border-t border-[#1a1a1a] pt-4">
          <SourceFilter
            available={availableSources}
            active={activeSources}
            onChange={setActiveSources}
          />
          <DayFilter activeDay={activeDay} onChange={setActiveDay} />
          <TagFilter
            available={availableSectors}
            active={activeSectors}
            onChange={setActiveSectors}
            uncategorisedAvailable={hasUncategorised}
            uncategorisedActive={showUncategorised}
            onUncategorisedToggle={setShowUncategorised}
          />
        </div>
      )}

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
                selectMode={selectMode}
                selected={selectedIds.has(event.id)}
                onToggleSelect={() => toggleSelected(event.id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
