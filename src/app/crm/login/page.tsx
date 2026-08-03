'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function CrmLoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/crm'
  const [key, setKey] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/crm/auth', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key, next }),
      })
      if (!res.ok) {
        setError('Invalid admin key')
        return
      }
      router.push(next)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen app-shell flex items-center justify-center px-4">
      <div className="terminal-panel w-full max-w-sm space-y-4 p-5">
        <div className="space-y-2">
          <h1 className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--accent-bright)]">CRM access</h1>
          <p className="text-sm text-[var(--muted-strong)]">Enter the admin key to get into the CRM. Wildly old-fashioned, but it will do.</p>
        </div>
        <input
          type="password"
          placeholder="Enter admin key"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && key) submit()
          }}
          className="w-full bg-[rgba(7,9,9,0.64)] border border-[var(--line)] text-[#f0ede6] font-mono text-sm px-3 py-2 outline-none focus:border-[var(--line-strong)]"
        />
        <button
          onClick={submit}
          disabled={!key || loading}
          className="w-full bg-[rgba(14,21,16,0.84)] text-[var(--accent-bright)] font-mono text-xs uppercase tracking-widest py-2 disabled:opacity-50"
        >
          {loading ? 'Checking…' : 'Enter CRM'}
        </button>
        {error ? <p className="font-mono text-xs text-red-400">{error}</p> : null}
      </div>
    </main>
  )
}

export default function CrmLoginPage() {
  return (
    <Suspense
      fallback={<main className="min-h-screen app-shell flex items-center justify-center px-4"><div className="terminal-panel w-full max-w-sm p-5 font-mono text-xs uppercase tracking-[0.3em] text-[var(--accent-bright)]">Loading CRM…</div></main>}
    >
      <CrmLoginForm />
    </Suspense>
  )
}
