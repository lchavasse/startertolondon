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
    <div className="group terminal-panel relative flex flex-col overflow-hidden">
      {/* Cover image / placeholder */}
      <div
        className="relative aspect-[4/3] overflow-hidden border-b"
        style={{ background: 'rgba(4,5,6,0.92)', borderColor: 'var(--line)' }}
      >
        {entity.cover_image ? (
          <Image
            src={entity.cover_image}
            alt={entity.name}
            fill
            unoptimized
            className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 25vw"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            <span
              className="text-3xl font-bold leading-none"
              style={{ color: 'var(--accent-bright)' }}
            >
              {initial}
            </span>
            <span className="text-[9px] uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
              {typeLabel}
            </span>
          </div>
        )}

        {adminMode && (
          <button
            onClick={() => onEdit?.(entity)}
            className="absolute right-2 top-2 border px-2 py-1 text-[9px] uppercase tracking-widest opacity-0 transition-all duration-150 group-hover:opacity-100"
            style={{ borderColor: 'var(--line)', background: 'rgba(0,0,0,0.6)', color: 'var(--accent-bright)' }}
          >
            edit
          </button>
        )}
      </div>

      {/* Card body */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <h3
            className="text-sm font-semibold leading-snug transition-colors duration-150 group-hover:text-[var(--accent-bright)]"
            style={{ color: 'var(--foreground)' }}
          >
            {entity.name}
          </h3>
          {badge && (
            <span className="terminal-tag shrink-0">{badge}</span>
          )}
        </div>

        {entity.strapline && (
          <p className="terminal-copy--muted line-clamp-2">{entity.strapline}</p>
        )}

        {area && (
          <p className="text-[11px]" style={{ color: 'var(--muted)' }}>{area}</p>
        )}

        <div className="terminal-tags mt-auto">
          {sectors.slice(0, 3).map((tag) => (
            <span key={tag} className="terminal-tag">{tag}</span>
          ))}
        </div>

        {entity.website && (
          <div className="border-t pt-2" style={{ borderColor: 'var(--line)' }}>
            <a
              href={entity.website}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="truncate text-[11px] transition-colors duration-150 hover:text-[var(--accent-bright)]"
              style={{ color: 'var(--muted)' }}
            >
              {entity.website.replace(/^https?:\/\//, '')}
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
