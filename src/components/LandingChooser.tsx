'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Option = { href: string; label: string; sub: string }

const OPTIONS: Option[] = [
  { href: '/explore', label: 'explore', sub: 'spaces · communities · people' },
  { href: '/events',  label: 'events',  sub: 'tonight · tomorrow · this week' },
]

const TITLE_WORDS = ['LONDON', 'CALLING']
const FULL_TITLE = TITLE_WORDS.join(' ')
const TITLE_CHAR_SPEED = 50
const TITLE_START_DELAY = 600

export function LandingChooser() {
  const router = useRouter()
  const [active, setActive] = useState(0)
  const [typed, setTyped] = useState(0)

  useEffect(() => {
    const startTimer = window.setTimeout(() => {
      const interval = window.setInterval(() => {
        setTyped((c) => {
          if (c >= FULL_TITLE.length) {
            window.clearInterval(interval)
            return c
          }
          return c + 1
        })
      }, TITLE_CHAR_SPEED)
      return () => window.clearInterval(interval)
    }, TITLE_START_DELAY)
    return () => window.clearTimeout(startTimer)
  }, [])

  useEffect(() => {
    OPTIONS.forEach((o) => router.prefetch(o.href))
  }, [router])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setActive((i) => (i - 1 + OPTIONS.length) % OPTIONS.length)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        setActive((i) => (i + 1) % OPTIONS.length)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        router.push(OPTIONS[active].href)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [active, router])

  const displayed = FULL_TITLE.slice(0, typed)
  const done = typed >= FULL_TITLE.length

  // Split typed text into lines on word boundaries
  const lines: string[] = []
  let remaining = displayed
  for (const word of TITLE_WORDS) {
    if (remaining.length === 0) break
    if (remaining.length <= word.length) {
      lines.push(remaining)
      remaining = ''
    } else {
      lines.push(word)
      remaining = remaining.slice(word.length + 1) // +1 for the space
    }
  }

  return (
    <section className="landing">
      <p className="landing__eyebrow">[ calling / london ]</p>

      <h1 className="landing__title" aria-label={FULL_TITLE}>
        {lines.map((line, i) => (
          <span key={i} className="landing__title-line">
            {line}
            {i === lines.length - 1 && !done && (
              <span className="landing__cursor" aria-hidden="true" />
            )}
          </span>
        ))}
      </h1>

      <p className="landing__tagline">a starter pack for london</p>

      {done && (
        <>
          <div className="landing__options" role="menu">
            {OPTIONS.map((opt, i) => {
              const isActive = i === active
              return (
                <button
                  key={opt.href}
                  type="button"
                  role="menuitem"
                  onClick={() => router.push(opt.href)}
                  onMouseEnter={() => setActive(i)}
                  className={`landing__option${isActive ? ' landing__option--active' : ''}`}
                >
                  <span className="landing__option-label">[ {opt.label} ]</span>
                  <span className="landing__option-sub">{opt.sub}</span>
                </button>
              )
            })}
          </div>

          <p className="landing__hint">
            <span className="landing__hint-key">←</span>
            <span className="landing__hint-key">→</span>
            <span> choose</span>
            <span className="landing__hint-sep"> · </span>
            <span className="landing__hint-key">enter</span>
            <span> open</span>
          </p>
        </>
      )}
    </section>
  )
}
