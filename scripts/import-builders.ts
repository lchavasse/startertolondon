/**
 * Import Agents in the Wild signups into aitw_builders from a Luma guest CSV.
 *
 *   npm run import-builders -- path/to/guests.csv
 *
 * Re-runnable: existing emails are never overwritten (so self-edited rows are
 * safe) — except a missing phone, which gets backfilled from the CSV.
 * Uses the service role key so it bypasses RLS.
 */
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { Database } from '../src/lib/database.types'

// minimal CSV parser that handles quoted fields and embedded commas/newlines
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') inQuotes = false
      else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some((f) => f !== '')) rows.push(row)
      row = []
    } else field += c
  }
  row.push(field)
  if (row.some((f) => f !== '')) rows.push(row)
  return rows
}

function findColumn(header: string[], ...candidates: string[]): number {
  const normalized = header.map((h) => h.trim().toLowerCase().replace(/[^a-z0-9]/g, '_'))
  for (const candidate of candidates) {
    const idx = normalized.indexOf(candidate)
    if (idx !== -1) return idx
  }
  return -1
}

async function main() {
  const csvPath = process.argv[2]
  if (!csvPath) {
    console.error('Usage: npm run import-builders -- path/to/guests.csv')
    process.exit(1)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  const supabase = createClient<Database>(url, key)

  const rows = parseCsv(readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, ''))
  if (rows.length < 2) throw new Error('CSV has no data rows')
  const header = rows[0]

  const emailCol = findColumn(header, 'email', 'email_address')
  const nameCol = findColumn(header, 'name', 'full_name')
  const firstCol = findColumn(header, 'first_name')
  const lastCol = findColumn(header, 'last_name')
  const phoneCol = findColumn(header, 'phone', 'phone_number', 'mobile')
  const statusCol = findColumn(header, 'approval_status', 'status')
  if (emailCol === -1) throw new Error(`No email column found in: ${header.join(', ')}`)
  if (nameCol === -1 && firstCol === -1) throw new Error(`No name column found in: ${header.join(', ')}`)

  type Incoming = { name: string; email: string; phone: string | null }
  const incoming = new Map<string, Incoming>()
  let skippedStatus = 0
  for (const row of rows.slice(1)) {
    const email = (row[emailCol] ?? '').trim().toLowerCase()
    if (!email.includes('@')) continue
    const status = statusCol === -1 ? '' : (row[statusCol] ?? '').trim().toLowerCase()
    if (status && !['approved', 'going', 'invited'].includes(status)) { skippedStatus++; continue }
    const name =
      nameCol !== -1 && (row[nameCol] ?? '').trim()
        ? row[nameCol].trim()
        : [row[firstCol] ?? '', lastCol !== -1 ? row[lastCol] ?? '' : ''].join(' ').trim()
    if (!name) continue
    const phone = phoneCol === -1 ? null : (row[phoneCol] ?? '').trim() || null
    incoming.set(email, { name, email, phone })
  }
  console.log(`CSV: ${incoming.size} usable rows${skippedStatus ? ` (${skippedStatus} skipped by status)` : ''}`)

  const { data: existing, error } = await supabase.from('aitw_builders').select('email, phone')
  if (error) throw error
  const existingByEmail = new Map(existing.map((b) => [b.email, b]))

  const toInsert = [...incoming.values()].filter((b) => !existingByEmail.has(b.email))
  if (toInsert.length) {
    const { error: insertError } = await supabase
      .from('aitw_builders')
      .insert(toInsert.map((b) => ({ ...b, source: 'import' })))
    if (insertError) throw insertError
  }

  let backfilled = 0
  for (const b of incoming.values()) {
    const row = existingByEmail.get(b.email)
    if (row && !row.phone && b.phone) {
      const { error: updateError } = await supabase
        .from('aitw_builders')
        .update({ phone: b.phone })
        .eq('email', b.email)
      if (updateError) throw updateError
      backfilled++
    }
  }

  console.log(
    `Inserted ${toInsert.length} new builders, backfilled ${backfilled} phones, ` +
      `${existingByEmail.size} already present.`
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
