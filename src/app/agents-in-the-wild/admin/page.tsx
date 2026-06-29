'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

type Member = { id: string; name: string }
type Project = {
  id: string
  name: string
  description: string | null
  submissionUrl: string | null
  submittedAt: string | null
  late: boolean
  createdAt: string
  archived: boolean
  members: Member[]
}
type JudgeProgress = { name: string; slug: string; completed: number; partial: number }
type LeaderRow = {
  projectId: string
  judgeCount: number
  avgTotal: number
  criteria: Record<string, number | null>
}
type Judging = {
  criteria: { key: string; label: string }[]
  judges: JudgeProgress[]
  leaderboard: LeaderRow[]
}
type AdminData = { projects: Project[]; solo: Member[]; deadline: string; judging: Judging }

const KEY = 'admin-key'

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AitwAdminPage() {
  const [key, setKey] = useState('')
  const [inputKey, setInputKey] = useState('')
  const [data, setData] = useState<AdminData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [acting, setActing] = useState('')

  const fetchData = useCallback(async (adminKey: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/aitw/admin', { headers: { 'x-admin-key': adminKey } })
      if (res.status === 401) {
        setError('invalid admin key')
        setKey('')
        sessionStorage.removeItem(KEY)
        setData(null)
        return
      }
      setData(await res.json())
    } catch {
      setError('failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const stored = sessionStorage.getItem(KEY)
    if (stored) {
      setKey(stored)
      fetchData(stored)
    }
  }, [fetchData])

  const enter = () => {
    if (!inputKey) return
    sessionStorage.setItem(KEY, inputKey)
    setKey(inputKey)
    fetchData(inputKey)
  }

  const act = async (action: 'archive' | 'unarchive', project: Project) => {
    setActing(project.id)
    try {
      const res = await fetch('/api/aitw/admin', {
        method: 'POST',
        headers: { 'x-admin-key': key, 'content-type': 'application/json' },
        body: JSON.stringify({ action, projectId: project.id }),
      })
      if (!res.ok) {
        setError('action failed')
        return
      }
      await fetchData(key)
    } catch {
      setError('action failed')
    } finally {
      setActing('')
    }
  }

  return (
    <main className="aitw-shell">
      <div className="docs-inner">
        <div className="docs-topbar">
          <span className="docs-brand">
            <Link href="/">london calling</Link>
            {' / '}
            <Link href="/agents-in-the-wild">agents in the wild</Link>
            {' / admin'}
          </span>
        </div>

        {!key ? (
          <section className="aitw-team">
            <p className="aitw-eyebrow">admin</p>
            <h1 className="aitw-section__title">Submissions</h1>
            <p className="aitw-team__lead">Enter the admin key to view every team and submission.</p>
            <form
              className="aitw-team__row"
              onSubmit={(e) => {
                e.preventDefault()
                enter()
              }}
            >
              <input
                className="aitw-input"
                type="password"
                placeholder="admin key"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                autoFocus
              />
              <button className="aitw-cta aitw-cta--sm" type="submit">
                enter →
              </button>
            </form>
            {error && <p className="aitw-team__error">{error}</p>}
          </section>
        ) : (
          <section className="aitw-team">
            <div className="aitw-team__header">
              <p className="aitw-eyebrow">admin · submissions</p>
              <span className="aitw-team__whoami">
                <button
                  className="aitw-team__link aitw-team__link--dim"
                  onClick={() => fetchData(key)}
                >
                  refresh
                </button>
                {' · '}
                <button
                  className="aitw-team__link aitw-team__link--dim"
                  onClick={() => {
                    sessionStorage.removeItem(KEY)
                    setKey('')
                    setData(null)
                  }}
                >
                  sign out
                </button>
              </span>
            </div>

            {loading && <p className="aitw-team__status">loading…</p>}
            {error && <p className="aitw-team__error">{error}</p>}

            {data && (() => {
              const active = data.projects.filter((p) => !p.archived)
              const archived = data.projects.filter((p) => p.archived)
              const nameById = new Map(data.projects.map((p) => [p.id, p.name]))
              return (
              <>
                <p className="aitw-team__hint">
                  {active.length} team{active.length === 1 ? '' : 's'} ·{' '}
                  {active.filter((p) => p.submittedAt).length} submitted · deadline{' '}
                  {fmt(data.deadline)}
                  {archived.length > 0 && ` · ${archived.length} archived`}
                </p>

                <JudgingSection judging={data.judging} nameById={nameById} />

                {active.map((p) => (
                  <ProjectCard key={p.id} project={p} acting={acting === p.id} act={act} />
                ))}

                {archived.length > 0 && (
                  <>
                    <p className="aitw-eyebrow">archived ({archived.length})</p>
                    {archived.map((p) => (
                      <ProjectCard key={p.id} project={p} acting={acting === p.id} act={act} />
                    ))}
                  </>
                )}

                {data.solo.length > 0 && (
                  <div className="aitw-team__panel">
                    <p className="aitw-eyebrow">not on a team ({data.solo.length})</p>
                    <ul className="aitw-team__members">
                      {data.solo.map((b) => (
                        <li key={b.id}>{b.name}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
              )
            })()}
          </section>
        )}
      </div>
    </main>
  )
}

function JudgingSection({
  judging,
  nameById,
}: {
  judging: Judging
  nameById: Map<string, string>
}) {
  const scored = judging.leaderboard.filter((r) => r.judgeCount > 0)
  const judged = judging.judges.length

  return (
    <div className="aitw-team__panel">
      <div className="aitw-team__header">
        <h2 className="aitw-section__title">Judging</h2>
        <span className="aitw-team__status">
          {judged === 0
            ? 'no judges yet'
            : `${judged} judge${judged === 1 ? '' : 's'} · ${scored.length} scored`}
        </span>
      </div>

      {judged === 0 ? (
        <p className="aitw-team__hint">
          No scores submitted yet. Live totals appear here as judges score at{' '}
          <Link className="aitw-team__link" href="/agents-in-the-wild/judge">
            /judge
          </Link>
          .
        </p>
      ) : (
        <>
          <div className="aitw-judge__board">
            <table className="aitw-board">
              <thead>
                <tr>
                  <th className="aitw-board__rank">#</th>
                  <th className="aitw-board__name">project</th>
                  {judging.criteria.map((c) => (
                    <th key={c.key} className="aitw-board__num">
                      {c.label.slice(0, 4).toLowerCase()}
                    </th>
                  ))}
                  <th className="aitw-board__num">avg / 100</th>
                  <th className="aitw-board__num">judges</th>
                </tr>
              </thead>
              <tbody>
                {judging.leaderboard.map((r, i) => (
                  <tr key={r.projectId} className={r.judgeCount === 0 ? 'aitw-board__empty' : undefined}>
                    <td className="aitw-board__rank">{r.judgeCount ? i + 1 : '–'}</td>
                    <td className="aitw-board__name">{nameById.get(r.projectId) ?? r.projectId}</td>
                    {judging.criteria.map((c) => (
                      <td key={c.key} className="aitw-board__num">
                        {r.criteria[c.key] == null ? '–' : r.criteria[c.key]!.toFixed(1)}
                      </td>
                    ))}
                    <td className="aitw-board__num aitw-board__total">
                      {r.judgeCount ? r.avgTotal.toFixed(1) : '–'}
                    </td>
                    <td className="aitw-board__num">{r.judgeCount || '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="aitw-eyebrow">judges</p>
          <ul className="aitw-team__members">
            {judging.judges.map((j) => (
              <li key={j.slug}>
                {j.name} — {j.completed} done
                {j.partial > 0 && `, ${j.partial} partial`}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function ProjectCard({
  project: p,
  acting,
  act,
}: {
  project: Project
  acting: boolean
  act: (action: 'archive' | 'unarchive', project: Project) => void
}) {
  return (
    <div className="aitw-team__panel" style={p.archived ? { opacity: 0.55 } : undefined}>
      <div className="aitw-team__header">
        <h2 className="aitw-section__title">{p.name}</h2>
        <span className={`aitw-team__status${p.late ? ' aitw-team__hint--late' : ''}`}>
          {p.submittedAt
            ? `${p.late ? '⚠ late · ' : '✓ '}submitted ${fmt(p.submittedAt)}`
            : 'not submitted'}
        </span>
      </div>
      {p.description && <p className="aitw-team__lead">{p.description}</p>}
      {p.submissionUrl && (
        <p className="aitw-team__hint">
          <a className="aitw-team__link" href={p.submissionUrl} target="_blank" rel="noopener noreferrer">
            open submission →
          </a>
        </p>
      )}
      <ul className="aitw-team__members">
        {p.members.length === 0 && <li>(no members)</li>}
        {p.members.map((m) => (
          <li key={m.id}>{m.name}</li>
        ))}
      </ul>
      <div className="aitw-team__row">
        {p.archived ? (
          <button
            className="aitw-team__link aitw-team__link--dim"
            disabled={acting}
            onClick={() => act('unarchive', p)}
          >
            {acting ? '…' : 'restore'}
          </button>
        ) : (
          <button
            className="aitw-team__link aitw-team__link--dim"
            disabled={acting}
            onClick={() => act('archive', p)}
          >
            {acting ? '…' : 'archive'}
          </button>
        )}
      </div>
    </div>
  )
}
