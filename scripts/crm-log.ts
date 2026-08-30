import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { addContactEvent, resolveContactId, upsertContact, type ContactFields } from '../src/lib/crm/contact-writes'
import { CRM_CONTACT_EVENT_KINDS, CRM_CONTACT_SOURCES, CRM_CONTACT_STATUSES, labelsFromInput } from '../src/lib/crm/contacts'

// The CLI half of the working layer: one line about a person becomes a contact, a timeline entry
// and a date to resurface them on.
//
// The agent does the reading — turning "Jason CEO of Ginkgo Bioworks - emailed today, keen to hear
// about next year" into fields. This script does the writing, deterministically, so the same
// sentence twice produces one contact with two timeline entries rather than two contacts.
//
// Usage:
//   npm run crm:log -- entry.json
//   echo '{...}' | npm run crm:log -- -
//   npm run crm:log -- entry.json --dry-run

interface LogEntry {
  full_name: string
  company?: string | null
  role?: string | null
  email?: string | null
  phone?: string | null
  linkedin_url?: string | null
  source_system?: string
  source_ref?: string | null
  status?: string
  labels?: string[]
  note?: string | null
  owner?: string | null
  enrichment?: Record<string, unknown>
  // the timeline entry
  log?: string
  kind?: string
  happened_at?: string
  // when to resurface: either an explicit date or a duration from happened_at
  follow_up_at?: string
  resurface_in?: string
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const target = args.find((a) => !a.startsWith('--'))

  if (!target) {
    console.error('usage: npm run crm:log -- <file.json|-> [--dry-run]')
    process.exit(1)
  }

  const raw = target === '-' ? readFileSync(0, 'utf8') : readFileSync(target, 'utf8')
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    console.error(`Input is not valid JSON: ${error instanceof Error ? error.message : error}`)
    process.exit(1)
  }
  const entries: LogEntry[] = Array.isArray(parsed) ? parsed : [parsed as LogEntry]

  // Relative durations are parsed here rather than by the model. LLMs do date arithmetic badly and
  // silently, and a follow-up that lands in the wrong month is a reminder that never fires.
  function resolveFollowUp(entry: LogEntry, base: Date): string | null {
    if (entry.follow_up_at) {
      const explicit = new Date(entry.follow_up_at)
      if (Number.isNaN(explicit.getTime())) throw new Error(`Unparseable follow_up_at: ${entry.follow_up_at}`)
      return explicit.toISOString()
    }
    if (!entry.resurface_in) return null

    const match = entry.resurface_in.trim().match(/^(\d+)\s*(day|week|month|year)s?$/i)
    if (!match) throw new Error(`Unparseable resurface_in: "${entry.resurface_in}" (try "6 months", "2 weeks", "10 days")`)

    const n = Number(match[1])
    const unit = match[2].toLowerCase()
    const out = new Date(base)
    if (unit === 'day') out.setDate(out.getDate() + n)
    if (unit === 'week') out.setDate(out.getDate() + n * 7)
    if (unit === 'month') out.setMonth(out.getMonth() + n)
    if (unit === 'year') out.setFullYear(out.getFullYear() + n)
    return out.toISOString()
  }

  function validate(entry: LogEntry) {
    if (!entry.full_name?.trim()) throw new Error('full_name is required')
    const source = entry.source_system ?? 'manual'
    if (!CRM_CONTACT_SOURCES.includes(source as never)) throw new Error(`Invalid source_system: ${source}`)
    if (entry.status && !CRM_CONTACT_STATUSES.includes(entry.status as never)) throw new Error(`Invalid status: ${entry.status}`)
    if (entry.kind && !CRM_CONTACT_EVENT_KINDS.includes(entry.kind as never)) throw new Error(`Invalid kind: ${entry.kind}`)
  }

  function requireEnv(name: string): string {
    const value = process.env[name]
    if (!value) throw new Error(`Missing env var: ${name}`)
    return value
  }

  const supabase = createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'))

  let failures = 0

  for (const entry of entries) {
    try {
      validate(entry)

      const happenedAt = entry.happened_at ? new Date(entry.happened_at) : new Date()
      if (Number.isNaN(happenedAt.getTime())) throw new Error(`Unparseable happened_at: ${entry.happened_at}`)
      const followUp = resolveFollowUp(entry, happenedAt)

      const fields: ContactFields = {
        full_name: entry.full_name.trim(),
        company: entry.company ?? null,
        role: entry.role ?? null,
        email: entry.email ?? null,
        phone: entry.phone ?? null,
        linkedin_url: entry.linkedin_url ?? null,
        source_system: entry.source_system ?? 'manual',
        source_ref: entry.source_ref ?? null,
        ...(entry.status ? { status: entry.status } : {}),
        ...(entry.note !== undefined ? { note: entry.note } : {}),
        ...(entry.owner ? { owner: entry.owner } : {}),
        ...(followUp ? { next_followup_at: followUp } : {}),
        ...(entry.enrichment ? { enrichment: entry.enrichment, enriched_at: new Date().toISOString() } : {}),
      }

      if (entry.labels) {
        const labels = labelsFromInput(entry.labels)
        if (!labels) throw new Error('labels must be an array of strings')
        fields.labels = labels
      }

      if (dryRun) {
        const existing = await resolveContactId(supabase, {
          source_system: fields.source_system,
          source_ref: fields.source_ref,
          linkedin_url: fields.linkedin_url,
          email: fields.email,
          full_name: fields.full_name,
          company: fields.company,
        })
        console.log(`[dry-run] ${existing ? 'UPDATE' : 'CREATE'} ${fields.full_name}${fields.company ? ` (${fields.company})` : ''}`)
        if (entry.log) console.log(`[dry-run]   + ${entry.kind ?? 'note'}: ${entry.log}`)
        if (followUp) console.log(`[dry-run]   resurface ${followUp.slice(0, 10)}`)
        continue
      }

      const { contact, created } = await upsertContact(supabase, fields)
      const id = contact.id as string
      console.log(`${created ? 'created' : 'updated'}  ${fields.full_name}${fields.company ? ` · ${fields.company}` : ''}  ${id}`)

      if (entry.log?.trim()) {
        await addContactEvent(supabase, {
          contact_id: id,
          body: entry.log.trim(),
          kind: entry.kind ?? 'note',
          happened_at: happenedAt.toISOString(),
          author: entry.owner ?? null,
        })
        console.log(`          + ${entry.kind ?? 'note'}: ${entry.log.trim()}`)
      }

      if (followUp) console.log(`          resurface ${followUp.slice(0, 10)}`)
    } catch (error) {
      failures += 1
      console.error(`FAILED  ${entry.full_name ?? '(no name)'}: ${error instanceof Error ? error.message : error}`)
    }
  }

  if (failures) {
    console.error(`\n${failures} of ${entries.length} entries failed.`)
    process.exit(1)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
