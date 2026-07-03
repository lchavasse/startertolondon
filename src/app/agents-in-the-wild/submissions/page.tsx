import Link from 'next/link'
import type { Metadata } from 'next'
import { getAitwClient } from '@/lib/aitw'
import { getAitwArchived, getAllJudgeScores } from '@/lib/kv'
import { CRITERION_KEYS } from '@/lib/aitw-judging'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Submissions — Agents in the Wild',
  description: 'Every project submitted to Agents in the Wild.',
}

const FINALIST_COUNT = 5

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

// Raw (unnormalized) average total score per project, judges-that-fully-
// scored-it only — mirrors the admin leaderboard's base ranking.
async function getFinalistIds(projectIds: string[]): Promise<Set<string>> {
  const judgeRecords = await getAllJudgeScores()
  const totals = new Map<string, number[]>()
  for (const id of projectIds) totals.set(id, [])

  for (const rec of judgeRecords) {
    for (const id of projectIds) {
      const row = rec.scores[id]
      if (!row) continue
      if (!CRITERION_KEYS.every((k) => typeof row[k] === 'number')) continue // skip partial
      totals.get(id)!.push(CRITERION_KEYS.reduce((sum, k) => sum + row[k], 0))
    }
  }

  const ranked = projectIds
    .map((id) => {
      const scores = totals.get(id)!
      return { id, avg: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0, judged: scores.length > 0 }
    })
    .filter((r) => r.judged)
    .sort((a, b) => b.avg - a.avg)
    .slice(0, FINALIST_COUNT)

  return new Set(ranked.map((r) => r.id))
}

async function getSubmissions(): Promise<{ finalists: Submission[]; commended: Submission[] }> {
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

  const finalistIds = await getFinalistIds(submitted.map((p) => p.id))

  const all: Submission[] = submitted.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    submissionUrl: p.submission_url,
  }))

  return {
    finalists: shuffle(all.filter((s) => finalistIds.has(s.id))),
    commended: shuffle(all.filter((s) => !finalistIds.has(s.id))),
  }
}

function SubmissionCard({ s, finalist }: { s: Submission; finalist: boolean }) {
  return (
    <div
      className={`aitw-team__panel${finalist ? ' aitw-team__panel--finalist' : ''}`}
      key={s.id}
    >
      <h2 className="aitw-section__title">
        {s.name}
        {finalist && <span className="aitw-team__badge">finalist</span>}
      </h2>
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
  )
}

export default async function AitwSubmissionsPage() {
  const { finalists, commended } = await getSubmissions()

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

          {finalists.length === 0 && commended.length === 0 ? (
            <p className="aitw-team__hint">No submissions yet.</p>
          ) : (
            <>
              <p className="aitw-team__lead">Presenting live at Demo Night.</p>
              {finalists.map((s) => (
                <SubmissionCard key={s.id} s={s} finalist />
              ))}

              {commended.length > 0 && (
                <>
                  <p className="aitw-eyebrow">special commendation</p>
                  {commended.map((s) => (
                    <SubmissionCard key={s.id} s={s} finalist={false} />
                  ))}
                </>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  )
}
