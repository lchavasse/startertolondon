import { CrmShell } from '@/components/crm/CrmShell'
import { VolunteerApplications } from '@/components/crm/VolunteerApplications'
import { getCrmServiceClient, fetchCrmContacts, fetchCrmContactEvents } from '@/lib/crm/server'
import type { Volunteer } from '@/components/crm/VolunteerApplications'

export const dynamic = 'force-dynamic'

const VOLUNTEER_SOURCE = 'volunteer_application'

export default async function CrmVolunteersPage() {
  const supabase = getCrmServiceClient()

  const { data, error } = await supabase
    .from('deeptech_volunteers')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <CrmShell title="Volunteers" subtitle="Signups from the public volunteer form.">
        <section className="terminal-panel p-4">
          <p className="text-sm text-[var(--muted-strong)]">
            Could not read <code>deeptech_volunteers</code>: {error.message}
          </p>
        </section>
      </CrmShell>
    )
  }

  const volunteers = (data ?? []) as Volunteer[]
  const contacts = await fetchCrmContacts({ source_system: VOLUNTEER_SOURCE })
  const events = await fetchCrmContactEvents(contacts.map((c) => c.id))

  return (
    <CrmShell
      title="Volunteers"
      subtitle="Everyone who offered to help on the day. Filter by shift to see who covers what, set a status, and keep the conversation in the timeline — nothing here overwrites what they submitted."
    >
      <VolunteerApplications
        volunteers={volunteers}
        contacts={contacts.map((c) => ({ ...c, events: events.filter((e) => e.contact_id === c.id) }))}
      />
    </CrmShell>
  )
}
