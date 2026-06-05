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

// Card covers are lazy-loaded, so a naive screenshot captures blank tiles for
// anything below the fold. Scroll the whole page to trigger every loader, then
// wait until all images have actually decoded before capturing.
async function settleImages(page: Page) {
  // Scroll through the page from Node (not one big in-page function — esbuild's
  // keepNames helper `__name` isn't defined in the browser context) to trigger
  // every lazy loader, then wait until all images have decoded.
  const height = await page.evaluate(() => document.body.scrollHeight)
  const vh = await page.evaluate(() => window.innerHeight)
  for (let y = 0; y < height; y += Math.round(vh * 0.8)) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y)
    await page.waitForTimeout(120)
  }
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.evaluate(() =>
    Promise.all(
      Array.from(document.images).map((img) =>
        img.complete && img.naturalWidth > 0
          ? Promise.resolve()
          : new Promise((res) => {
              img.addEventListener('load', () => res(null), { once: true })
              img.addEventListener('error', () => res(null), { once: true })
            })
      )
    ).then(() => undefined)
  )
  await page.waitForTimeout(300)
}

// Bounding box (page coords) enclosing exactly the rendered event cards in the
// active grid — empty grid tracks have no DOM node, so a 3-event day crops to 3.
async function cardClip(page: Page) {
  const clip = await page.evaluate(() => {
    const grids = Array.from(document.querySelectorAll('.grid'))
    const grid = grids[grids.length - 1]
    if (!grid) return null
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity
    for (const child of Array.from(grid.children)) {
      const box = child.getBoundingClientRect()
      if (box.width === 0 || box.height === 0) continue
      l = Math.min(l, box.left); t = Math.min(t, box.top)
      r = Math.max(r, box.right); b = Math.max(b, box.bottom)
    }
    if (!isFinite(l)) return null
    return { x: l + window.scrollX, y: t + window.scrollY, width: r - l, height: b - t }
  })
  if (!clip) throw new Error('no event cards found to crop to')
  return clip
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
  await page.waitForTimeout(600) // let the grid settle
  await settleImages(page) // force lazy covers to load before capture

  // Crop to just the event cards — no "London Calling" page chrome, and tight
  // to however many events the day has (e.g. a clean 3-card Monday).
  let clip = await cardClip(page)

  // clip-beyond-viewport is unreliable here, so grow the viewport to fit the
  // whole grid (multi-row days), then re-measure and capture within it.
  const needed = Math.ceil(clip.y + clip.height + 40)
  if (needed > VIEWPORT.height) {
    await page.setViewportSize({ width: VIEWPORT.width, height: needed })
    await page.waitForTimeout(300)
    await settleImages(page)
    clip = await cardClip(page)
  }

  await page.screenshot({ path: outPath, clip })
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

  // Scope to the card grid — the page header/promo banner can contain the same
  // text (e.g. an "Agents in the Wild" site banner) and would steal the match.
  const grid = page.locator('.grid').first()
  for (const title of titles) {
    const card = grid.getByText(title, { exact: false }).first()
    await card.scrollIntoViewIfNeeded()
    await card.click()
  }

  await page.getByRole('button', { name: /^View selected/ }).click()
  await page.waitForTimeout(600)
  await settleImages(page) // force lazy covers to load before capture

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
