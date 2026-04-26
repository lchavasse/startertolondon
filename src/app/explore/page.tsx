import { fetchAllKBEntities, deriveSectors, fetchHighlights } from '@/lib/kb'
import { HighlightsExplorer } from '@/components/HighlightsExplorer'
import { AppNav } from '@/components/AppNav'

export const dynamic = 'force-dynamic'

export default async function ExplorePage() {
  const [entities, highlights] = await Promise.all([
    fetchAllKBEntities(),
    fetchHighlights(),
  ])
  const availableSectors = deriveSectors(entities)

  const total = entities.spaces.length + entities.communities.length + entities.vcs.length + entities.programmes.length

  return (
    <main className="min-h-screen bg-[#0a0a0a] px-4 py-10 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-10 flex items-start justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#c8ff00] mb-2">
              London Calling / KB
            </p>
            <p className="text-[#f0ede6] text-3xl font-bold">Knowledge Base</p>
            <p className="text-[#666] text-xs font-mono mt-2">{total} entries</p>
          </div>
          <AppNav />
        </div>

        <HighlightsExplorer
          highlights={highlights}
          spaces={entities.spaces}
          communities={entities.communities}
          vcs={entities.vcs}
          programmes={entities.programmes}
          availableSectors={availableSectors}
        />
      </div>
    </main>
  )
}
