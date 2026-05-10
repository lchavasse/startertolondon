import { SECTORS, SECTOR_LABELS, type Sector } from '@/lib/sectors'

interface TagFilterProps {
  /** Sectors actually present on at least one event in the current view. Filters
   * the chip row so we don't render empty buckets. Pass [] to render all. */
  available: readonly Sector[]
  active: Sector[]
  onChange: (sectors: Sector[]) => void
  /** Show "uncategorised" pseudo-chip when at least one event has no sectorTags. */
  uncategorisedAvailable?: boolean
  uncategorisedActive: boolean
  onUncategorisedToggle: (active: boolean) => void
}

export function TagFilter({
  available,
  active,
  onChange,
  uncategorisedAvailable,
  uncategorisedActive,
  onUncategorisedToggle,
}: TagFilterProps) {
  const allSelected = active.length === 0 && !uncategorisedActive
  const availableSet = new Set(available)
  const visibleSectors = SECTORS.filter((s) => available.length === 0 || availableSet.has(s))

  const toggle = (sector: Sector) => {
    if (active.includes(sector)) {
      onChange(active.filter((s) => s !== sector))
    } else {
      onChange([...active, sector])
    }
  }

  const clear = () => {
    onChange([])
    onUncategorisedToggle(false)
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
      <button
        onClick={clear}
        className={`flex-shrink-0 px-3 py-1 text-[10px] font-mono uppercase tracking-widest border transition-all duration-150 rounded-full ${
          allSelected
            ? 'bg-[#c8ff00] text-black border-[#c8ff00]'
            : 'bg-transparent text-[#888] border-[#2a2a2a] hover:border-[#555]'
        }`}
      >
        All
      </button>

      {visibleSectors.map((sector) => {
        const isActive = active.includes(sector)
        return (
          <button
            key={sector}
            onClick={() => toggle(sector)}
            className={`flex-shrink-0 px-3 py-1 text-[10px] font-mono uppercase tracking-widest border transition-all duration-150 rounded-full ${
              isActive
                ? 'bg-[#c8ff00] text-black border-[#c8ff00]'
                : 'bg-transparent text-[#888] border-[#2a2a2a] hover:border-[#555] hover:text-[#888]'
            }`}
          >
            {SECTOR_LABELS[sector]}
          </button>
        )
      })}

      {uncategorisedAvailable && (
        <button
          onClick={() => onUncategorisedToggle(!uncategorisedActive)}
          className={`flex-shrink-0 px-3 py-1 text-[10px] font-mono uppercase tracking-widest border transition-all duration-150 rounded-full ${
            uncategorisedActive
              ? 'bg-[#c8ff00] text-black border-[#c8ff00]'
              : 'bg-transparent text-[#666] border-[#1e1e1e] hover:border-[#444] hover:text-[#888]'
          }`}
          title="Events without a sector tag yet"
        >
          Uncategorised
        </button>
      )}
    </div>
  )
}
