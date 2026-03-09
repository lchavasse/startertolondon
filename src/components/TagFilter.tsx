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
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
      <button
        onClick={() => onChange([])}
        className={`flex-shrink-0 px-3 py-1 text-[10px] font-mono uppercase tracking-widest border transition-all duration-150 rounded-full ${
          allSelected
            ? 'bg-[#c8ff00] text-black border-[#c8ff00]'
            : 'bg-transparent text-[#555] border-[#2a2a2a] hover:border-[#555]'
        }`}
      >
        All
      </button>

      {tags.map((tag) => {
        const isActive = active.includes(tag)
        return (
          <button
            key={tag}
            onClick={() => toggle(tag)}
            className={`flex-shrink-0 px-3 py-1 text-[10px] font-mono uppercase tracking-widest border transition-all duration-150 rounded-full ${
              isActive
                ? 'bg-[#c8ff00] text-black border-[#c8ff00]'
                : 'bg-transparent text-[#555] border-[#2a2a2a] hover:border-[#555] hover:text-[#888]'
            }`}
          >
            {tag}
          </button>
        )
      })}
    </div>
  )
}
