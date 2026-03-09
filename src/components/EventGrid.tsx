'use client'

import { useState } from 'react'
import { LondonEvent } from '@/lib/types'
import { EventCard } from './EventCard'
import { TagFilter } from './TagFilter'

interface EventGridProps {
  events: LondonEvent[]
  tags: string[]
}

export function EventGrid({ events, tags }: EventGridProps) {
  const [activeTags, setActiveTags] = useState<string[]>([])

  const filtered =
    activeTags.length === 0
      ? events
      : events.filter((e) => e.tags.some((t) => activeTags.includes(t)))

  return (
    <div className="space-y-6">
      <TagFilter tags={tags} active={activeTags} onChange={setActiveTags} />

      {filtered.length === 0 ? (
        <div className="py-24 text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-[#333]">
            No events match your selection
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
