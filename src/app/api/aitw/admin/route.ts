import { NextRequest, NextResponse } from 'next/server'
import { getAitwClient, SUBMISSION_DEADLINE } from '@/lib/aitw'

function isAuthorized(req: NextRequest): boolean {
  return req.headers.get('x-admin-key') === process.env.ADMIN_SECRET
}

// Read-only roster of every team, its members (with contact details) and
// submission status. Admin-only — members' emails/phones are exposed here.
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = getAitwClient()
    const [{ data: projects, error }, { data: solo, error: soloError }] = await Promise.all([
      supabase
        .from('aitw_projects')
        .select(
          'id, name, description, submission_url, submitted_at, created_at, aitw_builders(id, name, email, phone)'
        )
        .order('created_at'),
      supabase
        .from('aitw_builders')
        .select('id, name, email, phone')
        .is('project_id', null)
        .order('created_at'),
    ])
    if (error) throw error
    if (soloError) throw soloError

    return NextResponse.json({
      projects: (projects ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        submissionUrl: p.submission_url,
        submittedAt: p.submitted_at,
        late: p.submitted_at != null && new Date(p.submitted_at) > SUBMISSION_DEADLINE,
        createdAt: p.created_at,
        members: (p.aitw_builders ?? []).map((b) => ({
          id: b.id,
          name: b.name,
          email: b.email,
          phone: b.phone,
        })),
      })),
      solo: (solo ?? []).map((b) => ({ id: b.id, name: b.name, email: b.email, phone: b.phone })),
      deadline: SUBMISSION_DEADLINE.toISOString(),
    })
  } catch (err) {
    console.error('aitw/admin failed', err)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
