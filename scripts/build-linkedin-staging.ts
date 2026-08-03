/**
 * Build the local LinkedIn staging database — chunk 1 of the CRM plan.
 *
 *   unzip -o -j ~/Downloads/Complete_LinkedInDataExport_08-02-2026.zip.zip \
 *     Connections.csv messages.csv Invitations.csv -d scripts/.staging/
 *   npx tsx scripts/build-linkedin-staging.ts
 *
 * Staging is local-only and gitignored because messages.csv holds private message bodies that must
 * never reach Supabase or git — only derived fields (counts, dates, who owes a reply) are ever
 * promoted. The DB is a derived artefact, so every run drops and rebuilds rather than upserting;
 * that is what makes it trivially re-runnable and identical run to run.
 *
 * Normalisation comes from scripts/lib/normalise.ts, shared with the scanner loader — the two
 * staging DBs are joined on name_norm / tokens, so a local variant here would silently under-match.
 *
 * Zero LLM calls. Nothing here talks to a network.
 */
import { readFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { nameTokens, normaliseName } from './lib/normalise'

const STAGING_DIR = join(process.cwd(), 'scripts', '.staging')
const DB_PATH = join(STAGING_DIR, 'linkedin.db')
const LACHLAN_URL = 'https://www.linkedin.com/in/lchavasse'

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

// LinkedIn prefixes Connections.csv with three notes lines before the real header.
function readTable(file: string): Array<Record<string, string>> {
  const rows = parseCsv(readFileSync(join(STAGING_DIR, file), 'utf8').replace(/^﻿/, ''))
  const headerIndex = rows.findIndex((row) => row.length > 2)
  const header = rows[headerIndex].map((h) => h.trim())
  return rows.slice(headerIndex + 1).map((row) => {
    const record: Record<string, string> = {}
    header.forEach((key, i) => { record[key] = (row[i] ?? '').trim() })
    return record
  })
}

function normProfileUrl(value: string | null | undefined) {
  const trimmed = (value ?? '').trim().split('?')[0].replace(/\/+$/, '')
  return trimmed.toLowerCase()
}

// "31 Jul 2026" -> "2026-07-31"
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
function parseConnectedOn(value: string) {
  const match = value.match(/^(\d{1,2}) ([A-Za-z]{3}) (\d{4})$/)
  if (!match) return null
  const month = MONTHS.indexOf(match[2].toLowerCase())
  if (month < 0) return null
  return `${match[3]}-${String(month + 1).padStart(2, '0')}-${match[1].padStart(2, '0')}`
}

// "2026-07-31 19:58:16 UTC" -> "2026-07-31T19:58:16Z"
function parseMessageDate(value: string) {
  const match = value.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})/)
  return match ? `${match[1]}T${match[2]}Z` : null
}

// "7/31/26, 3:03 PM" -> "2026-07-31T15:03:00"
function parseInviteDate(value: string) {
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),\s*(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return null
  const [, month, day, year, rawHour, minute, meridiem] = match
  let hour = Number(rawHour) % 12
  if (meridiem.toUpperCase() === 'PM') hour += 12
  const fullYear = year.length === 2 ? `20${year}` : year
  return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${String(hour).padStart(2, '0')}:${minute}:00`
}

type Participant = { name: string; url: string }

type ConversationAccumulator = {
  participants: Map<string, Participant>
  messageCount: number
  lachlanCount: number
  firstAt: string | null
  lastAt: string | null
  lastSender: 'lachlan' | 'counterparty' | null
}

function isLachlan(url: string, name: string) {
  return url === LACHLAN_URL || (!url && name.toLowerCase() === 'lachlan chavasse')
}

function buildConnections(db: DatabaseSync) {
  db.exec(`
    create table connections (
      first_name text,
      last_name text,
      full_name text,
      profile_url text,
      email text,
      company text,
      position text,
      connected_on text,
      name_norm text,
      company_norm text,
      company_tokens text
    )
  `)
  const insert = db.prepare(`
    insert into connections (first_name, last_name, full_name, profile_url, email, company, position, connected_on, name_norm, company_norm, company_tokens)
    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const rows = readTable('Connections.csv')
  for (const row of rows) {
    const first = row['First Name'] ?? ''
    const last = row['Last Name'] ?? ''
    const full = `${first} ${last}`.trim()
    insert.run(
      first || null,
      last || null,
      full || null,
      normProfileUrl(row['URL']) || null,
      row['Email Address'] || null,
      row['Company'] || null,
      row['Position'] || null,
      parseConnectedOn(row['Connected On'] ?? ''),
      normaliseName(full),
      normaliseName(row['Company']) || null,
      nameTokens(row['Company']) || null,
    )
  }
  db.exec('create index connections_name_norm on connections (name_norm)')
  db.exec('create index connections_company_norm on connections (company_norm)')
  return rows.length
}

// counterparty_message_count is every message Lachlan did not send, so in a group thread it covers
// all the other participants rather than just the designated counterparty.
function buildConversations(db: DatabaseSync) {
  db.exec(`
    create table messages (
      conversation_id text,
      sender_name text,
      sender_profile_url text,
      sent_at text,
      subject text,
      content text,
      folder text
    );
    create table conversations (
      conversation_id text primary key,
      counterparty_name text,
      counterparty_profile_url text,
      is_group integer not null default 0,
      message_count integer not null,
      first_message_at text,
      last_message_at text,
      last_sender text,
      awaiting_reply_from text,
      lachlan_message_count integer not null,
      counterparty_message_count integer not null
    )
  `)

  const insertMessage = db.prepare(`
    insert into messages (conversation_id, sender_name, sender_profile_url, sent_at, subject, content, folder)
    values (?, ?, ?, ?, ?, ?, ?)
  `)
  const insertConversation = db.prepare(`
    insert into conversations (conversation_id, counterparty_name, counterparty_profile_url, is_group, message_count, first_message_at, last_message_at, last_sender, awaiting_reply_from, lachlan_message_count, counterparty_message_count)
    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const rows = readTable('messages.csv')
  const conversations = new Map<string, ConversationAccumulator>()

  db.exec('begin')
  for (const row of rows) {
    const conversationId = row['CONVERSATION ID'] ?? ''
    const senderName = row['FROM'] ?? ''
    const senderUrl = normProfileUrl(row['SENDER PROFILE URL'])
    const sentAt = parseMessageDate(row['DATE'] ?? '')

    insertMessage.run(
      conversationId || null,
      senderName || null,
      senderUrl || null,
      sentAt,
      row['SUBJECT'] || null,
      row['CONTENT'] || null,
      row['FOLDER'] || null,
    )

    if (!conversationId) continue

    let acc = conversations.get(conversationId)
    if (!acc) {
      acc = { participants: new Map(), messageCount: 0, lachlanCount: 0, firstAt: null, lastAt: null, lastSender: null }
      conversations.set(conversationId, acc)
    }

    const recipientNames = (row['TO'] ?? '').split(',').map((s) => s.trim())
    const recipientUrls = (row['RECIPIENT PROFILE URLS'] ?? '').split(',').map((s) => normProfileUrl(s))
    const seen: Participant[] = [{ name: senderName, url: senderUrl }]
    recipientUrls.forEach((url, i) => seen.push({ name: recipientNames[i] ?? '', url }))
    for (const person of seen) {
      if (!person.url && !person.name) continue
      if (isLachlan(person.url, person.name)) continue
      const key = person.url || `name:${normaliseName(person.name)}`
      if (!acc.participants.has(key)) acc.participants.set(key, person)
    }

    const fromLachlan = isLachlan(senderUrl, senderName)
    acc.messageCount += 1
    if (fromLachlan) acc.lachlanCount += 1
    if (sentAt) {
      if (!acc.firstAt || sentAt < acc.firstAt) acc.firstAt = sentAt
      if (!acc.lastAt || sentAt >= acc.lastAt) {
        acc.lastAt = sentAt
        acc.lastSender = fromLachlan ? 'lachlan' : 'counterparty'
      }
    } else if (!acc.lastSender) {
      acc.lastSender = fromLachlan ? 'lachlan' : 'counterparty'
    }
  }

  for (const [conversationId, acc] of conversations) {
    const counterparty = acc.participants.values().next().value as Participant | undefined
    insertConversation.run(
      conversationId,
      counterparty?.name || null,
      counterparty?.url || null,
      acc.participants.size > 1 ? 1 : 0,
      acc.messageCount,
      acc.firstAt,
      acc.lastAt,
      acc.lastSender,
      acc.lastSender === 'lachlan' ? 'counterparty' : 'lachlan',
      acc.lachlanCount,
      acc.messageCount - acc.lachlanCount,
    )
  }
  db.exec('commit')

  db.exec('create index conversations_counterparty_url on conversations (counterparty_profile_url)')
  return { messages: rows.length, conversations: conversations.size }
}

function buildInvitations(db: DatabaseSync) {
  db.exec(`
    create table invitations (
      from_name text,
      to_name text,
      sent_at text,
      message text,
      direction text,
      inviter_profile_url text,
      invitee_profile_url text
    )
  `)
  const insert = db.prepare(`
    insert into invitations (from_name, to_name, sent_at, message, direction, inviter_profile_url, invitee_profile_url)
    values (?, ?, ?, ?, ?, ?, ?)
  `)
  const rows = readTable('Invitations.csv')
  db.exec('begin')
  for (const row of rows) {
    insert.run(
      row['From'] || null,
      row['To'] || null,
      parseInviteDate(row['Sent At'] ?? ''),
      row['Message'] || null,
      row['Direction'] || null,
      normProfileUrl(row['inviterProfileUrl']) || null,
      normProfileUrl(row['inviteeProfileUrl']) || null,
    )
  }
  db.exec('commit')
  return rows.length
}

function count(db: DatabaseSync, sql: string) {
  return Number((db.prepare(sql).get() as { n: number }).n)
}

function main() {
  mkdirSync(STAGING_DIR, { recursive: true })
  rmSync(DB_PATH, { force: true })
  const db = new DatabaseSync(DB_PATH)

  const connectionCount = buildConnections(db)
  const { messages, conversations } = buildConversations(db)
  const invitationCount = buildInvitations(db)

  const withCompany = count(db, `select count(*) as n from connections where company is not null`)
  const distinctCounterparties = count(db, `select count(distinct coalesce(counterparty_profile_url, counterparty_name)) as n from conversations where counterparty_name is not null or counterparty_profile_url is not null`)
  const owedByLachlan = count(db, `select count(*) as n from conversations where awaiting_reply_from = 'lachlan'`)
  const owedByCounterparty = count(db, `select count(*) as n from conversations where awaiting_reply_from = 'counterparty'`)
  const groups = count(db, `select count(*) as n from conversations where is_group = 1`)

  console.log(`connections   ${connectionCount} rows (${withCompany} with a company)`)
  console.log(`messages      ${messages} rows`)
  console.log(`conversations ${conversations} rows (${groups} group threads, ${distinctCounterparties} distinct counterparties)`)
  console.log(`invitations   ${invitationCount} rows`)
  console.log(`awaiting reply from lachlan ${owedByLachlan} · from counterparty ${owedByCounterparty}`)

  const owed = db.prepare(`
    select counterparty_name, counterparty_profile_url, last_message_at, message_count
    from conversations
    where awaiting_reply_from = 'lachlan' and last_message_at is not null
    order by last_message_at desc
    limit 15
  `).all() as Array<{ counterparty_name: string; counterparty_profile_url: string; last_message_at: string; message_count: number }>

  console.log(`\nmost recent threads where Lachlan owes a reply`)
  const now = Date.now()
  for (const row of owed) {
    const days = Math.floor((now - Date.parse(row.last_message_at)) / 86_400_000)
    console.log(`  ${String(days).padStart(4)}d  ${row.counterparty_name ?? row.counterparty_profile_url} (${row.message_count} msgs)`)
  }

  db.close()
}

main()
