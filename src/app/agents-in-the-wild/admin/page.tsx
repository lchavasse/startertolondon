'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

type Member = { id: string; name: string; email: string; phone: string | null }
type Project = {
  id: string
  name: string
  description: string | null
  submissionUrl: string | null
  submittedAt: string | null
  late: boolean
  createdAt: string
  members: Member[]
}
type AdminData = { projects: Project[]; solo: Member[]; deadline: string }

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

            {data && (
              <>
                <p className="aitw-team__hint">
                  {data.projects.length} team{data.projects.length === 1 ? '' : 's'} ·{' '}
                  {data.projects.filter((p) => p.submittedAt).length} submitted · deadline{' '}
                  {fmt(data.deadline)}
                </p>

                {data.projects.map((p) => (
                  <div className="aitw-team__panel" key={p.id}>
                    <div className="aitw-team__header">
                      <h2 className="aitw-section__title">{p.name}</h2>
                      <span
                        className={`aitw-team__status${p.late ? ' aitw-team__hint--late' : ''}`}
                      >
                        {p.submittedAt
                          ? `${p.late ? '⚠ late · ' : '✓ '}submitted ${fmt(p.submittedAt)}`
                          : 'not submitted'}
                      </span>
                    </div>
                    {p.description && <p className="aitw-team__lead">{p.description}</p>}
                    {p.submissionUrl && (
                      <p className="aitw-team__hint">
                        <a
                          className="aitw-team__link"
                          href={p.submissionUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          open submission →
                        </a>
                      </p>
                    )}
                    <ul className="aitw-team__members">
                      {p.members.length === 0 && <li>(no members)</li>}
                      {p.members.map((m) => (
                        <li key={m.id}>
                          {m.name} — <a className="aitw-team__link" href={`mailto:${m.email}`}>{m.email}</a>
                          {m.phone && ` · ${m.phone}`}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}

                {data.solo.length > 0 && (
                  <div className="aitw-team__panel">
                    <p className="aitw-eyebrow">not on a team ({data.solo.length})</p>
                    <ul className="aitw-team__members">
                      {data.solo.map((b) => (
                        <li key={b.id}>
                          {b.name} — <a className="aitw-team__link" href={`mailto:${b.email}`}>{b.email}</a>
                          {b.phone && ` · ${b.phone}`}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </section>
        )}
      </div>
    </main>
  )
}
