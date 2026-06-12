'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { BuilderView, ProjectView } from '@/lib/aitw'

const EMAIL_KEY = 'aitw-email'
const DEADLINE = new Date('2026-06-28T23:59:59+01:00')

type Identity = { builder: BuilderView; project: ProjectView | null }
type Phase = 'loading' | 'gate' | 'signup' | 'home'
type SaveState = 'idle' | 'saving' | 'saved' | 'error'

class ApiError extends Error {
  constructor(public code: string, public status: number) {
    super(code)
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(json.error ?? 'server_error', res.status)
  return json as T
}

export default function TeamClient() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [identity, setIdentity] = useState<Identity | null>(null)
  const [email, setEmail] = useState('')
  const [gateError, setGateError] = useState('')

  const identify = useCallback(async (value: string): Promise<boolean> => {
    try {
      const id = await api<Identity>('/api/aitw/identify', {
        method: 'POST',
        body: JSON.stringify({ email: value }),
      })
      localStorage.setItem(EMAIL_KEY, id.builder.email)
      setIdentity(id)
      setPhase('home')
      return true
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return false
      setGateError('something broke — try again')
      return false
    }
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem(EMAIL_KEY)
    if (!stored) {
      setPhase('gate')
      return
    }
    setEmail(stored)
    identify(stored).then((ok) => {
      if (!ok) setPhase('gate')
    })
  }, [identify])

  const signOut = () => {
    localStorage.removeItem(EMAIL_KEY)
    setIdentity(null)
    setEmail('')
    setPhase('gate')
  }

  if (phase === 'loading') {
    return <p className="aitw-team__status">loading…</p>
  }

  if (phase === 'gate') {
    return (
      <Gate
        email={email}
        setEmail={setEmail}
        error={gateError}
        onSubmit={async () => {
          setGateError('')
          const ok = await identify(email)
          if (!ok) setPhase('signup')
        }}
      />
    )
  }

  if (phase === 'signup') {
    return (
      <Signup
        email={email}
        onDone={(id) => {
          localStorage.setItem(EMAIL_KEY, id.builder.email)
          setIdentity(id)
          setPhase('home')
        }}
        onBack={() => setPhase('gate')}
      />
    )
  }

  if (!identity) return null
  return identity.project ? (
    <ProjectPage identity={identity} setIdentity={setIdentity} signOut={signOut} />
  ) : (
    <NoTeam identity={identity} setIdentity={setIdentity} signOut={signOut} />
  )
}

/* ── gate: enter your email ─────────────────────────────────────────────── */

function Gate({
  email,
  setEmail,
  error,
  onSubmit,
}: {
  email: string
  setEmail: (v: string) => void
  error: string
  onSubmit: () => void
}) {
  const [busy, setBusy] = useState(false)
  return (
    <section className="aitw-team">
      <p className="aitw-eyebrow">your team</p>
      <h1 className="aitw-section__title">Who are you?</h1>
      <p className="aitw-team__lead">
        Enter the email you signed up with. No password — your email is your key.
      </p>
      <form
        className="aitw-team__row"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!email.trim() || busy) return
          setBusy(true)
          await onSubmit()
          setBusy(false)
        }}
      >
        <input
          className="aitw-input"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
        />
        <button className="aitw-cta aitw-cta--sm" type="submit" disabled={busy}>
          {busy ? '…' : 'enter →'}
        </button>
      </form>
      {error && <p className="aitw-team__error">{error}</p>}
    </section>
  )
}

/* ── signup: not in the list ────────────────────────────────────────────── */

function Signup({
  email: initialEmail,
  onDone,
  onBack,
}: {
  email: string
  onDone: (id: Identity) => void
  onBack: () => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState(initialEmail)
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  return (
    <section className="aitw-team">
      <p className="aitw-eyebrow">sign up</p>
      <h1 className="aitw-section__title">We don&apos;t know that email</h1>
      <p className="aitw-team__lead">
        Used a different email on Luma?{' '}
        <button className="aitw-team__link" onClick={onBack}>
          try another →
        </button>{' '}
        Otherwise, sign up here.
      </p>
      <form
        className="aitw-team__stack"
        onSubmit={async (e) => {
          e.preventDefault()
          if (busy) return
          setError('')
          setBusy(true)
          try {
            const id = await api<Identity>('/api/aitw/builders', {
              method: 'POST',
              body: JSON.stringify({ name, email, phone }),
            })
            onDone(id)
          } catch (err) {
            setError(
              err instanceof ApiError && err.code === 'invalid_email'
                ? 'that email doesn’t look right'
                : 'something broke — try again'
            )
            setBusy(false)
          }
        }}
      >
        <label className="aitw-team__field">
          <span>name</span>
          <input className="aitw-input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <label className="aitw-team__field">
          <span>email</span>
          <input className="aitw-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="aitw-team__field">
          <span>phone</span>
          <input className="aitw-input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <div className="aitw-team__row">
          <button className="aitw-cta aitw-cta--sm" type="submit" disabled={busy || !name.trim() || !email.trim()}>
            {busy ? '…' : 'sign up →'}
          </button>
        </div>
        {error && <p className="aitw-team__error">{error}</p>}
      </form>
    </section>
  )
}

/* ── no team yet: create or join ────────────────────────────────────────── */

function NoTeam({
  identity,
  setIdentity,
  signOut,
}: {
  identity: Identity
  setIdentity: (id: Identity) => void
  signOut: () => void
}) {
  const [projectName, setProjectName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  return (
    <section className="aitw-team">
      <Header name={identity.builder.name} signOut={signOut} />
      <h1 className="aitw-section__title">You&apos;re not on a team yet</h1>

      <div className="aitw-team__panel">
        <p className="aitw-eyebrow">start a project</p>
        <form
          className="aitw-team__row"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!projectName.trim() || busy) return
            setError('')
            setBusy(true)
            try {
              setIdentity(
                await api<Identity>('/api/aitw/projects', {
                  method: 'POST',
                  body: JSON.stringify({ email: identity.builder.email, name: projectName }),
                })
              )
            } catch {
              setError('something broke — try again')
              setBusy(false)
            }
          }}
        >
          <input
            className="aitw-input"
            placeholder="project name (you can change it later)"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
          />
          <button className="aitw-cta aitw-cta--sm" type="submit" disabled={busy || !projectName.trim()}>
            create →
          </button>
        </form>
        {error && <p className="aitw-team__error">{error}</p>}
      </div>

      <div className="aitw-team__panel">
        <p className="aitw-eyebrow">or join one</p>
        <JoinSearch identity={identity} setIdentity={setIdentity} />
        <p className="aitw-team__hint">
          Can&apos;t find it? Ask a teammate to add you from their team page.
        </p>
      </div>
    </section>
  )
}

function JoinSearch({
  identity,
  setIdentity,
}: {
  identity: Identity
  setIdentity: (id: Identity) => void
}) {
  type Result = { id: string; name: string; members: string[] }
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [error, setError] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = (value: string) => {
    setQ(value)
    if (timer.current) clearTimeout(timer.current)
    if (value.trim().length < 2) {
      setResults([])
      return
    }
    timer.current = setTimeout(async () => {
      try {
        const { projects } = await api<{ projects: Result[] }>(
          `/api/aitw/projects?q=${encodeURIComponent(value.trim())}`
        )
        setResults(projects)
      } catch {
        /* stale searches can fail silently */
      }
    }, 250)
  }

  return (
    <div className="aitw-team__stack">
      <input
        className="aitw-input"
        placeholder="search project names…"
        value={q}
        onChange={(e) => search(e.target.value)}
      />
      {results.map((p) => (
        <div className="aitw-team__result" key={p.id}>
          <span>
            <b>{p.name}</b>
            <em>{p.members.length ? ` — ${p.members.join(', ')}` : ''}</em>
          </span>
          <button
            className="aitw-team__link"
            onClick={async () => {
              if (p.id === identity.project?.id) return
              if (identity.project && !confirm(`Leave “${identity.project.name}” and join “${p.name}”?`)) return
              try {
                setIdentity(
                  await api<Identity>('/api/aitw/projects/join', {
                    method: 'POST',
                    body: JSON.stringify({ email: identity.builder.email, projectId: p.id }),
                  })
                )
              } catch {
                setError('couldn’t join — try again')
              }
            }}
          >
            join →
          </button>
        </div>
      ))}
      {error && <p className="aitw-team__error">{error}</p>}
    </div>
  )
}

/* ── the project page ───────────────────────────────────────────────────── */

function ProjectPage({
  identity,
  setIdentity,
  signOut,
}: {
  identity: Identity
  setIdentity: (id: Identity) => void
  signOut: () => void
}) {
  const project = identity.project!
  const [fields, setFields] = useState({
    name: project.name,
    description: project.description ?? '',
    submissionUrl: project.submissionUrl ?? '',
  })
  const [dirty, setDirty] = useState<Set<keyof typeof fields>>(new Set())
  const [save, setSave] = useState<SaveState>('idle')
  const [saveError, setSaveError] = useState('')
  const projectId = useRef(project.id)

  // switching teams resets the form; saves sync server state without clobbering edits
  useEffect(() => {
    if (projectId.current !== project.id) {
      projectId.current = project.id
      setFields({
        name: project.name,
        description: project.description ?? '',
        submissionUrl: project.submissionUrl ?? '',
      })
      setDirty(new Set())
    }
  }, [project])

  const setField = (key: keyof typeof fields, value: string) => {
    setFields((f) => ({ ...f, [key]: value }))
    setDirty((d) => new Set(d).add(key))
  }

  const saveFields = async (keys: (keyof typeof fields)[]) => {
    const server = {
      name: project.name,
      description: project.description ?? '',
      submissionUrl: project.submissionUrl ?? '',
    }
    const payload: Record<string, string> = {}
    for (const key of keys) {
      if (fields[key] !== server[key]) payload[key] = fields[key]
    }
    if (Object.keys(payload).length === 0) {
      setDirty((d) => {
        const next = new Set(d)
        keys.forEach((k) => next.delete(k))
        return next
      })
      return
    }
    setSave('saving')
    setSaveError('')
    try {
      setIdentity(
        await api<Identity>('/api/aitw/projects', {
          method: 'PATCH',
          body: JSON.stringify({ email: identity.builder.email, ...payload }),
        })
      )
      setDirty((d) => {
        const next = new Set(d)
        keys.forEach((k) => next.delete(k))
        return next
      })
      setSave('saved')
      setTimeout(() => setSave((s) => (s === 'saved' ? 'idle' : s)), 2000)
    } catch (err) {
      setSave('error')
      setSaveError(
        err instanceof ApiError && err.code === 'invalid_url'
          ? 'the submission link must be a full URL (https://…)'
          : 'save failed — try again'
      )
    }
  }

  const pastDeadline = Date.now() > DEADLINE.getTime()

  return (
    <section className="aitw-team">
      <Header name={identity.builder.name} signOut={signOut} />

      <h1 className="aitw-section__title">{fields.name || 'Your project'}</h1>

      <div className="aitw-team__panel">
        <p className="aitw-eyebrow">project</p>
        <div className="aitw-team__stack">
          <label className="aitw-team__field">
            <span>project name</span>
            <input
              className="aitw-input"
              value={fields.name}
              onChange={(e) => setField('name', e.target.value)}
              onBlur={() => saveFields(['name'])}
            />
          </label>
          <label className="aitw-team__field">
            <span>what are you working on?</span>
            <textarea
              className="aitw-input aitw-input--area"
              rows={5}
              placeholder="The pitch, the plan, what it'll do in the wild…"
              value={fields.description}
              onChange={(e) => setField('description', e.target.value)}
              onBlur={() => saveFields(['description'])}
            />
          </label>
        </div>
      </div>

      <div className="aitw-team__panel">
        <p className="aitw-eyebrow">submission</p>
        <p className="aitw-team__hint">
          One link to a Google Doc, due by <b>end of Sunday 28 Jun</b>. The doc should contain your
          report plus links to GitHub, the demo video and anything live.
        </p>
        <label className="aitw-team__field">
          <span>google doc link</span>
          <input
            className="aitw-input"
            type="url"
            placeholder="https://docs.google.com/…"
            value={fields.submissionUrl}
            onChange={(e) => setField('submissionUrl', e.target.value)}
            onBlur={() => saveFields(['submissionUrl'])}
          />
        </label>
        {project.submittedAt && (
          <p className={`aitw-team__hint${project.late ? ' aitw-team__hint--late' : ''}`}>
            {project.late ? '⚠ submitted after the deadline — ' : 'submitted '}
            {new Date(project.submittedAt).toLocaleString('en-GB', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        )}
        {!project.submittedAt && pastDeadline && (
          <p className="aitw-team__hint aitw-team__hint--late">
            ⚠ the deadline has passed — you can still submit, but it&apos;ll be marked late
          </p>
        )}
      </div>

      <div className="aitw-team__row aitw-team__row--save">
        <button className="aitw-cta aitw-cta--sm" onClick={() => saveFields(['name', 'description', 'submissionUrl'])}>
          save
        </button>
        <span className="aitw-team__status">
          {save === 'saving' && 'saving…'}
          {save === 'saved' && '✓ saved'}
          {save === 'error' && saveError}
          {save === 'idle' && dirty.size > 0 && 'unsaved changes'}
        </span>
      </div>

      <div className="aitw-team__panel">
        <p className="aitw-eyebrow">team</p>
        <ul className="aitw-team__members">
          {project.members.map((m) => (
            <li key={m.id}>
              {m.name}
              {m.id === identity.builder.id && <em> — you</em>}
            </li>
          ))}
        </ul>
        <AddTeammate identity={identity} setIdentity={setIdentity} />
        <div className="aitw-team__row">
          <button
            className="aitw-team__link aitw-team__link--dim"
            onClick={async () => {
              if (!confirm(`Leave “${project.name}”?`)) return
              setIdentity(
                await api<Identity>('/api/aitw/projects/join', {
                  method: 'POST',
                  body: JSON.stringify({ email: identity.builder.email, projectId: null }),
                })
              )
            }}
          >
            leave team
          </button>
        </div>
      </div>

      <div className="aitw-team__panel">
        <p className="aitw-eyebrow">move</p>
        <p className="aitw-team__hint">Joining a different team? Search for it:</p>
        <JoinSearch identity={identity} setIdentity={setIdentity} />
      </div>
    </section>
  )
}

function AddTeammate({
  identity,
  setIdentity,
}: {
  identity: Identity
  setIdentity: (id: Identity) => void
}) {
  type Result = { id: string; name: string; hasTeam: boolean }
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [error, setError] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const memberIds = new Set(identity.project?.members.map((m) => m.id))

  const search = (value: string) => {
    setQ(value)
    setError('')
    if (timer.current) clearTimeout(timer.current)
    if (value.trim().length < 2) {
      setResults([])
      return
    }
    timer.current = setTimeout(async () => {
      try {
        const { builders } = await api<{ builders: Result[] }>(
          `/api/aitw/builders?q=${encodeURIComponent(value.trim())}`
        )
        setResults(builders)
      } catch {
        /* stale searches can fail silently */
      }
    }, 250)
  }

  return (
    <div className="aitw-team__stack">
      <input
        className="aitw-input"
        placeholder="add a teammate — search names…"
        value={q}
        onChange={(e) => search(e.target.value)}
      />
      {results
        .filter((b) => !memberIds.has(b.id))
        .map((b) => (
          <div className="aitw-team__result" key={b.id}>
            <span>
              <b>{b.name}</b>
              {b.hasTeam && <em> — already on a team</em>}
            </span>
            {!b.hasTeam && (
              <button
                className="aitw-team__link"
                onClick={async () => {
                  try {
                    setIdentity(
                      await api<Identity>('/api/aitw/projects/members', {
                        method: 'POST',
                        body: JSON.stringify({ email: identity.builder.email, builderId: b.id }),
                      })
                    )
                    setQ('')
                    setResults([])
                  } catch (err) {
                    setError(
                      err instanceof ApiError && err.code === 'already_on_a_team'
                        ? `${b.name} just joined another team — they can move themselves from their page`
                        : 'couldn’t add — try again'
                    )
                  }
                }}
              >
                add →
              </button>
            )}
          </div>
        ))}
      {error && <p className="aitw-team__error">{error}</p>}
      <p className="aitw-team__hint">
        Only builders without a team can be added — people on a team move themselves.
      </p>
    </div>
  )
}

function Header({ name, signOut }: { name: string; signOut: () => void }) {
  return (
    <div className="aitw-team__header">
      <p className="aitw-eyebrow">your team</p>
      <span className="aitw-team__whoami">
        {name} ·{' '}
        <button className="aitw-team__link aitw-team__link--dim" onClick={signOut}>
          not you?
        </button>
      </span>
    </div>
  )
}
