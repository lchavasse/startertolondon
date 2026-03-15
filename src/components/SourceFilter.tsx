import { LondonEvent } from '@/lib/types'

export type SourceGroup = 'luma' | 'cerebral-valley' | 'eventbrite' | 'meetup' | 'other'

export const SOURCE_LABELS: Record<SourceGroup, string> = {
  'luma': 'Luma',
  'cerebral-valley': 'Cerebral Valley',
  'eventbrite': 'Eventbrite',
  'meetup': 'Meetup',
  'other': 'Other',
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
      // Don't allow deselecting all
      if (active.length === 1) return
      onChange(active.filter((s) => s !== source))
    } else {
      onChange([...active, source])
    }
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-[9px] font-mono uppercase tracking-widest text-[#666] flex-shrink-0">
        Sources
      </span>
      <div className="flex gap-2 flex-wrap">
        {available.map((source) => {
          const isActive = active.includes(source)
          return (
            <button
              key={source}
              onClick={() => toggle(source)}
              className={`flex-shrink-0 px-3 py-1 text-[10px] font-mono uppercase tracking-widest border transition-all duration-150 rounded-sm ${
                isActive
                  ? 'bg-[#c8ff00] text-black border-[#c8ff00]'
                  : 'bg-transparent text-[#888] border-[#2a2a2a] hover:border-[#555] hover:text-[#888]'
              }`}
            >
              {SOURCE_LABELS[source]}
            </button>
          )
        })}
      </div>
    </div>
  )
}
