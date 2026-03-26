'use client'

import { useState, useMemo } from 'react'
import { KBEntity, KBEntityType } from '@/lib/kb'
import { ExploreCard } from './ExploreCard'
import { KBEditModal } from './KBEditModal'

interface ExploreGridProps {
  spaces: import('@/lib/kb').KBSpace[]
  communities: import('@/lib/kb').KBCommunity[]
  vcs: import('@/lib/kb').KBVC[]
  programmes: import('@/lib/kb').KBProgramme[]
  availableSectors: string[]
}

const TYPE_LABELS: Record<KBEntityType | 'all', string> = {
  all: 'ALL',
  space: 'SPACES',
  community: 'COMMUNITIES',
  vc: 'VCS',
  programme: 'PROGRAMMES',
}

const TYPE_KEYS = ['all', 'space', 'community', 'vc', 'programme'] as const

function getEntitySectors(entity: KBEntity): string[] {
  if (entity._type === 'space') return [...(entity.crowd_tags ?? []), ...(entity.tags ?? [])].map((t) => t.toLowerCase())
  if (entity._type === 'community') return (entity.sectors ?? []).map((t) => t.toLowerCase())
  if (entity._type === 'vc') return (entity.sectors ?? []).map((t) => t.toLowerCase())
  if (entity._type === 'programme') return (entity.sectors ?? []).map((t) => t.toLowerCase())
  return []
}

export function ExploreGrid({ spaces, communities, vcs, programmes, availableSectors }: ExploreGridProps) {
  const allEntities: KBEntity[] = [...spaces, ...communities, ...vcs, ...programmes]

  const [activeType, setActiveType] = useState<KBEntityType | 'all'>('all')
  const [activeSectors, setActiveSectors] = useState<string[]>([])
  const [editingEntity, setEditingEntity] = useState<KBEntity | null>(null)
  const [entities, setEntities] = useState<KBEntity[]>(allEntities)

  const [adminMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      return !!sessionStorage.getItem('admin-key')
    } catch {
      return false
    }
  })

  const typeFiltered = useMemo(
    () => (activeType === 'all' ? entities : entities.filter((e) => e._type === activeType)),
    [entities, activeType]
  )

  const filtered = useMemo(() => {
    if (activeSectors.length === 0) return typeFiltered
    return typeFiltered.filter((e) => {
      const entitySectors = getEntitySectors(e)
      return activeSectors.some((s) => entitySectors.includes(s))
    })
  }, [typeFiltered, activeSectors])

  // Only show sectors relevant to current type filter
  const visibleSectors = useMemo(() => {
    const inView = new Set<string>()
    for (const e of typeFiltered) {
      for (const s of getEntitySectors(e)) inView.add(s)
    }
    return availableSectors.filter((s) => inView.has(s))
  }, [typeFiltered, availableSectors])

  function toggleSector(sector: string) {
    setActiveSectors((prev) =>
      prev.includes(sector) ? prev.filter((s) => s !== sector) : [...prev, sector]
    )
  }

  function handleSave(updated: KBEntity) {
    setEntities((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
    setEditingEntity(null)
  }

  return (
    <div className="space-y-4">
      {/* Entity type filter */}
      <div className="flex flex-wrap gap-2">
        {TYPE_KEYS.map((type) => (
          <button
            key={type}
            onClick={() => {
              setActiveType(type)
              setActiveSectors([])
            }}
            className={
              activeType === type
                ? 'filter-chip--active px-3 py-1 text-[10px] uppercase tracking-widest'
                : 'filter-chip px-3 py-1 text-[10px] uppercase tracking-widest'
            }
          >
            {TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      {/* Sector filter */}
      {visibleSectors.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t pt-4" style={{ borderColor: 'var(--line)' }}>
          <button
            onClick={() => setActiveSectors([])}
            className={
              activeSectors.length === 0
                ? 'filter-chip--active px-3 py-1 text-[10px] uppercase tracking-widest'
                : 'filter-chip px-3 py-1 text-[10px] uppercase tracking-widest'
            }
          >
            ALL
          </button>
          {visibleSectors.map((sector) => (
            <button
              key={sector}
              onClick={() => toggleSector(sector)}
              className={
                activeSectors.includes(sector)
                  ? 'filter-chip--active px-3 py-1 text-[10px] uppercase tracking-widest'
                  : 'filter-chip px-3 py-1 text-[10px] uppercase tracking-widest'
              }
            >
              {sector}
            </button>
          ))}
        </div>
      )}

      {/* Count + grid */}
      {filtered.length === 0 ? (
        <div className="py-24 text-center">
          <p className="terminal-hint">No entries match your selection</p>
        </div>
      ) : (
        <>
          <p className="app-section__meta">{filtered.length} entries</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {filtered.map((entity) => (
              <ExploreCard
                key={entity.id}
                entity={entity}
                adminMode={adminMode}
                onEdit={setEditingEntity}
              />
            ))}
          </div>
        </>
      )}

      {/* Admin edit modal */}
      {editingEntity && (
        <KBEditModal
          entity={editingEntity}
          onSave={handleSave}
          onClose={() => setEditingEntity(null)}
        />
      )}
    </div>
  )
}
