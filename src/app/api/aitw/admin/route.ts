import { NextRequest, NextResponse } from 'next/server'
import { getAitwClient, SUBMISSION_DEADLINE } from '@/lib/aitw'
import {
  getAitwArchived,
  addAitwArchived,
  removeAitwArchived,
  getAllJudgeScores,
  type JudgeRecord,
} from '@/lib/kv'
import { CRITERION_KEYS, JUDGING_CRITERIA } from '@/lib/aitw-judging'

// Aggregate every judge's scorecard into a per-project leaderboard plus a
// per-judge progress summary. Only active (non-archived) projects are ranked.
function tallyJudging(
  judgeRecords: JudgeRecord[],
  activeProjectIds: string[]
) {
  const activeSet = new Set(activeProjectIds)

  // Per-project accumulators: per-criterion totals + per-judge totals.
  const board = new Map<
    string,
    { criteria: Record<string, { sum: number; count: number }>; judgeTotals: number[] }
  >()
  for (const id of activeProjectIds) {
    const criteria: Record<string, { sum: number; count: number }> = {}
    for (const key of CRITERION_KEYS) criteria[key] = { sum: 0, count: 0 }
    board.set(id, { criteria, judgeTotals: [] })
  }

  const judges = judgeRecords.map((rec) => {
    let completed = 0 // projects with all 4 criteria scored
    let partial = 0 // projects with some but not all
    for (const id of activeProjectIds) {
      const row = rec.scores[id]
      if (!row) continue
      const present = CRITERION_KEYS.filter((k) => typeof row[k] === 'number')
      if (present.length === 0) continue
      const slot = board.get(id)!
      let judgeTotal = 0
      for (const k of present) {
        slot.criteria[k].sum += row[k]
        slot.criteria[k].count += 1
        judgeTotal += row[k]
      }
      slot.judgeTotals.push(judgeTotal)
      if (present.length === CRITERION_KEYS.length) completed += 1
      else partial += 1
    }
    return { name: rec.name, slug: rec.slug, completed, partial }
  })

  const leaderboard = activeProjectIds
    .map((id) => {
      const slot = board.get(id)!
      const judgeCount = slot.judgeTotals.length
      const avgTotal = judgeCount
        ? slot.judgeTotals.reduce((a, b) => a + b, 0) / judgeCount
        : 0
      const criteria: Record<string, number | null> = {}
      for (const key of CRITERION_KEYS) {
        const c = slot.criteria[key]
        criteria[key] = c.count ? c.sum / c.count : null
      }
      return { projectId: id, judgeCount, avgTotal, criteria }
    })
    .filter((row) => activeSet.has(row.projectId))
    .sort((a, b) => b.avgTotal - a.avgTotal)

  return {
    criteria: JUDGING_CRITERIA.map((c) => ({ key: c.key, label: c.label })),
    judges: judges.sort((a, b) => b.completed - a.completed),
    leaderboard,
  }
}

function isAuthorized(req: NextRequest): boolean {
  return req.headers.get('x-admin-key') === process.env.ADMIN_SECRET
}

// Read-only roster of every team, its members and submission status.
// Names only — contact details are deliberately not sent to the browser.
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = getAitwClient()
    const [{ data: projects, error }, { data: solo, error: soloError }, archived, judgeRecords] =
      await Promise.all([
        supabase
          .from('aitw_projects')
          .select(
            'id, name, description, submission_url, submitted_at, created_at, aitw_builders(id, name)'
          )
          .order('created_at'),
        supabase
          .from('aitw_builders')
          .select('id, name')
          .is('project_id', null)
          .order('created_at'),
        getAitwArchived(),
        getAllJudgeScores(),
      ])
    if (error) throw error
    if (soloError) throw soloError

    const archivedSet = new Set(archived)
    const activeIds = (projects ?? []).filter((p) => !archivedSet.has(p.id)).map((p) => p.id)
    return NextResponse.json({
      judging: tallyJudging(judgeRecords, activeIds),
      projects: (projects ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        submissionUrl: p.submission_url,
        submittedAt: p.submitted_at,
        late: p.submitted_at != null && new Date(p.submitted_at) > SUBMISSION_DEADLINE,
        createdAt: p.created_at,
        archived: archivedSet.has(p.id),
        members: (p.aitw_builders ?? []).map((b) => ({ id: b.id, name: b.name })),
      })),
      solo: (solo ?? []).map((b) => ({ id: b.id, name: b.name })),
      deadline: SUBMISSION_DEADLINE.toISOString(),
    })
  } catch (err) {
    console.error('aitw/admin failed', err)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}

// Admin actions on a single project:
//   archive   — soft hide from the roster (reversible, KV-only)
//   unarchive — restore
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const action = body.action
  const projectId = typeof body.projectId === 'string' ? body.projectId : ''
  if (!projectId) return NextResponse.json({ error: 'missing_project' }, { status: 400 })

  try {
    if (action === 'archive') {
      await addAitwArchived(projectId)
      return NextResponse.json({ ok: true })
    }
    if (action === 'unarchive') {
      await removeAitwArchived(projectId)
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: 'unknown_action' }, { status: 400 })
  } catch (err) {
    console.error('aitw/admin action failed', err)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
