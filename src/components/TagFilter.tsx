interface TagFilterProps {
  tags: string[]
  active: string[]
  onChange: (tags: string[]) => void
}

export function TagFilter({ tags, active, onChange }: TagFilterProps) {
  const allSelected = active.length === 0

  const toggle = (tag: string) => {
    if (active.includes(tag)) {
      onChange(active.filter((t) => t !== tag))
    } else {
      onChange([...active, tag])
    }
  }

  return (
    <div className="scrollbar-none flex gap-2 overflow-x-auto pb-2">
      <button onClick={() => onChange([])} className={allSelected ? 'filter-chip--active px-3 py-1 text-[10px] uppercase tracking-widest' : 'filter-chip px-3 py-1 text-[10px] uppercase tracking-widest'}>
        all
      </button>
      {tags.map((tag) => {
        const isActive = active.includes(tag)
        return (
          <button key={tag} onClick={() => toggle(tag)} className={isActive ? 'filter-chip--active px-3 py-1 text-[10px] uppercase tracking-widest' : 'filter-chip px-3 py-1 text-[10px] uppercase tracking-widest'}>
            {tag}
          </button>
        )
      })}
    </div>
  )
}
