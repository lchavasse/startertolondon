import { LondonEvent } from '@/lib/types'

export type SourceGroup = 'luma' | 'cerebral-valley' | 'eventbrite' | 'meetup' | 'other'

export const SOURCE_LABELS: Record<SourceGroup, string> = {
  luma: 'Luma',
  'cerebral-valley': 'Cerebral Valley',
  eventbrite: 'Eventbrite',
  meetup: 'Meetup',
  other: 'Other',
}

export function getSourceGroup(source: LondonEvent['source']): SourceGroup {
  if (source === 'luma-discovery' || source === 'luma-calendar' || source === 'luma-profile') {
    return 'luma'
  }
  return source as SourceGroup
}

interface SourceFilterProps {
  available: SourceGroup[]
  active: SourceGroup[]
  onChange: (sources: SourceGroup[]) => void
}

export function SourceFilter({ available, active, onChange }: SourceFilterProps) {
  const toggle = (source: SourceGroup) => {
    if (active.includes(source)) {
      if (active.length === 1) return
      onChange(active.filter((s) => s !== source))
    } else {
      onChange([...active, source])
    }
  }

  return (
    <div className="flex items-center gap-3">
      <span className="app-section__meta">Sources</span>
      <div className="flex flex-wrap gap-2">
        {available.map((source) => {
          const isActive = active.includes(source)
          return (
            <button
              key={source}
              onClick={() => toggle(source)}
              className={isActive ? 'filter-chip--active px-3 py-1 text-[10px] uppercase tracking-widest' : 'filter-chip px-3 py-1 text-[10px] uppercase tracking-widest'}
            >
              {SOURCE_LABELS[source]}
            </button>
          )
        })}
      </div>
    </div>
  )
}
