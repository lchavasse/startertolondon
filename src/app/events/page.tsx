import Link from 'next/link'
import { getEvents } from '@/lib/kv'
import { EventGrid } from '@/components/EventGrid'
import { SubmitForm } from '@/components/SubmitForm'
import { AppNav } from '@/components/AppNav'

export const dynamic = 'force-dynamic'

export default async function EventsPage() {
  const events = await getEvents()
  const tags = [...new Set(events.flatMap((e) => e.tags))].sort()

  return (
    <main className="app-shell">
      <div className="app-shell__inner app-shell__inner--narrow">
        <header className="app-header">
          <div>
            <p className="terminal-eyebrow">starter-london / live feed</p>
            <h1 className="app-section__title">Tech Events</h1>
            {events.length > 0 && <p className="app-section__meta">{events.length} upcoming events</p>}
          </div>
          <div className="flex items-center gap-4">
            <AppNav />
            <Link href="/guide" className="terminal-ghost">
              personalised guide
            </Link>
          </div>
        </header>

        <div className="app-frame">
          <section className="terminal-panel app-hero">
            <p className="terminal-copy--muted">
              The live feed should stay dense and useful. Same shell language, closer to the original utilitarian layout.
            </p>
            <SubmitForm />
          </section>

          <section className="terminal-panel app-panel">
            {events.length === 0 ? (
              <div className="py-32 text-center">
                <p className="terminal-hint">No events loaded yet. Run the scraper.</p>
              </div>
            ) : (
              <EventGrid events={events} tags={tags} />
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
