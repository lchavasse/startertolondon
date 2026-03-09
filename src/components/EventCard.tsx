import Image from 'next/image'
import { format } from 'date-fns'
import { LondonEvent } from '@/lib/types'

interface EventCardProps {
  event: LondonEvent
}

export function EventCard({ event }: EventCardProps) {
  const formattedDate = format(new Date(event.startAt), "EEE d MMM · h:mmaaa")

  return (
    <a
      href={event.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col bg-[#111111] border border-[#1e1e1e] overflow-hidden hover:border-[#c8ff00] transition-colors duration-150"
    >
      {/* Cover */}
      <div className="relative aspect-square overflow-hidden bg-[#0a0a0a]">
        {event.coverUrl ? (
          <Image
            src={event.coverUrl}
            alt={event.name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#1c1c1c] via-[#0f0f0f] to-[#080808] flex items-center justify-center">
            <span className="text-[#1e1e1e] text-5xl font-black select-none">LDN</span>
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-black/80 to-transparent">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[#c8ff00]">
            {formattedDate}
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 p-4 gap-3">
        <h3 className="font-bold text-[#f0ede6] text-sm leading-snug line-clamp-2 group-hover:text-[#c8ff00] transition-colors duration-150">
          {event.name}
        </h3>

        {event.locationName && (
          <p className="text-[11px] text-[#555] truncate font-mono">
            {event.locationName}
          </p>
        )}

        {event.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-auto">
            {event.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-[9px] font-mono uppercase tracking-widest px-2 py-0.5 border border-[#2a2a2a] text-[#444] rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 pt-3 border-t border-[#1a1a1a]">
          {event.organiserAvatarUrl ? (
            <div className="relative w-5 h-5 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-[#2a2a2a]">
              <Image
                src={event.organiserAvatarUrl}
                alt={event.organiserName}
                fill
                className="object-cover"
                sizes="20px"
              />
            </div>
          ) : (
            <div className="w-5 h-5 rounded-full bg-[#c8ff00]/10 border border-[#c8ff00]/20 flex items-center justify-center flex-shrink-0">
              <span className="text-[9px] font-mono font-bold text-[#c8ff00]/60">
                {event.organiserName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <span className="text-[11px] text-[#3a3a3a] truncate font-mono">{event.organiserName}</span>
        </div>
      </div>
    </a>
  )
}
