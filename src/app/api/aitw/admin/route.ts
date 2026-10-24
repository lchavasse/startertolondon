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

function mean(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0
}

function popStddev(nums: number[], avg: number): number {
  return nums.length ? Math.sqrt(mean(nums.map((n) => (n - avg) ** 2))) : 0
}

// Aggregate every judge's scorecard into a per-project leaderboard plus a
// per-judge progress summary. Only active (non-archived) projects are ranked.
//
// Judges calibrate differently — some score everything in a narrow band,
// others swing from 10 to 95. A raw average lets the wide-swinging judge
// dominate the ranking, so each judge's fully-scored criterion values are
// z-scored against their own mean/stddev and rescaled onto the pooled
// (all-judges) distribution before being folded into the leaderboard.
// Judges' own scorecards (returned per-judge below) stay raw — normalization
// only affects the aggregate leaderboard.
function tallyJudging(
  judgeRecords: JudgeRecord[],
  activeProjectIds: string[]
) {
  const activeSet = new Set(activeProjectIds)

  // Pass 1: collect each judge's fully-scored values per criterion, plus the
  // pooled values across all judges, to compute calibration stats.
  const perJudgeValues = new Map<string, Record<string, number[]>>()
  const globalValues: Record<string, number[]> = {}
  for (const key of CRITERION_KEYS) globalValues[key] = []

  for (const rec of judgeRecords) {
    const byCriterion: Record<string, number[]> = {}
    for (const key of CRITERION_KEYS) byCriterion[key] = []
    for (const id of activeProjectIds) {
      const row = rec.scores[id]
      if (!row) continue
      if (!CRITERION_KEYS.every((k) => typeof row[k] === 'number')) continue // skip partial
      for (const key of CRITERION_KEYS) {
        byCriterion[key].push(row[key])
        globalValues[key].push(row[key])
      }
    }
    perJudgeValues.set(rec.slug, byCriterion)
  }

  const globalStats: Record<string, { mean: number; stddev: number }> = {}
  for (const key of CRITERION_KEYS) {
    const avg = mean(globalValues[key])
    globalStats[key] = { mean: avg, stddev: popStddev(globalValues[key], avg) }
  }

  const judgeStats = new Map<string, Record<string, { mean: number; stddev: number }>>()
  for (const [slug, byCriterion] of perJudgeValues) {
    const stats: Record<string, { mean: number; stddev: number }> = {}
    for (const key of CRITERION_KEYS) {
      const avg = mean(byCriterion[key])
      stats[key] = { mean: avg, stddev: popStddev(byCriterion[key], avg) }
    }
    judgeStats.set(slug, stats)
  }

  // Rescale a judge's raw value for one criterion onto the pooled scale.
  // Falls back to the pooled mean when there's no spread to calibrate
  // against (a single data point, or a judge who gave the same score every
  // time) rather than dividing by zero.
  function normalize(slug: string, key: string, raw: number): number {
    const js = judgeStats.get(slug)![key]
    const gs = globalStats[key]
    if (js.stddev === 0 || gs.stddev === 0) return gs.mean
    return gs.mean + ((raw - js.mean) / js.stddev) * gs.stddev
  }

  // Per-project accumulators: per-criterion totals + per-judge totals, both
  // built from normalized values.
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
    let done = 0 // projects fully scored (all 4 criteria)
    // Per-project scorecard, active projects only. Partial cards are ignored
    // entirely — a project counts only once every criterion has a score.
    // Raw values, as entered by the judge (not normalized).
    const scores: Record<string, { criteria: Record<string, number>; total: number }> = {}
    for (const id of activeProjectIds) {
      const row = rec.scores[id]
      if (!row) continue
      if (!CRITERION_KEYS.every((k) => typeof row[k] === 'number')) continue // skip partial
      const slot = board.get(id)!
      let judgeTotal = 0
      let normalizedTotal = 0
      const criteria: Record<string, number> = {}
      for (const k of CRITERION_KEYS) {
        const v = row[k]
        criteria[k] = v
        judgeTotal += v
        const normalized = normalize(rec.slug, k, v)
        slot.criteria[k].sum += normalized
        slot.criteria[k].count += 1
        normalizedTotal += normalized
      }
      scores[id] = { criteria, total: judgeTotal }
      slot.judgeTotals.push(normalizedTotal)
      done += 1
    }
    return { name: rec.name, slug: rec.slug, done, scores }
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
    judges: judges.sort((a, b) => b.done - a.done),
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
