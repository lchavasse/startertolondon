/**
 * Screenshot helper for the weekly events post.
 *
 * Drives the real /events UI on a running dev server with Playwright — no app
 * changes — and writes PNGs into docs/posts/assets/<week>/ for use as `img:`
 * refs in the post markdown. Two modes mirror Lachlan's manual shots:
 *
 *   --day <YYYY-MM-DD>   the curated /events grid filtered to one day
 *                        (full page: header + cards), like the Thursday shot.
 *   --select "<a, b, …>" a hand-picked set rendered as the 4-up card grid
 *                        (cards only), like the weekend-hacks collage. Needs
 *                        ADMIN_SECRET (admin select-and-view).
 *
 * Prereq: start the app first — `npm run dev` (defaults to http://localhost:3000).
 *
 * Usage:
 *   npm run screenshot -- --week 2026-05-31 --day 2026-06-04
 *   npm run screenshot -- --week 2026-05-31 --select "VibeHack, NVIDIA Hack, Pop The Bubble, Agent Economy" --out sat-hacks.png
 *   npm run screenshot -- ... --base-url http://localhost:3001
 */

import { chromium, type Page } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const VIEWPORT = { width: 1440, height: 1024 }

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function weekdaySlug(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  const wd = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'short',
  }).format(new Date(Date.UTC(y, m - 1, d, 12)))
  return wd.toLowerCase()
}

async function shootDay(page: Page, baseUrl: string, day: string, outPath: string) {
  await page.goto(`${baseUrl}/events`, { waitUntil: 'domcontentloaded' })
  await page.locator('.grid').first().waitFor({ timeout: 15000 })

  // Open filters → set the date → close the panel (matches the manual shot).
  await page.getByRole('button', { name: 'Show filters' }).click()
  const date = page.locator('input[type="date"]')
  await date.fill(day)
  await date.dispatchEvent('change')
  await page.getByRole('button', { name: 'Hide filters' }).click()
  await page.waitForTimeout(600) // let the grid settle + images paint

  await page.screenshot({ path: outPath, fullPage: true })
}

async function shootSelect(
  page: Page,
  baseUrl: string,
  titles: string[],
  outPath: string
) {
  const secret = process.env.ADMIN_SECRET
  if (!secret) throw new Error('--select needs ADMIN_SECRET in .env.local')

  // Seed the admin key the grid reads from sessionStorage, before any script runs.
  await page.addInitScript((key) => sessionStorage.setItem('admin-key', key), secret)
  await page.goto(`${baseUrl}/events`, { waitUntil: 'domcontentloaded' })
  await page.locator('.grid').first().waitFor({ timeout: 15000 })

  await page.getByRole('button', { name: 'Admin', exact: true }).click()
  await page.getByRole('button', { name: 'Select', exact: true }).click()

  for (const title of titles) {
    const card = page.getByText(title, { exact: false }).first()
    await card.scrollIntoViewIfNeeded()
    await card.click()
  }

  await page.getByRole('button', { name: /^View selected/ }).click()
  await page.waitForTimeout(600)

  // Cards only (no header) — grab just the card grid, like the collage.
  await page.locator('.grid').last().screenshot({ path: outPath })
}

async function main() {
  const baseUrl = (arg('--base-url') ?? 'http://localhost:3000').replace(/\/$/, '')
  const week = arg('--week')
  const day = arg('--day')
  const select = arg('--select')
  if (!week) throw new Error('--week <YYYY-MM-DD> is required (sets the assets folder)')
  if (!day && !select) throw new Error('pass --day <date> or --select "<titles>"')

  // Preflight: dev server reachable?
  try {
    await fetch(`${baseUrl}/events`, { signal: AbortSignal.timeout(3000) })
  } catch {
    throw new Error(`can't reach ${baseUrl} — start the app first with \`npm run dev\``)
  }

  const dir = join('docs/posts/assets', week)
  mkdirSync(dir, { recursive: true })

  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 2 })
  try {
    if (day) {
      const out = join(dir, arg('--out') ?? `${weekdaySlug(day)}-curated.png`)
      await shootDay(page, baseUrl, day, out)
      console.log(`✓ ${out}`)
    } else if (select) {
      const titles = select.split(',').map((s) => s.trim()).filter(Boolean)
      const out = join(dir, arg('--out') ?? 'selected.png')
      await shootSelect(page, baseUrl, titles, out)
      console.log(`✓ ${out}  (${titles.length} cards)`)
    }
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error(`\n✗ ${err.message}`)
  process.exit(1)
})
