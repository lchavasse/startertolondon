import { CrmShell } from '@/components/crm/CrmShell'
import { EntityList } from '@/components/crm/EntityList'
import { fetchCrmPeople } from '@/lib/crm/server'

export const dynamic = 'force-dynamic'

export default async function CrmPeoplePage() {
  const people = await fetchCrmPeople()

  return (
    <CrmShell
      title="People"
      subtitle="Contacts, leads, speakers, founders, patrons, meddlers, and the rest."
    >
      <EntityList
        title="People"
        empty="No people imported yet. A quiet CRM is usually a bad sign."
        items={people.map((person) => ({
          id: person.id,
          title: person.full_name,
          subtitle: [person.title, person.location].filter(Boolean).join(' · ') || person.relationship_summary,
          meta: person.next_followup_at ? `follow up ${new Date(person.next_followup_at).toLocaleDateString('en-GB')}` : 'no follow-up set',
          href: `/crm/people/${person.id}`,
        }))}
      />
    </CrmShell>
  )
}
