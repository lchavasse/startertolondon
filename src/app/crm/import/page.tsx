import { CrmShell } from '@/components/crm/CrmShell'

const commands = [
  'npm run crm:import-sheet',
  'npm run crm:import-notion',
  'npx tsx --env-file=.env.local scripts/test-crm-enrichment-db.ts',
]

export default function CrmImportPage() {
  return (
    <CrmShell
      title="Import"
      subtitle="Initial ingestion stays script-first. Less glamorous than a sync engine, vastly less stupid."
    >
      <section className="terminal-panel p-4 space-y-4">
        <div>
          <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-[var(--accent-bright)]">Current import surfaces</h2>
          <p className="mt-2 text-sm text-[var(--muted-strong)]">
            Google Sheet import creates organisations, people, opportunities, tasks, and provenance links from the working tabs.
            Notion import creates tasks plus note-style interactions from selected child pages.
            The new enrichment workspace sits at /crm/enrichment so imported rows can be researched systematically instead of quietly breeding duplication.
          </p>
        </div>
        <div className="space-y-2">
          {commands.map((command) => (
            <pre key={command} className="overflow-x-auto border border-[var(--line)] bg-[rgba(9,13,14,0.5)] p-3 text-xs text-[#f0ede6]">{command}</pre>
          ))}
        </div>
      </section>
    </CrmShell>
  )
}
