'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { CommunitySource, LondonEvent } from '@/lib/types'

type StoreResult =
  | { kind: 'source'; source: CommunitySource }
  | { kind: 'event'; event: LondonEvent }

type Stage = 'idle' | 'loading' | 'success' | 'error'

function describeResult(result: StoreResult): string {
  if (result.kind === 'source') {
    const { type, name } = result.source
    return `Luma ${type} — ${name}`
  }
  const { event } = result
  if (event.source === 'other') {
    const domain = (() => { try { return new URL(event.url).hostname } catch { return event.url } })()
    return `External link — ${event.name || domain} · will be reviewed`
  }
  const dateStr = event.startAt ? ` · ${format(new Date(event.startAt), 'd MMM yyyy')}` : ''
  return `Luma event — ${event.name}${dateStr}`
}

export function SubmitForm() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [stage, setStage] = useState<Stage>('idle')
  const [message, setMessage] = useState('')
  const [resultDesc, setResultDesc] = useState('')
  const submitLock = useRef(false)

  async function handleSubmit() {
    const trimmed = url.trim()
    if (!trimmed || submitLock.current) return
    submitLock.current = true
    setStage('loading')
    setMessage('')

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      })
      const json = await res.json()
      if (!res.ok) {
        setStage('error')
        setMessage(json.error ?? 'Could not resolve URL')
        return
      }
      setResultDesc(describeResult(json.result))
      setStage('success')
      router.refresh()
    } catch {
      setStage('error')
      setMessage('Network error — please try again')
    } finally {
      submitLock.current = false
    }
  }

  function reset() {
    setUrl('')
    setStage('idle')
    setMessage('')
    setResultDesc('')
  }

  if (stage === 'success') {
    return (
      <div className="terminal-stack">
        <p className="app-section__meta">Suggest a calendar, profile, or event</p>
        <p className="terminal-eyebrow">Added. thanks.</p>
        {resultDesc && <p className="terminal-copy--muted">{resultDesc}</p>}
        <button onClick={reset} className="terminal-ghost">submit another</button>
      </div>
    )
  }

  const canSubmit = url.trim().length > 0 && stage !== 'loading'

  return (
    <div className="terminal-stack">
      <p className="app-section__meta">Suggest a calendar, profile, or event</p>
      <form onSubmit={(e) => { e.preventDefault(); handleSubmit() }} className="relative flex items-center">
        <input
          type="url"
          placeholder="Paste a lu.ma or event URL and press Enter"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value)
            if (stage === 'error') { setStage('idle'); setMessage('') }
          }}
          disabled={stage === 'loading'}
          className="input-shell w-full px-3 py-2 pr-10 text-xs outline-none"
        />
        <button
          type="submit"
          disabled={!canSubmit}
          className="absolute right-0 h-full px-3 text-xs uppercase tracking-widest"
          style={{ color: canSubmit ? 'var(--accent-bright)' : 'var(--muted)' }}
          aria-label="Submit"
        >
          {stage === 'loading' ? '...' : 'go'}
        </button>
      </form>
      {stage === 'loading' && <p className="terminal-hint">Checking link...</p>}
      {stage === 'error' && <p className="text-[10px]" style={{ color: 'var(--danger)' }}>{message}</p>}
    </div>
  )
}
