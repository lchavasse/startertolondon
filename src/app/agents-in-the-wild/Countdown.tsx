'use client'

import { useSyncExternalStore } from 'react'
import Link from 'next/link'

// Submission deadline — end of Sunday 28 June, London (BST).
// Mirrors SUBMISSION_DEADLINE in src/lib/aitw.ts (kept local to keep the
// Supabase client out of the browser bundle).
const DEADLINE = new Date('2026-06-28T23:59:59+01:00').getTime()

const pad = (n: number) => String(n).padStart(2, '0')

function subscribe(onTick: () => void) {
  const id = setInterval(onTick, 1000)
  return () => clearInterval(id)
}

// whole seconds so the snapshot only changes once per tick
const getNow = () => Math.floor(Date.now() / 1000) * 1000

export default function Countdown() {
  // server snapshot is null → placeholder digits until hydration completes
  const now = useSyncExternalStore(subscribe, getNow, () => null)

  const diff = now === null ? null : DEADLINE - now

  if (diff !== null && diff <= 0) {
    return (
      <Link className="aitw-countdown" href="/agents-in-the-wild/team">
        <span className="aitw-countdown__label">deadline passed</span>
        <span className="aitw-countdown__digits">submit late →</span>
      </Link>
    )
  }

  const units =
    diff === null
      ? [
          ['--', 'd'],
          ['--', 'h'],
          ['--', 'm'],
          ['--', 's'],
        ]
      : [
          [pad(Math.floor(diff / 86_400_000)), 'd'],
          [pad(Math.floor(diff / 3_600_000) % 24), 'h'],
          [pad(Math.floor(diff / 60_000) % 60), 'm'],
          [pad(Math.floor(diff / 1_000) % 60), 's'],
        ]

  return (
    <Link className="aitw-countdown" href="/agents-in-the-wild/team">
      <span className="aitw-countdown__label">submit by · sun 28.06 · 23:59</span>
      <span className="aitw-countdown__digits">
        {units.map(([value, unit], i) => (
          <span className="aitw-countdown__seg" key={unit}>
            {i > 0 && <span className="aitw-countdown__sep">:</span>}
            {value}
            <span className="aitw-countdown__unit">{unit}</span>
          </span>
        ))}
      </span>
    </Link>
  )
}
