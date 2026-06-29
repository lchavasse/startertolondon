'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { JUDGING_CRITERIA, MAX_SCORE } from '@/lib/aitw-judging'

type Project = {
  id: string
  name: string
  description: string | null
  submissionUrl: string | null
  submitted: boolean
}
type JudgeData = { judge: string; projects: Project[]; scores: Record<string, Record<string, number>> }
type Scores = Record<string, Record<string, string>> // projectId -> criterion -> input value
type FieldState = 'saving' | 'saved' | 'error'

const NAME_KEY = 'judge-name'
const PASS_KEY = 'judge-key'

export default function JudgePage() {
  const [name, setName] = useState('')
  const [pass, setPass] = useState('')
  const [authed, setAuthed] = useState(false)
  const [inputName, setInputName] = useState('')
  const [inputPass, setInputPass] = useState('')
  const [data, setData] = useState<JudgeData | null>(null)
  const [scores, setScores] = useState<Scores>({})
  const [status, setStatus] = useState<Record<string, FieldState>>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const saved = useRef<Record<string, number>>({}) // `${pid}:${crit}` -> last-saved score

  const load = useCallback(async (judgeName: string, key: string): Promise<boolean> => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/aitw/judge?name=${encodeURIComponent(judgeName)}`, {
        headers: { 'x-judge-key': key },
      })
      if (res.status === 401) {
        setError('wrong password')
        return false
      }
      if (!res.ok) {
        setError('something broke — try again')
        return false
      }
      const d: JudgeData = await res.json()
      setData(d)
      // seed local input state + last-saved refs from the server
      const seeded: Scores = {}
      saved.current = {}
      for (const p of d.projects) {
        const row = d.scores[p.id] ?? {}
        seeded[p.id] = {}
        for (const c of JUDGING_CRITERIA) {
          const v = row[c.key]
          seeded[p.id][c.key] = typeof v === 'number' ? String(v) : ''
          if (typeof v === 'number') saved.current[`${p.id}:${c.key}`] = v
        }
      }
      setScores(seeded)
      setAuthed(true)
      return true
    } catch {
      setError('something broke — try again')
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const n = sessionStorage.getItem(NAME_KEY)
    const k = sessionStorage.getItem(PASS_KEY)
    if (n && k) {
      setName(n)
      setPass(k)
      load(n, k)
    }
  }, [load])

  const enter = async () => {
    if (!inputName.trim() || !inputPass) return
    const ok = await load(inputName.trim(), inputPass)
    if (ok) {
      sessionStorage.setItem(NAME_KEY, inputName.trim())
      sessionStorage.setItem(PASS_KEY, inputPass)
      setName(inputName.trim())
      setPass(inputPass)
    }
  }

  const signOut = () => {
    sessionStorage.removeItem(NAME_KEY)
    sessionStorage.removeItem(PASS_KEY)
    setAuthed(false)
    setData(null)
    setName('')
    setPass('')
    setInputPass('')
  }

  const setScore = (projectId: string, criterion: string, value: string) => {
    setScores((s) => ({ ...s, [projectId]: { ...s[projectId], [criterion]: value } }))
  }

  const save = async (projectId: string, criterion: string) => {
    const field = `${projectId}:${criterion}`
    const raw = scores[projectId]?.[criterion] ?? ''
    if (raw === '') return // nothing entered yet
    let n = Math.round(Number(raw))
    if (!Number.isFinite(n)) {
      setStatus((s) => ({ ...s, [field]: 'error' }))
      return
    }
    n = Math.max(0, Math.min(MAX_SCORE, n))
    if (String(n) !== raw) setScore(projectId, criterion, String(n)) // reflect clamp
    if (saved.current[field] === n) return // unchanged

    setStatus((s) => ({ ...s, [field]: 'saving' }))
    try {
      const res = await fetch('/api/aitw/judge', {
        method: 'POST',
        headers: { 'x-judge-key': pass, 'content-type': 'application/json' },
        body: JSON.stringify({ name, projectId, criterion, score: n }),
      })
      if (!res.ok) throw new Error()
      saved.current[field] = n
      setStatus((s) => ({ ...s, [field]: 'saved' }))
      setTimeout(() => setStatus((s) => (s[field] === 'saved' ? { ...s, [field]: undefined as never } : s)), 1500)
    } catch {
      setStatus((s) => ({ ...s, [field]: 'error' }))
    }
  }

  const total = (projectId: string) =>
    JUDGING_CRITERIA.reduce((sum, c) => {
      const n = Number(scores[projectId]?.[c.key])
      return sum + (Number.isFinite(n) ? n : 0)
    }, 0)

  return (
    <main className="aitw-shell">
      <div className="docs-inner">
        <div className="docs-topbar">
          <span className="docs-brand">
            <Link href="/">london calling</Link>
            {' / '}
            <Link href="/agents-in-the-wild">agents in the wild</Link>
            {' / judging'}
          </span>
        </div>

        {!authed ? (
          <section className="aitw-team">
            <p className="aitw-eyebrow">judging</p>
            <h1 className="aitw-section__title">Judge sign-in</h1>
            <p className="aitw-team__lead">
              Enter your name and the judging password. Scores save automatically.
            </p>
            <form
              className="aitw-team__stack"
              onSubmit={(e) => {
                e.preventDefault()
                enter()
              }}
            >
              <label className="aitw-team__field">
                <span>your name</span>
                <input
                  className="aitw-input"
                  value={inputName}
                  onChange={(e) => setInputName(e.target.value)}
                  autoFocus
                />
              </label>
              <label className="aitw-team__field">
                <span>judging password</span>
                <input
                  className="aitw-input"
                  type="password"
                  value={inputPass}
                  onChange={(e) => setInputPass(e.target.value)}
                />
              </label>
              <div className="aitw-team__row">
                <button
                  className="aitw-cta aitw-cta--sm"
                  type="submit"
                  disabled={loading || !inputName.trim() || !inputPass}
                >
                  {loading ? '…' : 'enter →'}
                </button>
              </div>
              {error && <p className="aitw-team__error">{error}</p>}
            </form>
          </section>
        ) : (
          <section className="aitw-team">
            <div className="aitw-team__header">
              <p className="aitw-eyebrow">judging · {data?.judge}</p>
              <span className="aitw-team__whoami">
                <button className="aitw-team__link aitw-team__link--dim" onClick={signOut}>
                  not you?
                </button>
              </span>
            </div>

            <p className="aitw-team__hint">
              Score each project 0–{MAX_SCORE} on every criterion. Saves on its own as you go.
            </p>
            {error && <p className="aitw-team__error">{error}</p>}

            {data?.projects.map((p) => (
              <div className="aitw-team__panel" key={p.id}>
                <div className="aitw-team__header">
                  <h2 className="aitw-section__title">{p.name}</h2>
                  <span className="aitw-team__status">{total(p.id)} / 100</span>
                </div>
                {p.description && <p className="aitw-team__lead">{p.description}</p>}
                {p.submissionUrl && (
                  <p className="aitw-team__hint">
                    <a className="aitw-team__link" href={p.submissionUrl} target="_blank" rel="noopener noreferrer">
                      open submission →
                    </a>
                  </p>
                )}
                <div className="aitw-judge__grid">
                  {JUDGING_CRITERIA.map((c) => {
                    const field = `${p.id}:${c.key}`
                    const st = status[field]
                    return (
                      <label className="aitw-team__field aitw-judge__cell" key={c.key}>
                        <span title={c.desc}>
                          {c.label}
                          {st === 'saving' && ' · …'}
                          {st === 'saved' && ' · ✓'}
                          {st === 'error' && ' · ✗'}
                        </span>
                        <input
                          className="aitw-input"
                          type="number"
                          min={0}
                          max={MAX_SCORE}
                          step={1}
                          inputMode="numeric"
                          value={scores[p.id]?.[c.key] ?? ''}
                          onChange={(e) => setScore(p.id, c.key, e.target.value)}
                          onBlur={() => save(p.id, c.key)}
                        />
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
          </section>
        )}
      </div>
    </main>
  )
}
