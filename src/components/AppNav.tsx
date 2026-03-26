'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function AppNav() {
  const pathname = usePathname()

  return (
    <nav className="flex items-center gap-4">
      <Link
        href="/events"
        className="text-[11px] uppercase tracking-widest transition-colors duration-150"
        style={{ color: pathname.startsWith('/events') ? 'var(--accent-bright)' : 'var(--muted)' }}
      >
        Events
      </Link>
      <Link
        href="/explore"
        className="text-[11px] uppercase tracking-widest transition-colors duration-150"
        style={{ color: pathname.startsWith('/explore') ? 'var(--accent-bright)' : 'var(--muted)' }}
      >
        Explore
      </Link>
    </nav>
  )
}
