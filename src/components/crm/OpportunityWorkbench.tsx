'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { CRM_CONTACT_CHANNELS, CRM_OUTREACH_STATUSES } from '@/lib/crm/constants'
import { CrmOpportunityDetail } from '@/lib/crm/types'

function formatMaybe(value: string | null) {
  if (!value) return '—'
  return format(new Date(value), 'd MMM yyyy, HH:mm')
}

function sectionTitle(title: string, subtitle?: string) {
  return (
    <div className="space-y-1">
      <h3 className="font-mono text-xs uppercase tracking-[0.25em] text-[var(--accent-bright)]">{title}</h3>
      {subtitle ? <p className="text-xs text-[var(--muted-strong)]">{subtitle}</p> : null}
    </div>
  )
}

export function OpportunityWorkbench({ detail }: { detail: CrmOpportunityDetail }) {
  const router = useRouter()
  const [contactEntityKey, setContactEntityKey] = useState(() => {
    if (detail.opportunity.people[0]) return `person:${detail.opportunity.people[0].id}`
    if (detail.opportunity.organisations[0]) return `organisation:${detail.opportunity.organisations[0].id}`
    return ''
  })
  const [contactLabel, setContactLabel] = useState('')
  const [contactChannel, setContactChannel] = useState<(typeof CRM_CONTACT_CHANNELS)[number]>('email')
  const [contactValue, setContactValue] = useState('')
  const [contactNotes, setContactNotes] = useState('')
  const [contactPrimary, setContactPrimary] = useState(true)
  const [contactPending, setContactPending] = useState(false)
  const [contactError, setContactError] = useState<string | null>(null)

  const [outreachChannel, setOutreachChannel] = useState<(typeof CRM_CONTACT_CHANNELS)[number]>('email')
  const [outreachStatus, setOutreachStatus] = useState<(typeof CRM_OUTREACH_STATUSES)[number]>('sent')
  const [outreachDirection, setOutreachDirection] = useState<'outbound' | 'inbound' | 'internal'>('outbound')
  const [outreachContactPointId, setOutreachContactPointId] = useState('')
  const [outreachPersonId, setOutreachPersonId] = useState(detail.opportunity.people[0]?.id ?? '')
  const [outreachOrganisationId, setOutreachOrganisationId] = useState(detail.opportunity.organisations[0]?.id ?? '')
  const [outreachSubject, setOutreachSubject] = useState('')
  const [outreachExcerpt, setOutreachExcerpt] = useState('')
  const [outreachNextStep, setOutreachNextStep] = useState('')
  const [outreachNextDueAt, setOutreachNextDueAt] = useState('')
  const [outreachNotes, setOutreachNotes] = useState('')
  const [outreachPending, setOutreachPending] = useState(false)
  const [outreachError, setOutreachError] = useState<string | null>(null)

  const contactTargets = useMemo(
    () => [
      ...detail.opportunity.people.map((person) => ({ key: `person:${person.id}`, label: `${person.full_name} · person` })),
      ...detail.opportunity.organisations.map((organisation) => ({ key: `organisation:${organisation.id}`, label: `${organisation.name} · organisation` })),
    ],
    [detail.opportunity.organisations, detail.opportunity.people],
  )

  const contactPoints = useMemo(() => detail.contactPoints, [detail.contactPoints])

  async function submitContactPoint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!contactEntityKey || !contactValue.trim()) return
    const [entity_type, entity_id] = contactEntityKey.split(':')
    setContactPending(true)
    setContactError(null)
    try {
      const res = await fetch('/api/crm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'add-contact-point',
          fields: {
            entity_type,
            entity_id,
            label: contactLabel || null,
            channel: contactChannel,
            value: contactValue.trim(),
            notes: contactNotes || null,
            is_primary: contactPrimary,
          },
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(typeof body.error === 'string' ? body.error : 'Failed to add contact point')
      }
      setContactLabel('')
      setContactValue('')
      setContactNotes('')
      setContactPrimary(true)
      router.refresh()
    } catch (error) {
      setContactError(error instanceof Error ? error.message : 'Failed to add contact point')
    } finally {
      setContactPending(false)
    }
  }

  async function submitOutreach(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setOutreachPending(true)
    setOutreachError(null)
    try {
      const res = await fetch('/api/crm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'add-outreach-entry',
          fields: {
            opportunity_id: detail.opportunity.id,
            contact_point_id: outreachContactPointId || null,
            person_id: outreachPersonId || null,
            organisation_id: outreachOrganisationId || null,
            channel: outreachChannel,
            direction: outreachDirection,
            status: outreachStatus,
            subject: outreachSubject || null,
            body_excerpt: outreachExcerpt || null,
            happened_at: new Date().toISOString(),
            next_step: outreachNextStep || null,
            next_due_at: outreachNextDueAt ? new Date(outreachNextDueAt).toISOString() : null,
            notes: outreachNotes || null,
          },
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(typeof body.error === 'string' ? body.error : 'Failed to log outreach')
      }
      setOutreachSubject('')
      setOutreachExcerpt('')
      setOutreachNextStep('')
      setOutreachNextDueAt('')
      setOutreachNotes('')
      router.refresh()
    } catch (error) {
      setOutreachError(error instanceof Error ? error.message : 'Failed to log outreach')
    } finally {
      setOutreachPending(false)
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
      <div className="space-y-6">
        <section className="terminal-panel p-4 space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-[#f0ede6]">{detail.opportunity.title}</h2>
            <p className="mt-1 text-sm text-[var(--muted-strong)]">{detail.opportunity.summary ?? detail.opportunity.value_notes ?? 'Opportunity record'}</p>
          </div>
          <dl className="grid gap-3 md:grid-cols-2">
            {[
              ['Workstream', detail.opportunity.workstream],
              ['Stage', detail.opportunity.stage],
              ['Status', detail.opportunity.status],
              ['Priority', detail.opportunity.priority],
              ['Owner', detail.owner_name],
              ['Ask type', detail.opportunity.ask_type],
              ['Lead source', detail.opportunity.source_of_lead],
              ['Next action', detail.opportunity.next_action],
              ['Next follow-up', formatMaybe(detail.opportunity.next_followup_at)],
              ['Last activity', formatMaybe(detail.opportunity.last_activity_at)],
            ].map(([label, value]) => (
              <div key={label} className="border border-[var(--line)] bg-[rgba(9,13,14,0.5)] p-3 space-y-1">
                <dt className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">{label}</dt>
                <dd className="text-sm text-[#f0ede6]">{value || '—'}</dd>
              </div>
            ))}
          </dl>
          {detail.opportunity.notes_freeform ? <p className="text-sm text-[var(--muted-strong)]">{detail.opportunity.notes_freeform}</p> : null}
        </section>

        <section className="terminal-panel p-4 space-y-3">
          {sectionTitle('Linked people and organisations')}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">People</p>
              {detail.opportunity.people.length ? detail.opportunity.people.map((person) => (
                <Link key={person.id} href={`/crm/people/${person.id}`} className="block border border-[var(--line)] bg-[rgba(9,13,14,0.5)] p-3 hover:border-[var(--line-strong)]">
                  <p className="text-sm font-semibold text-[#f0ede6]">{person.full_name}</p>
                  <p className="text-xs text-[var(--muted-strong)]">{person.role_label ?? 'Linked person'}</p>
                </Link>
              )) : <p className="text-sm text-[var(--muted)]">No linked people yet.</p>}
            </div>
            <div className="space-y-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">Organisations</p>
              {detail.opportunity.organisations.length ? detail.opportunity.organisations.map((organisation) => (
                <Link key={organisation.id} href={`/crm/organisations/${organisation.id}`} className="block border border-[var(--line)] bg-[rgba(9,13,14,0.5)] p-3 hover:border-[var(--line-strong)]">
                  <p className="text-sm font-semibold text-[#f0ede6]">{organisation.name}</p>
                  <p className="text-xs text-[var(--muted-strong)]">{organisation.role_label ?? 'Linked organisation'}</p>
                </Link>
              )) : <p className="text-sm text-[var(--muted)]">No linked organisations yet.</p>}
            </div>
          </div>
        </section>

        <section className="terminal-panel p-4 space-y-3">
          {sectionTitle('Contact points', 'How do we actually reach these people? Revolutionary stuff.')}
          {contactPoints.length ? (
            <ul className="space-y-3">
              {contactPoints.map((contactPoint) => (
                <li key={contactPoint.id} className="border border-[var(--line)] bg-[rgba(9,13,14,0.5)] p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--accent-yellow)]">{contactPoint.channel}</span>
                    {contactPoint.is_primary ? <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--accent-bright)]">Primary</span> : null}
                  </div>
                  <p className="mt-2 text-sm text-[#f0ede6]">{contactPoint.value}</p>
                  <p className="mt-1 text-xs text-[var(--muted-strong)]">{contactPoint.label ?? `${contactPoint.entity_type} contact`}</p>
                  {contactPoint.notes ? <p className="mt-1 text-xs text-[var(--muted-strong)]">{contactPoint.notes}</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--muted)]">No contact points yet. Slight issue for an outreach system.</p>
          )}
        </section>

        <section className="terminal-panel p-4 space-y-3">
          {sectionTitle('Outreach log', 'What went out, what came back, what needs chasing.')}
          {detail.outreachEntries.length ? (
            <ul className="space-y-3">
              {detail.outreachEntries.map((entry) => (
                <li key={entry.id} className="border border-[var(--line)] bg-[rgba(9,13,14,0.5)] p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--accent-yellow)]">{entry.channel}</span>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">{entry.status}</span>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">{entry.direction}</span>
                  </div>
                  <p className="mt-2 text-sm text-[#f0ede6]">{entry.subject ?? entry.next_step ?? 'Outreach entry'}</p>
                  {entry.body_excerpt ? <p className="mt-1 text-xs text-[var(--muted-strong)]">{entry.body_excerpt}</p> : null}
                  <div className="mt-2 space-y-1 text-xs text-[var(--muted-strong)]">
                    <p>When: {formatMaybe(entry.happened_at)}</p>
                    <p>Next: {entry.next_step ?? '—'}</p>
                    <p>Due: {formatMaybe(entry.next_due_at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--muted)]">No outreach logged yet.</p>
          )}
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <section className="terminal-panel p-4 space-y-3">
            {sectionTitle('Linked tasks')}
            {detail.tasks.length ? (
              <ul className="space-y-3">
                {detail.tasks.map((task) => (
                  <li key={task.id} className="border border-[var(--line)] bg-[rgba(9,13,14,0.5)] p-3">
                    <p className="text-sm font-semibold text-[#f0ede6]">{task.title}</p>
                    <p className="text-xs text-[var(--muted-strong)]">{task.status} · {task.priority} · due {formatMaybe(task.due_at)}</p>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-[var(--muted)]">No linked tasks.</p>}
          </section>

          <section className="terminal-panel p-4 space-y-3">
            {sectionTitle('Recent interactions')}
            {detail.interactions.length ? (
              <ul className="space-y-3">
                {detail.interactions.map((interaction) => (
                  <li key={interaction.id} className="border border-[var(--line)] bg-[rgba(9,13,14,0.5)] p-3">
                    <p className="text-sm font-semibold text-[#f0ede6]">{interaction.summary}</p>
                    <p className="text-xs text-[var(--muted-strong)]">{interaction.interaction_type} · {interaction.direction} · {formatMaybe(interaction.happened_at)}</p>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-[var(--muted)]">No interactions yet.</p>}
          </section>
        </section>

        <section className="terminal-panel p-4 space-y-3">
          {sectionTitle('Source links')}
          {detail.sourceLinks.length ? (
            <ul className="space-y-3">
              {detail.sourceLinks.map((sourceLink) => (
                <li key={sourceLink.id} className="border border-[var(--line)] bg-[rgba(9,13,14,0.5)] p-3">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--accent-yellow)]">{sourceLink.source_system}</p>
                  {sourceLink.source_ref ? <p className="mt-1 text-sm text-[#f0ede6]">{sourceLink.source_ref}</p> : null}
                  {sourceLink.source_url ? <a className="mt-1 block break-all text-xs text-[var(--muted-strong)] underline" href={sourceLink.source_url} target="_blank" rel="noreferrer">{sourceLink.source_url}</a> : null}
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-[var(--muted)]">No provenance attached yet.</p>}
        </section>
      </div>

      <div className="space-y-6">
        <section className="terminal-panel p-4 space-y-4">
          {sectionTitle('Add contact point')}
          <form className="space-y-3" onSubmit={submitContactPoint}>
            <select value={contactEntityKey} onChange={(event) => setContactEntityKey(event.target.value)} className="w-full bg-[rgba(7,9,9,0.64)] border border-[var(--line)] text-[#f0ede6] px-3 py-2 text-sm">
              <option value="">Choose person or organisation</option>
              {contactTargets.map((target) => <option key={target.key} value={target.key}>{target.label}</option>)}
            </select>
            <select value={contactChannel} onChange={(event) => setContactChannel(event.target.value as (typeof CRM_CONTACT_CHANNELS)[number])} className="w-full bg-[rgba(7,9,9,0.64)] border border-[var(--line)] text-[#f0ede6] px-3 py-2 text-sm">
              {CRM_CONTACT_CHANNELS.map((channel) => <option key={channel} value={channel}>{channel}</option>)}
            </select>
            <input value={contactLabel} onChange={(event) => setContactLabel(event.target.value)} placeholder="Label, e.g. founder email" className="w-full bg-[rgba(7,9,9,0.64)] border border-[var(--line)] text-[#f0ede6] px-3 py-2 text-sm" />
            <input required value={contactValue} onChange={(event) => setContactValue(event.target.value)} placeholder="address / number / profile URL" className="w-full bg-[rgba(7,9,9,0.64)] border border-[var(--line)] text-[#f0ede6] px-3 py-2 text-sm" />
            <textarea value={contactNotes} onChange={(event) => setContactNotes(event.target.value)} placeholder="Notes" rows={3} className="w-full bg-[rgba(7,9,9,0.64)] border border-[var(--line)] text-[#f0ede6] px-3 py-2 text-sm" />
            <label className="flex items-center gap-2 text-xs text-[var(--muted-strong)]"><input checked={contactPrimary} onChange={(event) => setContactPrimary(event.target.checked)} type="checkbox" /> Mark as primary</label>
            {contactError ? <p className="text-xs text-red-400">{contactError}</p> : null}
            <button disabled={contactPending || !contactEntityKey || !contactValue.trim()} className="w-full bg-[rgba(14,21,16,0.84)] py-2 font-mono text-xs uppercase tracking-widest text-[var(--accent-bright)] disabled:opacity-50">{contactPending ? 'Saving…' : 'Add contact point'}</button>
          </form>
        </section>

        <section className="terminal-panel p-4 space-y-4">
          {sectionTitle('Log outreach')}
          <form className="space-y-3" onSubmit={submitOutreach}>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <select value={outreachChannel} onChange={(event) => setOutreachChannel(event.target.value as (typeof CRM_CONTACT_CHANNELS)[number])} className="w-full bg-[rgba(7,9,9,0.64)] border border-[var(--line)] text-[#f0ede6] px-3 py-2 text-sm">
                {CRM_CONTACT_CHANNELS.map((channel) => <option key={channel} value={channel}>{channel}</option>)}
              </select>
              <select value={outreachStatus} onChange={(event) => setOutreachStatus(event.target.value as (typeof CRM_OUTREACH_STATUSES)[number])} className="w-full bg-[rgba(7,9,9,0.64)] border border-[var(--line)] text-[#f0ede6] px-3 py-2 text-sm">
                {CRM_OUTREACH_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>
            <select value={outreachDirection} onChange={(event) => setOutreachDirection(event.target.value as 'outbound' | 'inbound' | 'internal')} className="w-full bg-[rgba(7,9,9,0.64)] border border-[var(--line)] text-[#f0ede6] px-3 py-2 text-sm">
              <option value="outbound">outbound</option>
              <option value="inbound">inbound</option>
              <option value="internal">internal</option>
            </select>
            <select value={outreachContactPointId} onChange={(event) => setOutreachContactPointId(event.target.value)} className="w-full bg-[rgba(7,9,9,0.64)] border border-[var(--line)] text-[#f0ede6] px-3 py-2 text-sm">
              <option value="">No explicit contact point</option>
              {contactPoints.map((contactPoint) => <option key={contactPoint.id} value={contactPoint.id}>{contactPoint.channel} · {contactPoint.value}</option>)}
            </select>
            <select value={outreachPersonId} onChange={(event) => setOutreachPersonId(event.target.value)} className="w-full bg-[rgba(7,9,9,0.64)] border border-[var(--line)] text-[#f0ede6] px-3 py-2 text-sm">
              <option value="">No linked person</option>
              {detail.opportunity.people.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}
            </select>
            <select value={outreachOrganisationId} onChange={(event) => setOutreachOrganisationId(event.target.value)} className="w-full bg-[rgba(7,9,9,0.64)] border border-[var(--line)] text-[#f0ede6] px-3 py-2 text-sm">
              <option value="">No linked organisation</option>
              {detail.opportunity.organisations.map((organisation) => <option key={organisation.id} value={organisation.id}>{organisation.name}</option>)}
            </select>
            <input value={outreachSubject} onChange={(event) => setOutreachSubject(event.target.value)} placeholder="Subject or summary" className="w-full bg-[rgba(7,9,9,0.64)] border border-[var(--line)] text-[#f0ede6] px-3 py-2 text-sm" />
            <textarea value={outreachExcerpt} onChange={(event) => setOutreachExcerpt(event.target.value)} placeholder="Excerpt / what you sent" rows={4} className="w-full bg-[rgba(7,9,9,0.64)] border border-[var(--line)] text-[#f0ede6] px-3 py-2 text-sm" />
            <input value={outreachNextStep} onChange={(event) => setOutreachNextStep(event.target.value)} placeholder="Next step" className="w-full bg-[rgba(7,9,9,0.64)] border border-[var(--line)] text-[#f0ede6] px-3 py-2 text-sm" />
            <input type="datetime-local" value={outreachNextDueAt} onChange={(event) => setOutreachNextDueAt(event.target.value)} className="w-full bg-[rgba(7,9,9,0.64)] border border-[var(--line)] text-[#f0ede6] px-3 py-2 text-sm" />
            <textarea value={outreachNotes} onChange={(event) => setOutreachNotes(event.target.value)} placeholder="Notes" rows={3} className="w-full bg-[rgba(7,9,9,0.64)] border border-[var(--line)] text-[#f0ede6] px-3 py-2 text-sm" />
            {outreachError ? <p className="text-xs text-red-400">{outreachError}</p> : null}
            <button disabled={outreachPending} className="w-full bg-[rgba(14,21,16,0.84)] py-2 font-mono text-xs uppercase tracking-widest text-[var(--accent-bright)] disabled:opacity-50">{outreachPending ? 'Saving…' : 'Log outreach'}</button>
          </form>
        </section>
      </div>
    </div>
  )
}
