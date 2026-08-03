import { format } from 'date-fns'
import { CrmInboundSummary } from '@/lib/crm/types'

function formatMaybe(value: string | null) {
  if (!value) return '—'
  return format(new Date(value), 'd MMM yyyy, HH:mm')
}

export function InboundSummary({ inbound }: { inbound: CrmInboundSummary }) {
  return (
    <section className="terminal-panel p-4 space-y-3">
      <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-[var(--accent-bright)]">Inbound context</h2>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="border border-[var(--line)] bg-[rgba(9,13,14,0.5)] p-3 space-y-1">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">Expo / application rows</p>
          <p className="text-2xl font-bold text-[#f0ede6]">{inbound.applicationCount}</p>
          <p className="text-xs text-[var(--muted-strong)]">Latest: {formatMaybe(inbound.latestApplicationAt)}</p>
        </div>
        <div className="border border-[var(--line)] bg-[rgba(9,13,14,0.5)] p-3 space-y-1">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">Ticket waitlist rows</p>
          <p className="text-2xl font-bold text-[#f0ede6]">{inbound.waitlistCount}</p>
          <p className="text-xs text-[var(--muted-strong)]">Latest: {formatMaybe(inbound.latestWaitlistAt)}</p>
        </div>
      </div>
    </section>
  )
}
