'use client'

import { useSyncExternalStore } from 'react'

// Kickoff Day @ Blue Garage — Sat 13 June, 10:00 London (BST)
const KICKOFF = new Date('2026-06-13T10:00:00+01:00').getTime()

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

  const diff = now === null ? null : KICKOFF - now

  if (diff !== null && diff <= 0) {
    return (
      <div className="aitw-countdown">
        <span className="aitw-countdown__label">kickoff</span>
        <span className="aitw-countdown__digits">live now @ blue garage</span>
      </div>
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
    <div className="aitw-countdown">
      <span className="aitw-countdown__label">kickoff · sat 13.06 · 10:00</span>
      <span className="aitw-countdown__digits">
        {units.map(([value, unit], i) => (
          <span className="aitw-countdown__seg" key={unit}>
            {i > 0 && <span className="aitw-countdown__sep">:</span>}
            {value}
            <span className="aitw-countdown__unit">{unit}</span>
          </span>
        ))}
      </span>
    </div>
  )
}
