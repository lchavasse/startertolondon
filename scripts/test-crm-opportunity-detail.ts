import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const baseUrl = process.env.CRM_BASE_URL ?? 'http://127.0.0.1:3010'
const secret = process.env.ADMIN_SECRET

async function loginAndAssertOpportunityWorkbench() {
  assert(secret, 'ADMIN_SECRET is required for CRM test login')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()

  const authResponse = await context.request.post(`${baseUrl}/api/crm/auth`, {
    data: { key: secret, next: '/crm/opportunities' },
  })
  assert.equal(authResponse.status(), 200, 'expected CRM auth to succeed')

  const page = await context.newPage()
  await page.goto(`${baseUrl}/crm/opportunities`, { waitUntil: 'domcontentloaded' })

  const firstOpenLink = page.getByRole('link', { name: 'open' }).first()
  await firstOpenLink.waitFor({ timeout: 15000 })
  const href = await firstOpenLink.getAttribute('href')

  assert(href, 'expected an opportunity open link')
  assert.match(href, /^\/crm\/opportunities\/[a-z0-9-]+$/i, `expected detail route href, got ${href}`)

  await firstOpenLink.click()
  await page.waitForURL(/\/crm\/opportunities\/[a-z0-9-]+$/i)
  await page.getByRole('heading', { name: 'Outreach log' }).waitFor({ timeout: 15000 })
  await page.getByRole('heading', { name: 'Contact points' }).waitFor({ timeout: 15000 })

  await browser.close()
}

loginAndAssertOpportunityWorkbench().catch((error) => {
  console.error(error)
  process.exit(1)
})
