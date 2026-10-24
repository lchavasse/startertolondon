'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/events', label: 'Events', match: '/events' },
  { href: '/explore', label: 'Explore', match: '/explore' },
  { href: '/crm', label: 'CRM', match: '/crm' },
] as const

export function AppNav() {
  const pathname = usePathname()

  return (
    <nav className="flex items-center gap-4">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="text-[11px] uppercase tracking-widest transition-colors duration-150"
          style={{ color: pathname.startsWith(item.match) ? 'var(--accent-yellow)' : 'var(--muted)' }}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
