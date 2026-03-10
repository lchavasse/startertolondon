'use client'

import { useEffect, useState } from 'react'
import { CommunitySource, LondonEvent } from '@/lib/types'
import { SystemSource } from '@/lib/scrapers/sources'
import { format } from 'date-fns'
import { EventGrid } from '@/components/EventGrid'

type SystemSourceWithEffective = SystemSource & { effectiveCurated: boolean }

interface AdminData {
  communitySources: CommunitySource[]
  systemSources: { calendars: SystemSourceWithEffective[]; users: SystemSourceWithEffective[] }
  manualEvents: LondonEvent[]
  blocklist: string[]
  failed: string[]
  events: LondonEvent[]
}

type Tab = 'events' | 'sources' | 'blocklist' | 'failed'
type EventFilter = 'pending' | 'all' | 'curated'

export default function AdminPage() {
  const [key, setKey] = useState('')
  const [inputKey, setInputKey] = useState('')
  const [data, setData] = useState<AdminData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('events')
  const [eventFilter, setEventFilter] = useState<EventFilter>('pending')

  useEffect(() => {
    const stored = sessionStorage.getItem('admin-key')
    if (stored) setKey(stored)
  }, [])

  useEffect(() => {
    if (key) fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    if (!key) return
    const onFocus = () => { if (document.visibilityState === 'visible') fetchData() }
    document.addEventListener('visibilitychange', onFocus)
    return () => document.removeEventListener('visibilitychange', onFocus)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  async function fetchData() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin', { headers: { 'x-admin-key': key } })
      if (res.status === 401) {
        setError('Invalid admin key')
        setKey('')
        sessionStorage.removeItem('admin-key')
        setData(null)
        return
      }
      setData(await res.json())
    } catch {
      setError('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  async function post(action: string, body: Record<string, string | boolean>) {
    await fetch('/api/admin', {
      method: 'POST',
      headers: { 'x-admin-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({ action, ...body }),
    })
    await fetchData()
  }

  if (!key) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-4">
          <h1 className="font-mono text-xs uppercase tracking-[0.3em] text-[#c8ff00]">Admin</h1>
          <input
            type="password"
            placeholder="Enter admin key"
            value={inputKey}
            onChange={(e) => setInputKey(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && inputKey) {
                sessionStorage.setItem('admin-key', inputKey)
                setKey(inputKey)
              }
            }}
            className="w-full bg-[#111] border border-[#2a2a2a] text-[#f0ede6] font-mono text-sm px-3 py-2 outline-none focus:border-[#c8ff00]"
          />
          <button
            onClick={() => {
              if (inputKey) {
                sessionStorage.setItem('admin-key', inputKey)
                setKey(inputKey)
              }
            }}
            className="w-full bg-[#c8ff00] text-black font-mono text-xs uppercase tracking-widest py-2 hover:bg-white transition-colors"
          >
            Enter
          </button>
          {error && <p className="font-mono text-xs text-red-400">{error}</p>}
        </div>
      </main>
    )
  }

  const unreviewed = data?.communitySources.filter((s) => !s.reviewed) ?? []
  const reviewed = data?.communitySources.filter((s) => s.reviewed) ?? []

  const allTags = data
    ? [...new Set(data.events.flatMap((e) => e.tags))].sort()
    : []

  function handleEventUpdate(id: string, update: Partial<LondonEvent> | 'deleted') {
    if (!data) return
    setData({
      ...data,
      events: update === 'deleted'
        ? data.events.filter((e) => e.id !== id)
        : data.events.map((e) => e.id === id ? { ...e, ...update } : e),
    })
  }

  const filteredEvents = data?.events.filter((e) => {
    if (eventFilter === 'pending') return e.pending && !e.curated
    if (eventFilter === 'curated') return e.curated
    return true
  }) ?? []

  const pendingCount = data?.events.filter((e) => e.pending && !e.curated).length ?? 0
  const curatedCount = data?.events.filter((e) => e.curated).length ?? 0

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'events', label: 'Events', badge: pendingCount || undefined },
    { id: 'sources', label: 'Sources' },
    { id: 'blocklist', label: 'Blocklist' },
    { id: 'failed', label: 'Failed', badge: data?.failed.length || undefined },
  ]

  return (
    <main className="min-h-screen bg-[#0a0a0a] px-4 py-10 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-mono text-xs uppercase tracking-[0.3em] text-[#c8ff00]">Admin Dashboard</h1>
          <button
            onClick={() => {
              sessionStorage.removeItem('admin-key')
              setKey('')
              setData(null)
            }}
            className="font-mono text-xs text-[#555] hover:text-[#888] uppercase tracking-widest"
          >
            Sign out
          </button>
        </div>

        {/* Tab Nav */}
        <div className="flex gap-1 border-b border-[#1a1a1a]">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors ${
                activeTab === tab.id
                  ? 'text-[#c8ff00] border-b border-[#c8ff00] -mb-px'
                  : 'text-[#444] hover:text-[#888]'
              }`}
            >
              {tab.label}
              {tab.badge != null && (
                <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-[8px] font-mono rounded-sm">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading && <p className="font-mono text-xs text-[#555]">Loading…</p>}
        {error && <p className="font-mono text-xs text-red-400">{error}</p>}

        {data && (
          <>
            {/* Events Tab */}
            {activeTab === 'events' && (
              <div className="space-y-4">
                {/* Event filter bar */}
                <div className="flex items-center gap-2">
                  {([
                    ['pending', `Pending (${pendingCount})`],
                    ['all', `All (${data.events.length})`],
                    ['curated', `Curated (${curatedCount})`],
                  ] as [EventFilter, string][]).map(([f, label]) => (
                    <button
                      key={f}
                      onClick={() => setEventFilter(f)}
                      className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest border transition-colors ${
                        eventFilter === f
                          ? f === 'pending'
                            ? 'bg-amber-500/20 border-amber-500/60 text-amber-400'
                            : 'bg-[#c8ff00]/10 border-[#c8ff00]/40 text-[#c8ff00]'
                          : 'border-[#2a2a2a] text-[#444] hover:text-[#888] hover:border-[#444]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {filteredEvents.length === 0 ? (
                  <div className="py-16 text-center">
                    <p className="font-mono text-xs uppercase tracking-widest text-[#333]">
                      {eventFilter === 'pending' ? 'No pending events — all caught up' : 'No events'}
                    </p>
                  </div>
                ) : (
                  <EventGrid
                    events={filteredEvents}
                    tags={allTags}
                    forceAdminMode={true}
                    forceAdminKey={key}
                    onEventUpdate={handleEventUpdate}
                  />
                )}
              </div>
            )}

            {/* Sources Tab */}
            {activeTab === 'sources' && (
              <div className="space-y-10">
                {/* Community Sources — Unreviewed */}
                <section className="space-y-3">
                  <h2 className="font-mono text-xs uppercase tracking-widest text-[#555]">
                    Community Sources — Unreviewed ({unreviewed.length})
                  </h2>
                  {unreviewed.length === 0 ? (
                    <p className="font-mono text-xs text-[#333]">None</p>
                  ) : (
                    unreviewed.map((source) => (
                      <SourceRow key={source.slug} source={source} post={post} />
                    ))
                  )}
                </section>

                {/* Community Sources — Reviewed */}
                <section className="space-y-3">
                  <h2 className="font-mono text-xs uppercase tracking-widest text-[#555]">
                    Community Sources — Reviewed ({reviewed.length})
                  </h2>
                  {reviewed.length === 0 ? (
                    <p className="font-mono text-xs text-[#333]">None</p>
                  ) : (
                    reviewed.map((source) => (
                      <SourceRow key={source.slug} source={source} post={post} />
                    ))
                  )}
                </section>

                {/* System Sources */}
                <section className="space-y-3">
                  <h2 className="font-mono text-xs uppercase tracking-widest text-[#555]">
                    System Sources ({data.systemSources.calendars.length + data.systemSources.users.length})
                  </h2>
                  <div className="space-y-1">
                    {data.systemSources.calendars.map((s) => (
                      <SystemSourceRow key={s.slug} source={s} type="calendar" post={post} />
                    ))}
                    {data.systemSources.users.map((s) => (
                      <SystemSourceRow key={s.slug} source={s} type="user" post={post} />
                    ))}
                  </div>
                </section>
              </div>
            )}

            {/* Blocklist Tab */}
            {activeTab === 'blocklist' && (
              <section className="space-y-3">
                <h2 className="font-mono text-xs uppercase tracking-widest text-[#555]">
                  Blocklist ({data.blocklist.length})
                </h2>
                {data.blocklist.length === 0 ? (
                  <p className="font-mono text-xs text-[#333]">None</p>
                ) : (
                  <div className="space-y-2">
                    {data.blocklist.map((id) => (
                      <div key={id} className="flex items-center justify-between border border-[#1e1e1e] px-4 py-2">
                        <span className="font-mono text-xs text-[#f0ede6]">{id}</span>
                        <button
                          onClick={() => post('unblock', { eventId: id })}
                          className="font-mono text-[10px] text-[#555] hover:text-[#c8ff00] uppercase tracking-widest"
                        >
                          Unblock
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Failed Tab */}
            {activeTab === 'failed' && (
              <section className="space-y-3">
                <h2 className="font-mono text-xs uppercase tracking-widest text-[#555]">
                  Failed Sources — last scrape ({data.failed.length})
                </h2>
                {data.failed.length === 0 ? (
                  <p className="font-mono text-xs text-[#333]">None</p>
                ) : (
                  <div className="space-y-1">
                    {data.failed.map((slug) => (
                      <p key={slug} className="font-mono text-xs text-red-400">{slug}</p>
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  )
}

function SourceRow({
  source,
  post,
}: {
  source: CommunitySource
  post: (action: string, body: Record<string, string | boolean>) => Promise<void>
}) {
  return (
    <div className="border border-[#1e1e1e] p-4 space-y-2">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <p className="text-[#f0ede6] text-sm font-bold truncate">
            {source.curated && <span className="text-[#c8ff00] mr-1">★</span>}
            {source.name}
          </p>
          <p className="font-mono text-[10px] text-[#555]">
            {source.type} · {source.slug}
            {source.addedAt && ` · added ${format(new Date(source.addedAt), 'd MMM yyyy')}`}
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => post('curate-source', { slug: source.slug, curated: !source.curated })}
            className={`px-3 py-1 text-[10px] font-mono uppercase tracking-widest border transition-colors ${
              source.curated
                ? 'border-[#c8ff00] text-[#c8ff00] hover:border-[#555] hover:text-[#555]'
                : 'border-[#2a2a2a] text-[#555] hover:border-[#c8ff00] hover:text-[#c8ff00]'
            }`}
          >
            {source.curated ? '★ Curated' : '☆ Curate'}
          </button>
          {!source.reviewed && (
            <button
              onClick={() => post('review-source', { slug: source.slug })}
              className="px-3 py-1 text-[10px] font-mono uppercase tracking-widest border border-[#2a2a2a] text-[#555] hover:border-[#888] hover:text-[#888] transition-colors"
            >
              ✓ Accept
            </button>
          )}
          <button
            onClick={() => post('remove-source', { slug: source.slug })}
            className="px-3 py-1 text-[10px] font-mono uppercase tracking-widest border border-[#2a2a2a] text-[#555] hover:border-red-500 hover:text-red-400 transition-colors"
          >
            Remove
          </button>
        </div>
      </div>
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-[10px] text-[#444] hover:text-[#c8ff00] truncate block"
      >
        {source.url}
      </a>
    </div>
  )
}

function SystemSourceRow({
  source,
  type,
  post,
}: {
  source: SystemSourceWithEffective
  type: 'calendar' | 'user'
  post: (action: string, body: Record<string, string | boolean>) => Promise<void>
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 border border-[#161616]">
      <span className="font-mono text-[10px] text-[#333] w-14">{type}</span>
      <span className="font-mono text-xs text-[#444] flex-1 truncate">{source.slug}</span>
      {source.effectiveCurated !== source.curated && (
        <span className="font-mono text-[10px] text-[#555]">overridden</span>
      )}
      <button
        onClick={() => post('toggle-system-source', { slug: source.slug, curated: !source.effectiveCurated })}
        className={`px-3 py-1 text-[10px] font-mono uppercase tracking-widest border transition-colors ${
          source.effectiveCurated
            ? 'border-[#c8ff00] text-[#c8ff00] hover:border-[#555] hover:text-[#555]'
            : 'border-[#2a2a2a] text-[#555] hover:border-[#c8ff00] hover:text-[#c8ff00]'
        }`}
      >
        {source.effectiveCurated ? '★ Curated' : '☆ Curate'}
      </button>
    </div>
  )
}
