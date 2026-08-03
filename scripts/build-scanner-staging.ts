// Copies deeptech-scanner's company data into a local staging DB so the LinkedIn join can run
// entirely in SQLite, off production and off the scanner's own file. deeptech.db is opened
// read-only and stays the system of record — scripts/.staging/scanner.db is a derived artefact,
// dropped and rebuilt on every run, and gitignored.
//
// Normalisation lives in scripts/lib/normalise.ts because the LinkedIn loader must apply the exact
// same rules to connection company names; a divergence there shows up as a silently missing join.

import { DatabaseSync } from 'node:sqlite'
import { mkdirSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { nameTokens, normaliseName } from './lib/normalise'

const SOURCE_DB = process.env.SCANNER_DB ?? '/Users/lchavasse/code/deeptech-scanner/deeptech.db'
const STAGING_DB = resolve(dirname(fileURLToPath(import.meta.url)), '.staging/scanner.db')

const COMPANY_COLUMNS = [
  'id',
  'name',
  'website',
  'description',
  'category',
  'is_physical',
  'sector',
  'country',
  'uk_location',
  'stage',
  'funding_notes',
  'source',
  'source_url',
  'source_context',
  'confidence',
  'notes',
  'investors',
  'pillar',
  'founders',
  'female_founder',
  'founder_evidence',
  'linkedin_company_url',
  'linkedin_founder_urls',
  'careers_url',
  'industrial_score',
  'role_mix',
  'role_summary',
] as const

// The investors column is a plain comma-separated list. Ampersands and the word "and" appear inside
// investor names ("Drees & Sommer", "International Flavors and Fragrances"), and parentheses carry
// aliases ("HCVC (Hardware Club)"), so the comma is the only safe delimiter.
function splitInvestors(value: string | null): string[] {
  if (!value) return []
  const seen = new Set<string>()
  const names: string[] = []
  for (const part of value.split(',')) {
    const name = part.trim().replace(/\s+/g, ' ')
    if (name.length < 2) continue
    const key = normaliseName(name)
    if (!key || seen.has(key)) continue
    seen.add(key)
    names.push(name)
  }
  return names
}

function openSource() {
  const db = new DatabaseSync(SOURCE_DB, { readOnly: true })
  return db
}

function createStaging() {
  rmSync(STAGING_DB, { force: true })
  mkdirSync(dirname(STAGING_DB), { recursive: true })
  const db = new DatabaseSync(STAGING_DB)
  db.exec(`
    create table companies (
      ${COMPANY_COLUMNS.map((column) => `${column} ${column === 'id' ? 'integer primary key' : 'text'}`).join(',\n      ')},
      name_norm text,
      name_tokens text
    );
    create index idx_companies_name_norm on companies(name_norm);
    create index idx_companies_name_tokens on companies(name_tokens);

    create table founders (
      id integer primary key,
      company_id integer not null,
      name text,
      name_norm text,
      claimed_role text,
      linkedin_url text,
      evidence_url text,
      founder_status text
    );
    create index idx_founders_company on founders(company_id);
    create index idx_founders_name_norm on founders(name_norm);

    create table investors (
      id integer primary key autoincrement,
      company_id integer not null,
      investor_name text not null,
      investor_norm text not null
    );
    create index idx_investors_company on investors(company_id);
    create index idx_investors_norm on investors(investor_norm);
  `)
  return db
}

function main() {
  const source = openSource()
  const staging = createStaging()

  const companies = source.prepare(`select ${COMPANY_COLUMNS.join(', ')} from companies order by id`).all() as Record<
    string,
    string | number | null
  >[]

  const insertCompany = staging.prepare(
    `insert into companies (${COMPANY_COLUMNS.join(', ')}, name_norm, name_tokens)
     values (${COMPANY_COLUMNS.map(() => '?').join(', ')}, ?, ?)`,
  )
  const insertInvestor = staging.prepare(
    'insert into investors (company_id, investor_name, investor_norm) values (?, ?, ?)',
  )

  let investorRows = 0
  staging.exec('begin')
  for (const row of companies) {
    const name = row.name == null ? '' : String(row.name)
    insertCompany.run(
      ...COMPANY_COLUMNS.map((column) => (row[column] == null ? null : String(row[column]))),
      normaliseName(name),
      nameTokens(name),
    )
    for (const investor of splitInvestors(row.investors == null ? null : String(row.investors))) {
      insertInvestor.run(Number(row.id), investor, normaliseName(investor))
      investorRows += 1
    }
  }

  const founders = source
    .prepare(
      'select id, company_id, name, claimed_role, linkedin_url, evidence_url, founder_status from founder_candidates order by id',
    )
    .all() as Record<string, string | number | null>[]

  const insertFounder = staging.prepare(
    `insert into founders (id, company_id, name, name_norm, claimed_role, linkedin_url, evidence_url, founder_status)
     values (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  for (const row of founders) {
    const name = row.name == null ? '' : String(row.name)
    insertFounder.run(
      Number(row.id),
      Number(row.company_id),
      name,
      normaliseName(name),
      row.claimed_role == null ? null : String(row.claimed_role),
      row.linkedin_url == null ? null : String(row.linkedin_url),
      row.evidence_url == null ? null : String(row.evidence_url),
      row.founder_status == null ? null : String(row.founder_status),
    )
  }
  staging.exec('commit')

  report(staging, { companies: companies.length, founders: founders.length, investorRows })

  source.close()
  staging.close()
}

function report(db: DatabaseSync, counts: { companies: number; founders: number; investorRows: number }) {
  const scalar = (sql: string) => Object.values(db.prepare(sql).get() as Record<string, unknown>)[0]

  console.log(`staging db: ${STAGING_DB}`)
  console.log(`\nrows`)
  console.log(`  companies         ${counts.companies}`)
  console.log(`  founders          ${counts.founders}`)
  console.log(`  investors         ${counts.investorRows}`)

  console.log(`\nnormalisation`)
  console.log(`  companies with name_norm   ${scalar("select count(*) from companies where name_norm <> ''")}`)
  console.log(`  companies with blank norm  ${scalar("select count(*) from companies where name_norm = ''")}`)
  const collisions = db
    .prepare(
      `select name_norm, count(*) as n from companies where name_norm <> '' group by name_norm having n > 1 order by n desc`,
    )
    .all() as { name_norm: string; n: number }[]
  const collidingRows = collisions.reduce((total, group) => total + group.n, 0)
  console.log(`  colliding name_norm keys   ${collisions.length} (${collidingRows} rows)`)
  for (const group of collisions.slice(0, 10)) {
    const names = db
      .prepare('select id, name from companies where name_norm = ? order by id')
      .all(group.name_norm) as { id: number; name: string }[]
    console.log(`    ${group.name_norm}: ${names.map((row) => `${row.name} (#${row.id})`).join(' | ')}`)
  }

  console.log(`\ninvestors`)
  console.log(`  companies with investors   ${scalar("select count(distinct company_id) from investors")}`)
  console.log(`  distinct investor_norm     ${scalar('select count(distinct investor_norm) from investors')}`)
  const top = db
    .prepare(
      `select investor_norm, count(distinct company_id) as companies,
              (select investor_name from investors i2 where i2.investor_norm = i.investor_norm limit 1) as label
       from investors i group by investor_norm order by companies desc, label limit 20`,
    )
    .all() as { label: string; companies: number }[]
  top.forEach((row, index) => {
    console.log(`  ${String(index + 1).padStart(2)}. ${row.label} — ${row.companies}`)
  })

  console.log(`\njoins`)
  console.log(
    `  UK companies with >=1 founder candidate  ${scalar(
      `select count(*) from companies c where c.uk_location is not null and trim(c.uk_location) <> ''
         and exists (select 1 from founders f where f.company_id = c.id)`,
    )}`,
  )
  console.log(
    `  founder rows with a linkedin_url         ${scalar(
      "select count(*) from founders where linkedin_url is not null and trim(linkedin_url) <> ''",
    )}`,
  )
}

main()
