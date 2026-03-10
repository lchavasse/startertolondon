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
      <div className="border border-[#1e1e1e] p-4 space-y-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-[#555]">
          Suggest a calendar, profile, or event
        </p>
        <div className="space-y-2">
          <p className="font-mono text-xs text-[#c8ff00]">Added — thanks!</p>
          {resultDesc && <p className="font-mono text-[10px] text-[#888]">{resultDesc}</p>}
          <button
            onClick={reset}
            className="font-mono text-[10px] text-[#555] hover:text-[#888] uppercase tracking-widest"
          >
            Submit another
          </button>
        </div>
      </div>
    )
  }

  const canSubmit = url.trim().length > 0 && stage !== 'loading'

  return (
    <div className="border border-[#1e1e1e] p-4 space-y-3">
      <p className="font-mono text-[10px] uppercase tracking-widest text-[#555]">
        Suggest a calendar, profile, or event
      </p>

      <form
        onSubmit={(e) => { e.preventDefault(); handleSubmit() }}
        className="relative flex items-center"
      >
        <input
          type="url"
          placeholder="Paste a lu.ma or event URL and press Enter ↵"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value)
            if (stage === 'error') { setStage('idle'); setMessage('') }
          }}
          disabled={stage === 'loading'}
          className="w-full bg-[#111] border border-[#2a2a2a] text-[#f0ede6] font-mono text-xs pl-3 pr-10 py-2 outline-none focus:border-[#c8ff00] placeholder:text-[#333] disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!canSubmit}
          className="absolute right-0 h-full px-3 flex items-center justify-center text-[#555] hover:text-[#c8ff00] disabled:text-[#2a2a2a] disabled:hover:text-[#2a2a2a] transition-colors"
          aria-label="Submit"
        >
          {stage === 'loading' ? (
            <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="8" strokeLinecap="round" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8h10M9 4l4 4-4 4" />
            </svg>
          )}
        </button>
      </form>

      {stage === 'loading' && (
        <p className="font-mono text-[10px] text-[#444] animate-pulse">
          Checking link…
        </p>
      )}

      {stage === 'error' && (
        <p className="font-mono text-[10px] text-red-400">{message}</p>
      )}
    </div>
  )
}
