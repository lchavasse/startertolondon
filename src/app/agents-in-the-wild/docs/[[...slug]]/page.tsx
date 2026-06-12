import { readFile } from 'fs/promises'
import path from 'path'
import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { marked } from 'marked'

type DocKey = '' | 'quickstart' | 'hardware' | 'neutts'

const DOCS: Record<DocKey, { file: string; title: string; nav: string; blurb: string }> = {
  '': {
    file: 'rules.md',
    title: 'Rules & Prizes — Agents in the Wild',
    nav: 'rules & prizes',
    blurb: 'The rules of the sprint, how to submit, how judging works, and the prize tracks.',
  },
  quickstart: {
    file: 'hackathon.md',
    title: 'Quickstart — Edge AI on a Raspberry Pi',
    nav: 'quickstart',
    blurb: 'Go from a blank SD card to running speech, language and vision models on a Pi.',
  },
  hardware: {
    file: 'hardware.md',
    title: 'Hardware Reference — sensors, servos & audio',
    nav: 'hardware',
    blurb: 'Wiring, code and specs for every part in the kit.',
  },
  neutts: {
    file: 'neutts.md',
    title: 'NeuTTS — advanced text-to-speech',
    nav: 'text-to-speech',
    blurb: 'Streaming, voice cloning and fine-tuning.',
  },
}

const BASE = '/agents-in-the-wild/docs'
const ORDER: DocKey[] = ['', 'quickstart', 'hardware', 'neutts']

function keyFromSlug(slug?: string[]): DocKey | null {
  if (!slug || slug.length === 0) return ''
  if (slug.length === 1 && (slug[0] === 'quickstart' || slug[0] === 'hardware' || slug[0] === 'neutts'))
    return slug[0]
  return null
}

export function generateStaticParams() {
  return [{ slug: [] as string[] }, { slug: ['quickstart'] }, { slug: ['hardware'] }, { slug: ['neutts'] }]
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>
}): Promise<Metadata> {
  const { slug } = await params
  const key = keyFromSlug(slug)
  if (key === null) return {}
  return { title: DOCS[key].title, description: DOCS[key].blurb }
}

// the source markdown links between guides by filename — point those at the routes
function rewriteLinks(md: string): string {
  return md
    .replace(/\]\(HARDWARE_DETAILED\.md\)/g, `](${BASE}/hardware)`)
    .replace(/\]\(NEUTTS_DETAILED\.md\)/g, `](${BASE}/neutts)`)
    .replace(/\]\(HACKATHON_PI_GUIDE\.md\)/g, `](${BASE}/quickstart)`)
    .replace(/\]\(RULES\.md\)/g, `](${BASE})`)
}

export default async function DocsPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params
  const key = keyFromSlug(slug)
  if (key === null) notFound()

  const raw = await readFile(
    path.join(process.cwd(), 'src/content/docs', DOCS[key].file),
    'utf8'
  )
  let html = await marked.parse(rewriteLinks(raw), { gfm: true })
  // open external links in a new tab; internal doc links stay in place
  html = html.replace(/<a href="(https?:)/g, '<a target="_blank" rel="noopener noreferrer" href="$1')

  return (
    <main className="aitw-shell">
      <div className="docs-inner">
        <div className="docs-topbar">
          <span className="docs-brand">
            <Link href="/">london calling</Link>
            {' / '}
            <Link href="/agents-in-the-wild">agents in the wild</Link>
            {' / docs'}
          </span>
        </div>

        <nav className="docs-nav">
          {ORDER.map((k) => {
            const href = k === '' ? BASE : `${BASE}/${k}`
            return (
              <Link
                key={k || 'index'}
                href={href}
                className={`docs-tab${k === key ? ' docs-tab--active' : ''}`}
              >
                {DOCS[k].nav}
              </Link>
            )
          })}
        </nav>

        <article className="docs-body" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </main>
  )
}
