import { CrmShell } from '@/components/crm/CrmShell'
import { ContactsTable } from '@/components/crm/ContactsTable'
import { fetchCrmContacts, fetchCrmContactEvents } from '@/lib/crm/server'

export const dynamic = 'force-dynamic'

export default async function CrmContactsPage() {
  const contacts = await fetchCrmContacts()
  const events = await fetchCrmContactEvents(contacts.map((c) => c.id))

  return (
    <CrmShell
      title="Contacts"
      subtitle="Active leads, whatever they came from — the expo form, the LinkedIn pool, the scanner, or a line you typed. Set a status, label them, keep a running timeline, and pick a date to have them put back in front of you."
    >
      <ContactsTable contacts={contacts.map((c) => ({ ...c, events: events.filter((e) => e.contact_id === c.id) }))} />
    </CrmShell>
  )
}
