'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/crm', label: 'Today' },
  { href: '/crm/opportunities', label: 'Opportunities' },
  { href: '/crm/contacts', label: 'Contacts' },
  { href: '/crm/expo', label: 'Expo' },
  { href: '/crm/tasks', label: 'Tasks' },
  { href: '/crm/people', label: 'People' },
  { href: '/crm/people-pool', label: 'Sourcing' },
  { href: '/crm/organisations', label: 'Organisations' },
  { href: '/crm/enrichment', label: 'Enrichment' },
  { href: '/crm/import', label: 'Import' },
] as const

export function CrmTabs() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-wrap gap-2 border-b border-[var(--line)] pb-3">
      {tabs.map((tab) => {
        const active = pathname === tab.href || (tab.href !== '/crm' && pathname.startsWith(tab.href))
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest border transition-colors"
            style={{
              color: active ? 'var(--accent-yellow)' : 'var(--muted)',
              borderColor: active ? 'rgba(200,255,0,0.35)' : 'var(--line)',
              background: active ? 'rgba(14, 21, 16, 0.84)' : 'rgba(9,13,14,0.45)',
            }}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
