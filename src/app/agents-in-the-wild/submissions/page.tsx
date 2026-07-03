import Link from 'next/link'
import type { Metadata } from 'next'
import { getAitwClient } from '@/lib/aitw'
import { getAitwArchived } from '@/lib/kv'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Submissions — Agents in the Wild',
  description: 'Every project submitted to Agents in the Wild.',
}

type Submission = { id: string; name: string; description: string | null; submissionUrl: string }

// Deterministic pseudo-random order (hash of id) — looks shuffled but is
// stable across requests instead of reordering on every load.
function hash(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (Math.imul(h, 31) + str.charCodeAt(i)) | 0
  return h
}

function shuffle<T extends { id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => hash(a.id) - hash(b.id))
}

async function getSubmissions(): Promise<Submission[]> {
  const supabase = getAitwClient()
  const [{ data: projects, error }, archived] = await Promise.all([
    supabase
      .from('aitw_projects')
      .select('id, name, description, submission_url')
      .not('submission_url', 'is', null),
    getAitwArchived(),
  ])
  if (error) throw error

  const archivedSet = new Set(archived)
  const submitted = (projects ?? []).filter(
    (p) => !archivedSet.has(p.id) && p.submission_url
  ) as { id: string; name: string; description: string | null; submission_url: string }[]

  return shuffle(
    submitted.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      submissionUrl: p.submission_url,
    }))
  )
}

export default async function AitwSubmissionsPage() {
  const submissions = await getSubmissions()

  return (
    <main className="aitw-shell">
      <div className="docs-inner">
        <div className="docs-topbar">
          <span className="docs-brand">
            <Link href="/">london calling</Link>
            {' / '}
            <Link href="/agents-in-the-wild">agents in the wild</Link>
            {' / submissions'}
          </span>
        </div>

        <section className="aitw-team">
          <p className="aitw-eyebrow">agents in the wild</p>
          <h1 className="aitw-section__title">Submissions</h1>
          <p className="aitw-team__lead">
            Every project submitted to the sprint, in no particular order.
          </p>

          {submissions.length === 0 ? (
            <p className="aitw-team__hint">No submissions yet.</p>
          ) : (
            submissions.map((s) => (
              <div className="aitw-team__panel" key={s.id}>
                <h2 className="aitw-section__title">{s.name}</h2>
                {s.description && <p className="aitw-team__lead">{s.description}</p>}
                <p className="aitw-team__hint">
                  <a
                    className="aitw-team__link"
                    href={s.submissionUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    open submission →
                  </a>
                </p>
              </div>
            ))
          )}
        </section>
      </div>
    </main>
  )
}
