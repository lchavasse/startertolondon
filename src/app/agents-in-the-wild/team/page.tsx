import type { Metadata } from 'next'
import Link from 'next/link'
import TeamClient from './TeamClient'

export const metadata: Metadata = {
  title: 'Your Team — Agents in the Wild',
  description: 'Find yourself, form a team, describe your project and submit.',
}

export default function TeamPage() {
  return (
    <main className="aitw-shell">
      <div className="docs-inner">
        <div className="docs-topbar">
          <span className="docs-brand">
            <Link href="/">london calling</Link>
            {' / '}
            <Link href="/agents-in-the-wild">agents in the wild</Link>
            {' / team'}
          </span>
        </div>
        <TeamClient />
      </div>
    </main>
  )
}
