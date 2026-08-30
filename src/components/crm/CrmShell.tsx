import { ReactNode } from 'react'
import { AppNav } from '@/components/AppNav'
import { CrmTabs } from './CrmTabs'
import { CrmLogoutButton } from './CrmLogoutButton'

export function CrmShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <main className="app-shell px-4 py-10 sm:px-6 lg:px-8">
      <div className="app-shell__inner max-w-7xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--accent-yellow)]">DeepTech London</p>
            <h1 className="text-[#f0ede6] text-3xl font-bold">{title}</h1>
            {subtitle ? <p className="max-w-3xl text-sm text-[var(--muted-strong)]">{subtitle}</p> : null}
            <p className="font-mono text-[11px] uppercase tracking-widest text-[var(--muted)]">Owners: Lachlan and Barrett</p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <AppNav />
            <CrmLogoutButton />
          </div>
        </div>
        <CrmTabs />
        {children}
      </div>
    </main>
  )
}
