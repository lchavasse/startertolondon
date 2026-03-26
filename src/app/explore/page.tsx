import { fetchAllKBEntities, deriveSectors } from '@/lib/kb'
import { ExploreGrid } from '@/components/ExploreGrid'
import { AppNav } from '@/components/AppNav'

export const dynamic = 'force-dynamic'

export default async function ExplorePage() {
  const entities = await fetchAllKBEntities()
  const availableSectors = deriveSectors(entities)

  const total = entities.spaces.length + entities.communities.length + entities.vcs.length + entities.programmes.length

  return (
    <main className="app-shell">
      <div className="app-shell__inner app-shell__inner--narrow">
        <header className="app-header">
          <div>
            <p className="terminal-eyebrow">starter-london / explore</p>
            <h1 className="app-section__title">Knowledge Base</h1>
            <p className="app-section__meta">{total} entries</p>
          </div>
          <AppNav />
        </header>

        <div className="app-frame">
          <section className="terminal-panel app-panel">
            <ExploreGrid
              spaces={entities.spaces}
              communities={entities.communities}
              vcs={entities.vcs}
              programmes={entities.programmes}
              availableSectors={availableSectors}
            />
          </section>
        </div>
      </div>
    </main>
  )
}
