'use client'

import { useEffect, useState } from 'react'
import { CommunitySource, FailedSource, LondonEvent, EventDecision } from '@/lib/types'
import { SystemSource } from '@/lib/scrapers/sources'
import { format } from 'date-fns'
import { EventGrid } from '@/components/EventGrid'

type SystemSourceWithEffective = SystemSource & { effectiveCurated: boolean }

interface AdminData {
  communitySources: CommunitySource[]
  systemSources: { calendars: SystemSourceWithEffective[]; users: SystemSourceWithEffective[] }
  manualEvents: LondonEvent[]
  blocklist: string[]
  failed: FailedSource[]
  events: LondonEvent[]
  pendingReview: LondonEvent[]
  recentDecisions: EventDecision[]
  ebMeetupAllowlist: string[]
}

type Tab = 'events' | 'review' | 'sources' | 'blocklist' | 'failed'
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

  async function post(
    action: string,
    body: Record<string, string | boolean | string[]>,
  ) {
    await fetch('/api/admin', {
      method: 'POST',
      headers: { 'x-admin-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({ action, ...body }),
    })
    await fetchData()
  }

  if (!key) {
    return (
      <main className="min-h-screen app-shell flex items-center justify-center px-4">
        <div className="w-full terminal-panel w-full max-w-sm space-y-4 p-5">
          <h1 className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--accent-bright)]">Admin</h1>
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
            className="w-full bg-[rgba(7,9,9,0.64)] border border-[var(--line)] text-[#f0ede6] font-mono text-sm px-3 py-2 outline-none focus:border-[var(--line-strong)]"
          />
          <button
            onClick={() => {
              if (inputKey) {
                sessionStorage.setItem('admin-key', inputKey)
                setKey(inputKey)
              }
            }}
            className="w-full bg-[rgba(14,21,16,0.84)] text-[var(--accent-bright)] font-mono text-xs uppercase tracking-widest py-2 hover:bg-[rgba(14,21,16,0.84)] transition-colors"
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

  // EB/Meetup events are managed in the Review tab — exclude from the Events tab.
  const eventsTabSource = data?.events.filter((e) => e.source !== 'eventbrite' && e.source !== 'meetup') ?? []

  const filteredEvents = eventsTabSource.filter((e) => {
    if (eventFilter === 'pending') return e.pending && !e.curated
    if (eventFilter === 'curated') return e.curated
    return true
  })

  const pendingCount = eventsTabSource.filter((e) => e.pending && !e.curated).length
  const curatedCount = eventsTabSource.filter((e) => e.curated).length

  const reviewCount = data?.pendingReview.length ?? 0

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'events', label: 'Events', badge: pendingCount || undefined },
    { id: 'review', label: 'Review', badge: reviewCount || undefined },
    { id: 'sources', label: 'Sources' },
    { id: 'blocklist', label: 'Blocklist' },
    { id: 'failed', label: 'Failed', badge: data?.failed.length || undefined },
  ]

  return (
    <main className="min-h-screen app-shell px-4 py-10 sm:px-6 lg:px-8">
      <div className="app-shell__inner space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--accent-bright)]">Admin Dashboard</h1>
          <button
            onClick={() => {
              sessionStorage.removeItem('admin-key')
              setKey('')
              setData(null)
            }}
            className="font-mono text-xs text-[var(--muted)] hover:text-[var(--muted-strong)] uppercase tracking-widest"
          >
            Sign out
          </button>
        </div>

        {/* Tab Nav */}
        <div className="flex gap-1 border-b border-[var(--line)]">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors ${
                activeTab === tab.id
                  ? 'text-[var(--accent-bright)] border-b border-[#c8ff00] -mb-px'
                  : 'text-[#444] hover:text-[var(--muted-strong)]'
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

        {loading && <p className="font-mono text-xs text-[var(--muted)]">Loading…</p>}
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
                    ['all', `All (${eventsTabSource.length})`],
                    ['curated', `Curated (${curatedCount})`],
                  ] as [EventFilter, string][]).map(([f, label]) => (
                    <button
                      key={f}
                      onClick={() => setEventFilter(f)}
                      className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest border transition-colors ${
                        eventFilter === f
                          ? f === 'pending'
                            ? 'bg-amber-500/20 border-amber-500/60 text-amber-400'
                            : 'bg-[rgba(14,21,16,0.84)]/10 border-[#c8ff00]/40 text-[var(--accent-bright)]'
                          : 'border-[var(--line)] text-[#444] hover:text-[var(--muted-strong)] hover:border-[var(--line-strong)]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {filteredEvents.length === 0 ? (
                  <div className="py-16 text-center">
                    <p className="font-mono text-xs uppercase tracking-widest text-[var(--muted)]">
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

            {/* Review Tab — EB/Meetup pending queue + allowlist + decisions log */}
            {activeTab === 'review' && (
              <ReviewTab
                pendingReview={data.pendingReview}
                allowlist={data.ebMeetupAllowlist}
                decisions={data.recentDecisions}
                post={post}
              />
            )}

            {/* Sources Tab */}
            {activeTab === 'sources' && (
              <div className="space-y-10">
                {/* Community Sources — Unreviewed */}
                <section className="space-y-3">
                  <h2 className="font-mono text-xs uppercase tracking-widest text-[var(--muted)]">
                    Community Sources — Unreviewed ({unreviewed.length})
                  </h2>
                  {unreviewed.length === 0 ? (
                    <p className="font-mono text-xs text-[var(--muted)]">None</p>
                  ) : (
                    unreviewed.map((source) => (
                      <SourceRow key={source.slug} source={source} post={post} />
                    ))
                  )}
                </section>

                {/* Community Sources — Reviewed */}
                <section className="space-y-3">
                  <h2 className="font-mono text-xs uppercase tracking-widest text-[var(--muted)]">
                    Community Sources — Reviewed ({reviewed.length})
                  </h2>
                  {reviewed.length === 0 ? (
                    <p className="font-mono text-xs text-[var(--muted)]">None</p>
                  ) : (
                    reviewed.map((source) => (
                      <SourceRow key={source.slug} source={source} post={post} />
                    ))
                  )}
                </section>

                {/* System Sources */}
                <section className="space-y-3">
                  <h2 className="font-mono text-xs uppercase tracking-widest text-[var(--muted)]">
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
                <h2 className="font-mono text-xs uppercase tracking-widest text-[var(--muted)]">
                  Blocklist ({data.blocklist.length})
                </h2>
                {data.blocklist.length === 0 ? (
                  <p className="font-mono text-xs text-[var(--muted)]">None</p>
                ) : (
                  <div className="space-y-2">
                    {data.blocklist.map((id) => (
                      <div key={id} className="flex items-center justify-between border border-[#1e1e1e] px-4 py-2">
                        <span className="font-mono text-xs text-[#f0ede6]">{id}</span>
                        <button
                          onClick={() => post('unblock', { eventId: id })}
                          className="font-mono text-[10px] text-[var(--muted)] hover:text-[var(--accent-bright)] uppercase tracking-widest"
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
                <h2 className="font-mono text-xs uppercase tracking-widest text-[var(--muted)]">
                  Failed Sources — last scrape ({data.failed.length})
                </h2>
                {data.failed.length === 0 ? (
                  <p className="font-mono text-xs text-[var(--muted)]">None</p>
                ) : (
                  <div className="space-y-1">
                    {data.failed.map((f) => (
                      <p key={f.slug} className="font-mono text-xs text-red-400">
                        {f.slug}
                        {f.error && <span className="text-[var(--muted)]"> — {f.error}</span>}
                      </p>
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
  post: (action: string, body: Record<string, string | boolean | string[]>) => Promise<void>
}) {
  return (
    <div className="border border-[#1e1e1e] p-4 space-y-2">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <p className="text-[#f0ede6] text-sm font-bold truncate">
            {source.curated && <span className="text-[var(--accent-bright)] mr-1">★</span>}
            {source.name}
          </p>
          <p className="font-mono text-[10px] text-[var(--muted)]">
            {source.type} · {source.slug}
            {source.addedAt && ` · added ${format(new Date(source.addedAt), 'd MMM yyyy')}`}
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => post('curate-source', { slug: source.slug, curated: !source.curated })}
            className={`px-3 py-1 text-[10px] font-mono uppercase tracking-widest border transition-colors ${
              source.curated
                ? 'border-[#c8ff00] text-[var(--accent-bright)] hover:border-[#555] hover:text-[var(--muted)]'
                : 'border-[var(--line)] text-[var(--muted)] hover:border-[#c8ff00] hover:text-[var(--accent-bright)]'
            }`}
          >
            {source.curated ? '★ Curated' : '☆ Curate'}
          </button>
          {!source.reviewed && (
            <button
              onClick={() => post('review-source', { slug: source.slug })}
              className="px-3 py-1 text-[10px] font-mono uppercase tracking-widest border border-[var(--line)] text-[var(--muted)] hover:border-[#888] hover:text-[var(--muted-strong)] transition-colors"
            >
              ✓ Accept
            </button>
          )}
          <button
            onClick={() => post('remove-source', { slug: source.slug })}
            className="px-3 py-1 text-[10px] font-mono uppercase tracking-widest border border-[var(--line)] text-[var(--muted)] hover:border-red-500 hover:text-red-400 transition-colors"
          >
            Remove
          </button>
        </div>
      </div>
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-[10px] text-[#444] hover:text-[var(--accent-bright)] truncate block"
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
  post: (action: string, body: Record<string, string | boolean | string[]>) => Promise<void>
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 border border-[#161616]">
      <span className="font-mono text-[10px] text-[var(--muted)] w-14">{type}</span>
      <span className="font-mono text-xs text-[#444] flex-1 truncate">{source.slug}</span>
      {source.effectiveCurated !== source.curated && (
        <span className="font-mono text-[10px] text-[var(--muted)]">overridden</span>
      )}
      <button
        onClick={() => post('toggle-system-source', { slug: source.slug, curated: !source.effectiveCurated })}
        className={`px-3 py-1 text-[10px] font-mono uppercase tracking-widest border transition-colors ${
          source.effectiveCurated
            ? 'border-[#c8ff00] text-[var(--accent-bright)] hover:border-[#555] hover:text-[var(--muted)]'
            : 'border-[var(--line)] text-[var(--muted)] hover:border-[#c8ff00] hover:text-[var(--accent-bright)]'
        }`}
      >
        {source.effectiveCurated ? '★ Curated' : '☆ Curate'}
      </button>
    </div>
  )
}

// ─── Review Tab — EB/Meetup pending queue ────────────────────────────────

type ReviewSort = 'date' | 'source'

function ReviewTab({
  pendingReview,
  allowlist,
  decisions,
  post,
}: {
  pendingReview: LondonEvent[]
  allowlist: string[]
  decisions: EventDecision[]
  post: (action: string, body: Record<string, string | boolean | string[]>) => Promise<void>
}) {
  const [sort, setSort] = useState<ReviewSort>('date')
  const [showDecisions, setShowDecisions] = useState(false)
  const [allowlistInput, setAllowlistInput] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkReason, setBulkReason] = useState('')

  const sorted = [...pendingReview].sort((a, b) => {
    if (sort === 'source') return a.source.localeCompare(b.source) || a.startAt.localeCompare(b.startAt)
    return new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  })

  const toggleSelected = (id: string) => {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllVisible = () => setSelected(new Set(sorted.map((e) => e.id)))
  const clearSelection = () => setSelected(new Set())

  async function bulkReject() {
    const ids = [...selected]
    if (ids.length === 0) return
    if (!confirm(`Reject ${ids.length} event(s) permanently? They'll be added to the blocklist and never resurface.`)) return
    setBulkBusy(true)
    try {
      await post('review-bulk', { ids, decision: 'reject', ...(bulkReason ? { reason: bulkReason } : {}) })
      setSelected(new Set())
      setBulkReason('')
    } finally {
      setBulkBusy(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header / sort controls */}
      <div className="flex items-center justify-between">
        <p className="font-mono text-xs text-[var(--muted)]">
          {pendingReview.length} pending · {allowlist.length} allowlisted · {decisions.length} recent decisions
        </p>
        <div className="flex items-center gap-2">
          {(['date', 'source'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest border transition-colors ${
                sort === s
                  ? 'border-[#c8ff00]/40 text-[var(--accent-bright)]'
                  : 'border-[var(--line)] text-[#444] hover:text-[var(--muted-strong)]'
              }`}
            >
              sort: {s}
            </button>
          ))}
        </div>
      </div>

      {/* Allowlist management */}
      <section className="space-y-3">
        <h2 className="font-mono text-xs uppercase tracking-widest text-[var(--muted)]">
          EB/Meetup Allowlist ({allowlist.length})
        </h2>
        <div className="space-y-2">
          {allowlist.length === 0 ? (
            <p className="font-mono text-xs text-[#444]">None — all EB/Meetup events go through review.</p>
          ) : (
            allowlist.map((key) => (
              <div key={key} className="flex items-center gap-3 px-3 py-1.5 border border-[#161616]">
                <span className="font-mono text-xs text-[var(--accent-bright)] flex-1 truncate">{key}</span>
                <button
                  onClick={() => post('allowlist-remove', { key })}
                  className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest border border-[var(--line)] text-[var(--muted)] hover:border-red-500 hover:text-red-400 transition-colors"
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            value={allowlistInput}
            onChange={(e) => setAllowlistInput(e.target.value)}
            placeholder="meetup:<urlname> or eventbrite:<id>"
            className="flex-1 bg-[rgba(7,9,9,0.64)] border border-[var(--line)] text-[#f0ede6] font-mono text-xs px-3 py-1.5 outline-none focus:border-[var(--line-strong)]"
          />
          <button
            onClick={async () => {
              if (allowlistInput.trim()) {
                await post('allowlist-add', { key: allowlistInput.trim() })
                setAllowlistInput('')
              }
            }}
            className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest border border-[#c8ff00]/40 text-[var(--accent-bright)] hover:bg-[rgba(14,21,16,0.84)] transition-colors"
          >
            Add
          </button>
        </div>
      </section>

      {/* Pending events */}
      <section className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-mono text-xs uppercase tracking-widest text-[var(--muted)]">
            Pending Review ({pendingReview.length}) {selected.size > 0 && <span className="text-amber-400">· {selected.size} selected</span>}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={selectAllVisible}
              className="px-2 py-1 font-mono text-[10px] uppercase tracking-widest border border-[var(--line)] text-[var(--muted)] hover:text-[var(--muted-strong)] hover:border-[var(--line-strong)] transition-colors"
            >
              Select all
            </button>
            <button
              onClick={clearSelection}
              disabled={selected.size === 0}
              className="px-2 py-1 font-mono text-[10px] uppercase tracking-widest border border-[var(--line)] text-[var(--muted)] hover:text-[var(--muted-strong)] hover:border-[var(--line-strong)] transition-colors disabled:opacity-30"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Bulk action bar — only shown when there's a selection */}
        {selected.size > 0 && (
          <div className="flex items-center gap-2 p-2 border border-amber-500/40 bg-amber-500/5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-amber-400 px-1">
              {selected.size} selected
            </span>
            <input
              value={bulkReason}
              onChange={(e) => setBulkReason(e.target.value)}
              placeholder="reason for all (optional)"
              className="flex-1 bg-[rgba(7,9,9,0.64)] border border-[var(--line)] text-[#f0ede6] font-mono text-[10px] px-2 py-1 outline-none focus:border-[var(--line-strong)]"
            />
            <button
              disabled={bulkBusy}
              onClick={bulkReject}
              className="px-3 py-1 font-mono text-[10px] uppercase tracking-widest border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30"
            >
              {bulkBusy ? 'Rejecting…' : `Reject ${selected.size}`}
            </button>
          </div>
        )}

        {sorted.length === 0 ? (
          <p className="font-mono text-xs text-[#444]">Queue is empty — all caught up.</p>
        ) : (
          <div className="space-y-2">
            {sorted.map((event) => (
              <ReviewCard
                key={event.id}
                event={event}
                post={post}
                selected={selected.has(event.id)}
                onToggle={() => toggleSelected(event.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Decisions log */}
      <section className="space-y-3">
        <button
          onClick={() => setShowDecisions((v) => !v)}
          className="font-mono text-xs uppercase tracking-widest text-[var(--muted)] hover:text-[var(--muted-strong)]"
        >
          Recent Decisions ({decisions.length}) {showDecisions ? '▾' : '▸'}
        </button>
        {showDecisions && (
          <div className="space-y-1 max-h-96 overflow-y-auto pr-2">
            {decisions.map((d, i) => (
              <div key={`${d.id}-${i}`} className="flex items-start gap-2 px-3 py-1.5 border border-[#161616]">
                <span
                  className={`font-mono text-[10px] uppercase tracking-widest w-16 flex-none ${
                    d.decision === 'feature'
                      ? 'text-[var(--accent-bright)]'
                      : d.decision === 'list'
                        ? 'text-amber-400'
                        : 'text-[#666]'
                  }`}
                >
                  {d.decision}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-xs text-[#f0ede6] truncate">{d.name}</p>
                  <p className="font-mono text-[10px] text-[#444] truncate">
                    {d.organiser}
                    {d.reason ? ` · ${d.reason}` : ''}
                  </p>
                </div>
                <span className="font-mono text-[10px] text-[#444] flex-none">
                  {format(new Date(d.timestamp), 'd MMM HH:mm')}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function ReviewCard({
  event,
  post,
  selected,
  onToggle,
}: {
  event: LondonEvent
  post: (action: string, body: Record<string, string | boolean | string[]>) => Promise<void>
  selected: boolean
  onToggle: () => void
}) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  async function decide(action: string, body: Record<string, string | boolean>) {
    setBusy(true)
    try {
      await post(action, { ...body, ...(reason ? { reason } : {}) })
    } finally {
      setBusy(false)
    }
  }

  const date = new Date(event.startAt)
  const dateLabel = format(date, 'EEE d MMM · HH:mm')
  const sourceLabel = event.source === 'eventbrite' ? 'eventbrite' : 'meetup'

  return (
    <div className={`flex gap-3 p-3 border transition-colors ${selected ? 'border-amber-500/40 bg-amber-500/5' : 'border-[#161616]'}`}>
      {/* Selection checkbox */}
      <label className="flex-none flex items-start pt-1 cursor-pointer">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="w-4 h-4 accent-amber-400 cursor-pointer"
        />
      </label>
      {/* Cover image (or placeholder) */}
      <div className="flex-none w-24 h-24 bg-[#0a0a0a] border border-[#161616] overflow-hidden">
        {event.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.coverUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center font-mono text-[10px] text-[#444]">
            no img
          </div>
        )}
      </div>
      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-mono text-sm text-[#f0ede6] line-clamp-2">{event.name}</h3>
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#444] flex-none">
            {sourceLabel}
          </span>
        </div>
        <p className="font-mono text-xs text-[var(--muted)]">{dateLabel}</p>
        <p className="font-mono text-[10px] text-[#666] truncate">
          <a href={event.url} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--accent-bright)]">
            {event.organiserName || event.calendarSlug || ''}
          </a>
          {event.calendarSlug && ` · ${event.calendarSlug}`}
        </p>
        <p className="font-mono text-[10px] text-[#444] truncate">{event.locationName}</p>
        {/* Action row */}
        <div className="flex items-center gap-1 pt-1">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="reason (optional)"
            className="flex-1 bg-[rgba(7,9,9,0.64)] border border-[var(--line)] text-[#f0ede6] font-mono text-[10px] px-2 py-1 outline-none focus:border-[var(--line-strong)]"
          />
          <button
            disabled={busy}
            onClick={() => decide('review-decision', { id: event.id, decision: 'feature' })}
            className="px-2 py-1 font-mono text-[10px] uppercase tracking-widest border border-[#c8ff00]/40 text-[var(--accent-bright)] hover:bg-[rgba(14,21,16,0.84)] transition-colors disabled:opacity-30"
          >
            ★ Feature
          </button>
          <button
            disabled={busy}
            onClick={() => decide('review-decision', { id: event.id, decision: 'list' })}
            className="px-2 py-1 font-mono text-[10px] uppercase tracking-widest border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 transition-colors disabled:opacity-30"
          >
            List
          </button>
          <button
            disabled={busy}
            onClick={() => decide('review-decision', { id: event.id, decision: 'reject' })}
            className="px-2 py-1 font-mono text-[10px] uppercase tracking-widest border border-[var(--line)] text-[var(--muted)] hover:border-red-500 hover:text-red-400 transition-colors disabled:opacity-30"
          >
            Reject
          </button>
          <button
            disabled={busy || !event.calendarSlug}
            title={event.calendarSlug ? `Allowlist ${event.calendarSlug}` : 'No calendarSlug'}
            onClick={() => decide('trust-organiser', { id: event.id })}
            className="px-2 py-1 font-mono text-[10px] uppercase tracking-widest border border-[var(--line)] text-[var(--muted)] hover:border-[#c8ff00] hover:text-[var(--accent-bright)] transition-colors disabled:opacity-30"
          >
            Trust src
          </button>
        </div>
      </div>
    </div>
  )
}
