import { CrmShell } from '@/components/crm/CrmShell'
import { ExpoApplications } from '@/components/crm/ExpoApplications'
import { getCrmServiceClient, fetchCrmContacts, fetchCrmContactEvents } from '@/lib/crm/server'
import type { ExpoApplication } from '@/components/crm/ExpoApplications'

export const dynamic = 'force-dynamic'

const LOGO_BUCKET = 'expo-logos'
const EXPO_SOURCE = 'expo_application'

export default async function CrmExpoPage() {
  const supabase = getCrmServiceClient()

  const { data, error } = await supabase
    .from('deeptech_expo')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <CrmShell title="Expo applications" subtitle="Applications from the public expo form.">
        <section className="terminal-panel p-4">
          <p className="text-sm text-[var(--muted-strong)]">
            Could not read <code>deeptech_expo</code>: {error.message}
          </p>
        </section>
      </CrmShell>
    )
  }

  const applications = (data ?? []) as ExpoApplication[]

  // Logos live in a private bucket on purpose — an uploaded SVG served from a public URL is a
  // script the browser will run. Sign them per request instead of making the bucket public.
  const withLogos = await Promise.all(
    applications.map(async (row) => {
      if (!row.logo_path) return row
      const { data: signed } = await supabase.storage.from(LOGO_BUCKET).createSignedUrl(row.logo_path, 3600)
      return { ...row, logo_url: signed?.signedUrl ?? null }
    }),
  )

  const contacts = await fetchCrmContacts({ source_system: EXPO_SOURCE })
  const events = await fetchCrmContactEvents(contacts.map((c) => c.id))

  return (
    <CrmShell
      title="Expo applications"
      subtitle="Everyone who applied through the public expo form. Set a status, add labels, and keep a running note of the conversation. Your verdict is stored separately from the application itself, so nothing here overwrites what they submitted."
    >
      <ExpoApplications
        applications={withLogos}
        contacts={contacts.map((c) => ({ ...c, events: events.filter((e) => e.contact_id === c.id) }))}
      />
    </CrmShell>
  )
}
