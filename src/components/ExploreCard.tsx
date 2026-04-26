'use client'

import Image from 'next/image'
import { KBEntity } from '@/lib/kb'

interface ExploreCardProps {
  entity: KBEntity
  adminMode?: boolean
  onEdit?: (entity: KBEntity) => void
}

function getArea(entity: KBEntity): string | null {
  if (entity._type === 'space') return entity.area
  if (entity._type === 'community') return entity.primary_area
  return null
}

function getBadge(entity: KBEntity): string | null {
  if (entity._type === 'space') return entity.access_type
  if (entity._type === 'community') return entity.exclusivity
  if (entity._type === 'programme') return entity.programme_type
  if (entity._type === 'vc') return entity.london_team ? 'london team' : null
  return null
}

function getSectors(entity: KBEntity): string[] {
  if (entity._type === 'space') return [...(entity.crowd_tags ?? []), ...(entity.tags ?? [])].slice(0, 4)
  if (entity._type === 'community') return (entity.sectors ?? []).slice(0, 4)
  if (entity._type === 'vc') return (entity.sectors ?? []).slice(0, 4)
  if (entity._type === 'programme') return (entity.sectors ?? []).slice(0, 4)
  return []
}

const TYPE_LABELS: Record<KBEntity['_type'], string> = {
  space: 'SPACE',
  community: 'COMMUNITY',
  vc: 'VC',
  programme: 'PROGRAMME',
}

export function ExploreCard({ entity, adminMode, onEdit }: ExploreCardProps) {
  const area = getArea(entity)
  const badge = getBadge(entity)
  const sectors = getSectors(entity)
  const initial = entity.name.charAt(0).toUpperCase()
  const typeLabel = TYPE_LABELS[entity._type]

  return (
    <div className="group relative flex flex-col bg-[#111111] border border-[#1e1e1e] hover:border-[#c8ff00] overflow-hidden transition-colors duration-150">
      {/* Cover image / placeholder */}
      <div className="relative aspect-square overflow-hidden bg-[#0a0a0a]">
        {entity.cover_image ? (
          <Image
            src={entity.cover_image}
            alt={entity.name}
            fill
            unoptimized
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#1c1c1c] via-[#0f0f0f] to-[#080808] flex flex-col items-center justify-center gap-1">
            <span className="text-5xl font-black leading-none text-[#1e1e1e] select-none">
              {initial}
            </span>
            <span className="text-[9px] font-mono uppercase tracking-widest text-[#333] select-none">
              {typeLabel}
            </span>
          </div>
        )}

        {adminMode && (
          <button
            onClick={() => onEdit?.(entity)}
            className="absolute top-2 right-2 px-2 py-1 bg-black/60 border border-[#c8ff00] text-[#c8ff00] text-[9px] font-mono uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity duration-150"
          >
            edit
          </button>
        )}
      </div>

      {/* Card body */}
      <div className="flex flex-col flex-1 p-4 gap-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-[#f0ede6] text-sm leading-snug group-hover:text-[#c8ff00] transition-colors duration-150">
            {entity.name}
          </h3>
          {badge && (
            <span className="text-[9px] font-mono uppercase tracking-widest px-2 py-0.5 border border-[#2a2a2a] text-[#777] rounded-full flex-shrink-0">
              {badge}
            </span>
          )}
        </div>

        {entity.strapline && (
          <p className="text-[11px] text-[#888] line-clamp-2 font-mono">{entity.strapline}</p>
        )}

        {area && (
          <p className="text-[11px] text-[#666] font-mono">{area}</p>
        )}

        {sectors.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-auto">
            {sectors.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-[9px] font-mono uppercase tracking-widest px-2 py-0.5 border border-[#2a2a2a] text-[#777] rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {entity.website && (
          <div className="pt-3 border-t border-[#1a1a1a]">
            <a
              href={entity.website}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-[11px] text-[#666] truncate font-mono hover:text-[#c8ff00] transition-colors duration-150 block"
            >
              {entity.website.replace(/^https?:\/\//, '')}
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
