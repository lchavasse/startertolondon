/**
 * Push a weekly post (docs/posts/<week>.md) to Typefully as a draft.
 *
 * Parses the markdown into an X thread (split on `---`) and a LinkedIn post,
 * uploads any inline images as native media, and creates ONE Typefully draft
 * spanning both platforms. Defaults to saving a draft (not publishing) so you
 * review + schedule inside Typefully — same human gate as before, minus the
 * copy-paste.
 *
 * Inline images (your chosen flow): add image refs under any post. Either
 * markdown `![](...)` or a bare `img: <path-or-url>` line. Local paths resolve
 * from the repo root; http(s) URLs (e.g. a Luma coverUrl) are downloaded.
 * The ref lines are stripped from the posted text.
 *
 *   # X thread
 *   the big one ...
 *   img: docs/posts/assets/2026-05-31/opener.png
 *   ---
 *   **Mon 1** ...
 *
 * Usage:
 *   npm run post-thread -- 2026-05-31                 # dry-run by default
 *   npm run post-thread -- 2026-05-31 --send          # create the draft
 *   npm run post-thread -- 2026-05-31 --send --publish next-free-slot
 *   npm run post-thread -- 2026-05-31 --send --publish 2026-05-31T08:00:00+01:00
 *
 * Env (.env.local): TYPEFULLY_API_KEY, TYPEFULLY_SOCIAL_SET_ID
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { basename, resolve } from 'node:path'

const API = 'https://api.typefully.com/v2'

interface Post {
  text: string
  media: string[] // local paths or URLs, pre-upload
}

interface Parsed {
  xPosts: Post[]
  linkedin: Post | null
}

// ---------- markdown parsing ----------

/** Body of a `# Heading` section, up to the next `# ` heading. */
function section(md: string, heading: string): string {
  const start = md.search(new RegExp(`^#\\s+${heading}\\s*$`, 'im'))
  if (start === -1) return ''
  const after = md.slice(start)
  const rel = after.slice(1).search(/^#\s+/m)
  return (rel === -1 ? after : after.slice(0, rel + 1)).replace(/^#.*\n/, '')
}

const IMG_MD = /!\[[^\]]*\]\(([^)]+)\)/g
const IMG_LINE = /^img:\s*(.+)$/gim

/** Map a char to its Unicode sans-serif bold equivalent (matches Lachlan's 𝗟𝗙𝗚 style). */
function boldChar(c: string): string {
  const code = c.codePointAt(0)!
  if (code >= 0x41 && code <= 0x5a) return String.fromCodePoint(0x1d5d4 + code - 0x41) // A-Z
  if (code >= 0x61 && code <= 0x7a) return String.fromCodePoint(0x1d5ee + code - 0x61) // a-z
  if (code >= 0x30 && code <= 0x39) return String.fromCodePoint(0x1d7ec + code - 0x30) // 0-9
  return c
}

/**
 * X/LinkedIn don't render markdown, so `**bold**` posts literally. Convert each
 * `**...**` span to Unicode bold — but leave @handles inside as ASCII so X still
 * linkifies the mention.
 */
function boldify(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, (_, inner: string) =>
    inner
      .split(/(@[A-Za-z0-9_]+)/)
      .map((tok) => (tok.startsWith('@') ? tok : [...tok].map(boldChar).join('')))
      .join('')
  )
}

/** Pull image refs out of a block and return cleaned text + the refs. */
function splitMedia(block: string): Post {
  const media: string[] = []
  for (const m of block.matchAll(IMG_MD)) media.push(m[1].trim())
  for (const m of block.matchAll(IMG_LINE)) media.push(m[1].trim())
  const text = boldify(
    block
      .replace(IMG_MD, '')
      .replace(IMG_LINE, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  )
  return { text, media }
}

function parse(md: string): Parsed {
  const xPosts = section(md, 'X thread')
    .split(/^---$/m)
    .map(splitMedia)
    .filter((p) => p.text || p.media.length)

  const liBody = section(md, 'LinkedIn').replace(/\n---\s*$/, '').trim()
  const linkedin = liBody ? splitMedia(liBody) : null

  return { xPosts, linkedin }
}

// ---------- Typefully API ----------

function auth(): { key: string; socialSet: string } {
  const key = process.env.TYPEFULLY_API_KEY
  const socialSet = process.env.TYPEFULLY_SOCIAL_SET_ID
  if (!key || !socialSet) {
    throw new Error(
      'Missing TYPEFULLY_API_KEY and/or TYPEFULLY_SOCIAL_SET_ID in .env.local.\n' +
        'Get them from Typefully → Settings → API (enable Development mode to see the social_set_id),\n' +
        'or run without --send for a dry-run.'
    )
  }
  return { key, socialSet }
}

async function bytesFor(ref: string): Promise<{ name: string; body: Buffer }> {
  if (/^https?:\/\//.test(ref)) {
    const res = await fetch(ref)
    if (!res.ok) throw new Error(`fetch image ${ref}: ${res.status}`)
    const name = basename(new URL(ref).pathname) || 'image'
    return { name, body: Buffer.from(await res.arrayBuffer()) }
  }
  const path = resolve(ref)
  if (!existsSync(path)) throw new Error(`image not found: ${ref}`)
  return { name: basename(path), body: readFileSync(path) }
}

/** 3-step Typefully upload → media_id. */
async function uploadMedia(
  ref: string,
  key: string,
  socialSet: string
): Promise<string> {
  const { name, body } = await bytesFor(ref)

  const init = await fetch(`${API}/social-sets/${socialSet}/media/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_name: name }),
  })
  if (!init.ok) throw new Error(`media/upload ${name}: ${init.status} ${await init.text()}`)
  const { media_id, upload_url } = (await init.json()) as {
    media_id: string
    upload_url: string
  }

  // Plain PUT, raw bytes, no extra headers (per Typefully docs).
  const put = await fetch(upload_url, { method: 'PUT', body: body as unknown as BodyInit })
  if (!put.ok) throw new Error(`s3 PUT ${name}: ${put.status}`)

  await waitReady(media_id, name, key, socialSet)
  console.log(`  ↑ uploaded ${name} → ${media_id}`)
  return media_id
}

/** Poll media status until ready — drafts.create rejects still-processing media. */
async function waitReady(
  mediaId: string,
  name: string,
  key: string,
  socialSet: string
): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const res = await fetch(`${API}/social-sets/${socialSet}/media/${mediaId}`, {
      headers: { Authorization: `Bearer ${key}` },
    })
    if (res.ok) {
      const { status } = (await res.json()) as { status: string }
      if (status === 'ready') return
      if (status === 'failed') throw new Error(`media processing failed: ${name}`)
    }
    await new Promise((r) => setTimeout(r, 1500))
  }
  throw new Error(`media ${name} not ready after 30s`)
}

async function uploadAll(
  posts: Post[],
  key: string,
  socialSet: string
): Promise<Array<{ text: string; media_ids: string[] }>> {
  const out: Array<{ text: string; media_ids: string[] }> = []
  for (const p of posts) {
    const media_ids: string[] = []
    for (const ref of p.media) media_ids.push(await uploadMedia(ref, key, socialSet))
    out.push({ text: p.text, media_ids })
  }
  return out
}

// ---------- main ----------

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function main() {
  const slug = process.argv[2]
  if (!slug || slug.startsWith('--')) {
    throw new Error('Usage: npm run post-thread -- <YYYY-MM-DD> [--send] [--publish now|next-free-slot|<iso>]')
  }
  const file = `docs/posts/${slug}-week.md`
  if (!existsSync(file)) throw new Error(`no post file at ${file}`)

  const parsed = parse(readFileSync(file, 'utf8'))
  const send = process.argv.includes('--send')
  const publishAt = arg('--publish') // undefined → save as draft

  console.log(
    `[post] ${file}\n      ${parsed.xPosts.length} X posts, ${parsed.linkedin ? '1' : '0'} LinkedIn, ` +
      `${parsed.xPosts.reduce((n, p) => n + p.media.length, 0) + (parsed.linkedin?.media.length ?? 0)} images`
  )
  parsed.xPosts.forEach((p, i) =>
    console.log(`\n  [${i + 1}] ${p.text.split('\n')[0].slice(0, 70)}${p.media.length ? `  🖼 ${p.media.length}` : ''}`)
  )

  const sidecar = `docs/posts/${slug}-week.typefully.json`
  if (existsSync(sidecar) && send) {
    const prev = JSON.parse(readFileSync(sidecar, 'utf8'))
    throw new Error(`already pushed — draft ${prev.id} (${prev.url}). Delete ${sidecar} to re-push.`)
  }

  if (!send) {
    console.log('\n[dry-run] no API call. Re-run with --send to create the Typefully draft.')
    return
  }

  const { key, socialSet } = auth()
  console.log('\n[post] uploading media + creating draft...')
  const xPosts = await uploadAll(parsed.xPosts, key, socialSet)
  const liPosts = parsed.linkedin ? await uploadAll([parsed.linkedin], key, socialSet) : []

  const payload = {
    platforms: {
      x: { enabled: true, posts: xPosts, settings: {} },
      ...(liPosts.length ? { linkedin: { enabled: true, posts: liPosts, settings: {} } } : {}),
    },
    draft_title: `London Calling — week of ${slug}`,
    ...(publishAt ? { publish_at: publishAt } : {}),
  }

  const res = await fetch(`${API}/social-sets/${socialSet}/drafts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`drafts.create: ${res.status} ${await res.text()}`)
  const draft = (await res.json()) as { id: string; status: string; share_url?: string }

  writeFileSync(
    sidecar,
    JSON.stringify({ id: draft.id, status: draft.status, url: draft.share_url ?? null, pushed_at: slug }, null, 2)
  )
  console.log(
    `\n✓ draft ${draft.id} (${draft.status})${draft.share_url ? ` → ${draft.share_url}` : ''}\n  review + schedule in Typefully. (saved ${sidecar})`
  )
}

main().catch((err) => {
  console.error(`\n✗ ${err.message}`)
  process.exit(1)
})
