'use client'

const TZ = 'Europe/London'

export function londonDay(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(date)
}

function addDays(yyyymmdd: string, n: number): string {
  const [y, m, d] = yyyymmdd.split('-').map(Number)
  return londonDay(new Date(Date.UTC(y, m - 1, d + n, 12)))
}

function chipLabel(yyyymmdd: string, offsetFromToday: number): string {
  if (offsetFromToday === 0) return 'Today'
  if (offsetFromToday === 1) return 'Tomorrow'
  const [y, m, d] = yyyymmdd.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d, 12))
  const weekday = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short' }).format(dt)
  return `${weekday} ${d}`
}

interface DayFilterProps {
  activeDay: string | null
  onChange: (day: string | null) => void
}

export function DayFilter({ activeDay, onChange }: DayFilterProps) {
  const today = londonDay(new Date())
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i))
  const inputValue = activeDay && !days.includes(activeDay) ? activeDay : ''

  const buttonClass = (active: boolean) =>
    `flex-shrink-0 px-3 py-1 text-[10px] font-mono uppercase tracking-widest border transition-all duration-150 rounded-sm ${
      active
        ? 'bg-[#c8ff00] text-black border-[#c8ff00]'
        : 'bg-transparent text-[#555] border-[#2a2a2a] hover:border-[#555] hover:text-[#888]'
    }`

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button onClick={() => onChange(null)} className={buttonClass(activeDay === null)}>
        All days
      </button>
      {days.map((d, i) => (
        <button key={d} onClick={() => onChange(d)} className={buttonClass(activeDay === d)}>
          {chipLabel(d, i)}
        </button>
      ))}
      <input
        type="date"
        value={inputValue}
        onChange={(e) => onChange(e.target.value || null)}
        className="flex-shrink-0 px-3 py-1 text-[10px] font-mono uppercase tracking-widest bg-transparent text-[#888] border border-[#2a2a2a] rounded-sm hover:border-[#555] focus:border-[#c8ff00] focus:text-[#c8ff00] focus:outline-none [color-scheme:dark]"
      />
    </div>
  )
}
