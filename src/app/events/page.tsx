import { getEvents } from '@/lib/kv'
import { EventGrid } from '@/components/EventGrid'
import { SubmitForm } from '@/components/SubmitForm'

export const dynamic = 'force-dynamic'

export default async function EventsPage() {
  const events = await getEvents()
  const tags = [...new Set(events.flatMap((e) => e.tags))].sort()

  return (
    <main className="min-h-screen bg-[#0a0a0a] px-4 py-10 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-10 space-y-6">
          <div>
            <h1 className="font-mono text-xs uppercase tracking-[0.3em] text-[#c8ff00] mb-2">
              London
            </h1>
            <p className="text-[#f0ede6] text-3xl font-bold">Tech Events</p>
            {events.length > 0 && (
              <p className="text-[#333] text-xs font-mono mt-2">
                {events.length} upcoming events
              </p>
            )}
          </div>
          <SubmitForm />
        </div>

        {events.length === 0 ? (
          <div className="py-32 text-center">
            <p className="font-mono text-xs uppercase tracking-widest text-[#333]">
              No events loaded yet — run the scraper
            </p>
          </div>
        ) : (
          <EventGrid events={events} tags={tags} />
        )}
      </div>
    </main>
  )
}
