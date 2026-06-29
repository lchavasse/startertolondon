import { NextRequest, NextResponse } from 'next/server'
import { getAitwClient } from '@/lib/aitw'
import { getAitwArchived, getJudgeScores, saveJudgeScore } from '@/lib/kv'
import { CRITERION_KEYS, MAX_SCORE, judgeSlug } from '@/lib/aitw-judging'

// Judges sign in with the shared admin secret (same key as /admin).
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET
  return Boolean(secret) && req.headers.get('x-judge-key') === secret
}

// The active (non-archived) projects judges score, in display order.
async function getActiveProjects() {
  const supabase = getAitwClient()
  const [{ data, error }, archived] = await Promise.all([
    supabase
      .from('aitw_projects')
      .select('id, name, description, submission_url, submitted_at')
      .order('created_at'),
    getAitwArchived(),
  ])
  if (error) throw error
  const archivedSet = new Set(archived)
  return (data ?? [])
    .filter((p) => !archivedSet.has(p.id))
    .map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      submissionUrl: p.submission_url,
      submitted: p.submitted_at != null,
    }))
}

// Login / load: returns the active projects plus this judge's saved scores.
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const name = (req.nextUrl.searchParams.get('name') ?? '').trim()
  const slug = judgeSlug(name)
  if (!slug) return NextResponse.json({ error: 'missing_name' }, { status: 400 })

  try {
    const [projects, scores] = await Promise.all([getActiveProjects(), getJudgeScores(slug)])
    return NextResponse.json({ judge: name, projects, scores })
  } catch (err) {
    console.error('aitw/judge load failed', err)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}

// Save one score. score must be an integer 0..25; clearing sends 0.
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const slug = judgeSlug(name)
  const projectId = typeof body.projectId === 'string' ? body.projectId : ''
  const criterion = typeof body.criterion === 'string' ? body.criterion : ''
  const score = body.score

  if (!slug) return NextResponse.json({ error: 'missing_name' }, { status: 400 })
  if (!projectId) return NextResponse.json({ error: 'missing_project' }, { status: 400 })
  if (!CRITERION_KEYS.includes(criterion)) {
    return NextResponse.json({ error: 'bad_criterion' }, { status: 400 })
  }
  if (!Number.isInteger(score) || score < 0 || score > MAX_SCORE) {
    return NextResponse.json({ error: 'bad_score' }, { status: 400 })
  }

  try {
    await saveJudgeScore(slug, name, projectId, criterion, score)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('aitw/judge save failed', err)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
