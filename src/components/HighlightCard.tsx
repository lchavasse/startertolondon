'use client'

import { useState } from 'react'
import Image from 'next/image'
import { HighlightCard as HighlightData } from '@/lib/kb'

type SectionKey = 'community' | 'events' | 'people' | 'programmes'

interface HighlightCardProps {
  card: HighlightData
}

function fileLabel(slug: string): string {
  return `${slug.replace(/-/g, '_')}.kb`
}

interface CardHeader {
  rootKind: 'space' | 'community'
  slug: string
  name: string
  displayName: string
  pixelArt: string | null
  area: string | null
  access: string | null
  strapline: string | null
  website: string | null
  eventsUrl: string | null
  sectors: string[]
}

function deriveHeader(card: HighlightData): CardHeader {
  if (card.kind === 'space') {
    const { space, community } = card
    return {
      rootKind: 'space',
      slug: space.slug,
      name: space.name,
      displayName: space.display_name ?? space.name.toUpperCase(),
      pixelArt: space.pixel_art,
      area: space.area,
      access: space.access_type,
      strapline: space.strapline,
      website: space.website,
      eventsUrl: space.events_url ?? community?.events_url ?? null,
      sectors: community?.sectors ?? space.crowd_tags ?? [],
    }
  }
  const c = card.community
  return {
    rootKind: 'community',
    slug: c.slug,
    name: c.name,
    displayName: c.display_name ?? c.name.toUpperCase(),
    pixelArt: c.pixel_art,
    area: c.primary_area,
    access: c.exclusivity,
    strapline: c.strapline,
    website: c.website,
    eventsUrl: c.events_url,
    sectors: c.sectors ?? [],
  }
}

export function HighlightCard({ card }: HighlightCardProps) {
  const header = deriveHeader(card)
  const nestedCommunity = card.kind === 'space' ? card.community : null
  const { eventSeries, people, programmes } = card

  const initialOpen: SectionKey = card.kind === 'space' && nestedCommunity ? 'community' : 'events'
  const [openSections, setOpenSections] = useState<Set<SectionKey>>(new Set([initialOpen]))

  const toggle = (key: SectionKey) =>
    setOpenSections((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <article className="kb-card">
      <header className="kb-card__titlebar">
        <span className="kb-card__dots"><i /><i /><i /></span>
        <span className="kb-card__file">[ {header.rootKind} ] {fileLabel(header.slug)}</span>
        <span className="kb-card__lvl">lv.01</span>
      </header>

      <div className="kb-card__hero">
        <div className="kb-card__pixel">
          {header.pixelArt ? (
            <Image
              src={header.pixelArt}
              alt={header.name}
              fill
              unoptimized
              sizes="160px"
              style={{ objectFit: 'contain', imageRendering: 'pixelated' }}
            />
          ) : (
            <span className="kb-card__pixel-placeholder">{header.name.charAt(0)}</span>
          )}
        </div>
        <div className="kb-card__meta">
          <h2 className="kb-card__name">{header.displayName}</h2>
          <p className="kb-card__sub">
            {header.area && <span>{header.area.toLowerCase()}</span>}
            {header.access && <span> · {header.access}</span>}
          </p>
          <dl className="kb-card__stats">
            <div>
              <dt>tag</dt>
              <dd>{header.sectors.slice(0, 3).join(' · ') || '—'}</dd>
            </div>
            {nestedCommunity && (
              <div>
                <dt>community</dt>
                <dd>{nestedCommunity.name.toLowerCase()}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {header.strapline && (
        <p className="kb-card__strapline">&gt; {header.strapline.toLowerCase()}</p>
      )}

      <div className="kb-card__sections">
        {nestedCommunity && (
          <Section
            label="community"
            count={1}
            teaser={nestedCommunity.exclusivity ?? nestedCommunity.name.toLowerCase()}
            open={openSections.has('community')}
            onToggle={() => toggle('community')}
          >
            <p className="kb-section__line">
              <strong>{nestedCommunity.name}</strong>
              {nestedCommunity.exclusivity && <span className="kb-section__pill">{nestedCommunity.exclusivity}</span>}
            </p>
            {nestedCommunity.strapline && (
              <p className="kb-section__line kb-section__line--muted">&gt; {nestedCommunity.strapline.toLowerCase()}</p>
            )}
            {(nestedCommunity.sectors ?? []).length > 0 && (
              <div className="kb-section__tags">
                {(nestedCommunity.sectors ?? []).slice(0, 5).map((t) => (
                  <span key={t} className="kb-tag">{t}</span>
                ))}
              </div>
            )}
          </Section>
        )}

        {eventSeries.length > 0 && (
          <Section
            label="event_series"
            count={eventSeries.length}
            teaser={[eventSeries[0].name.toLowerCase(), eventSeries[0].frequency].filter(Boolean).join(' · ')}
            open={openSections.has('events')}
            onToggle={() => toggle('events')}
          >
            {eventSeries.map((e) => (
              <p key={e.slug} className="kb-section__line">
                <strong>{e.name}</strong>
                {e.frequency && <span className="kb-section__pill">{e.frequency}</span>}
                {e.typical_size != null && <span className="kb-section__pill">~{e.typical_size}</span>}
              </p>
            ))}
          </Section>
        )}

        {people.length > 0 && (
          <Section
            label="people"
            count={people.length}
            teaser={`@${people[0].slug}${people.length > 1 ? ` +${people.length - 1}` : ''}`}
            open={openSections.has('people')}
            onToggle={() => toggle('people')}
          >
            <div className="kb-section__chips">
              {people.map((p) => {
                const link = p.twitter ?? p.linkedin
                const Tag = link ? 'a' : 'span'
                return (
                  <Tag
                    key={p.slug}
                    {...(link ? { href: link, target: '_blank', rel: 'noopener noreferrer' } : {})}
                    className="kb-chip"
                    title={p.role ?? p.name}
                  >
                    @{p.slug}
                  </Tag>
                )
              })}
            </div>
          </Section>
        )}

        {programmes.length > 0 && (
          <Section
            label="programmes"
            count={programmes.length}
            teaser={[programmes[0].name.toLowerCase(), programmes[0].programme_type].filter(Boolean).join(' · ')}
            open={openSections.has('programmes')}
            onToggle={() => toggle('programmes')}
          >
            {programmes.map((p) => (
              <p key={p.slug} className="kb-section__line">
                <strong>{p.name}</strong>
                {p.programme_type && <span className="kb-section__pill">{p.programme_type}</span>}
                {p.applications_open && <span className="kb-section__pill kb-section__pill--hot">apps open</span>}
              </p>
            ))}
          </Section>
        )}
      </div>

      <footer className="kb-card__footer">
        {header.website && (
          <a href={header.website} target="_blank" rel="noopener noreferrer" className="kb-card__link">
            [ visit_site ]
          </a>
        )}
        {header.eventsUrl && (
          <a href={header.eventsUrl} target="_blank" rel="noopener noreferrer" className="kb-card__link">
            [ events ]
          </a>
        )}
        {nestedCommunity?.website && nestedCommunity.website !== header.website && (
          <a href={nestedCommunity.website} target="_blank" rel="noopener noreferrer" className="kb-card__link">
            [ community_site ]
          </a>
        )}
      </footer>
    </article>
  )
}

function Section({
  label,
  count,
  teaser,
  open,
  onToggle,
  children,
}: {
  label: string
  count: number
  teaser?: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className={`kb-section${open ? ' kb-section--open' : ''}`}>
      <button type="button" className="kb-section__header" onClick={onToggle} aria-expanded={open}>
        <span className="kb-section__caret">{open ? '▾' : '▸'}</span>
        <span className="kb-section__label">{label}</span>
        <span className="kb-section__count">({count})</span>
        {!open && teaser && <span className="kb-section__teaser">· {teaser}</span>}
      </button>
      {open && <div className="kb-section__body">{children}</div>}
    </div>
  )
}
