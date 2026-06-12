import { createClient } from '@supabase/supabase-js'
import { Database, Tables } from './database.types'

// End of Sunday 28 Jun, London time (BST). Submissions after this are "late".
export const SUBMISSION_DEADLINE = new Date('2026-06-28T23:59:59+01:00')

export type AitwBuilder = Tables<'aitw_builders'>
export type AitwProject = Tables<'aitw_projects'>

// Shapes returned to the browser — emails/phones only ever for the caller themself.
export type MemberView = { id: string; name: string }
export type ProjectView = {
  id: string
  name: string
  description: string | null
  submissionUrl: string | null
  submittedAt: string | null
  late: boolean
  members: MemberView[]
}
export type BuilderView = { id: string; name: string; email: string; phone: string | null }

export function getAitwClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const email = raw.trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null
}

export async function getBuilderByEmail(
  supabase: ReturnType<typeof getAitwClient>,
  email: string
): Promise<AitwBuilder | null> {
  const { data, error } = await supabase
    .from('aitw_builders')
    .select('*')
    .eq('email', email)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function getProjectView(
  supabase: ReturnType<typeof getAitwClient>,
  projectId: string
): Promise<ProjectView | null> {
  const [{ data: project, error }, { data: members, error: membersError }] = await Promise.all([
    supabase.from('aitw_projects').select('*').eq('id', projectId).maybeSingle(),
    supabase.from('aitw_builders').select('id, name').eq('project_id', projectId).order('created_at'),
  ])
  if (error) throw error
  if (membersError) throw membersError
  if (!project) return null
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    submissionUrl: project.submission_url,
    submittedAt: project.submitted_at,
    late: project.submitted_at != null && new Date(project.submitted_at) > SUBMISSION_DEADLINE,
    members: members ?? [],
  }
}

export function builderView(b: AitwBuilder): BuilderView {
  return { id: b.id, name: b.name, email: b.email, phone: b.phone }
}

// identify response: the caller + their project (or null)
export async function identityPayload(
  supabase: ReturnType<typeof getAitwClient>,
  builder: AitwBuilder
) {
  const project = builder.project_id ? await getProjectView(supabase, builder.project_id) : null
  return { builder: builderView(builder), project }
}
