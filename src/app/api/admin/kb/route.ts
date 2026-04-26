import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/lib/database.types'
import { KBEntityType } from '@/lib/kb'

if (!process.env.ADMIN_SECRET) {
  console.warn('ADMIN_SECRET is not set — admin KB API will reject all requests')
}

function isAuthorized(req: NextRequest): boolean {
  return req.headers.get('x-admin-key') === process.env.ADMIN_SECRET
}

function getServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const ALLOWED_TABLES = {
  space: 'spaces',
  community: 'communities',
  vc: 'vcs',
  programme: 'programmes',
} as const satisfies Record<KBEntityType, string>

type EntityType = keyof typeof ALLOWED_TABLES

const ALLOWED_FIELDS = new Set([
  'name', 'strapline', 'description', 'website', 'cover_image',
  'area', 'primary_area', 'tags', 'sectors', 'crowd_tags',
])

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { entityType, id, fields } = body

  if (typeof entityType !== 'string' || !(entityType in ALLOWED_TABLES)) {
    return NextResponse.json({ error: 'Invalid entityType' }, { status: 400 })
  }

  if (typeof id !== 'string' || !id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
    return NextResponse.json({ error: 'fields required' }, { status: 400 })
  }

  // Strip any fields that aren't on the allowlist
  const safeFields: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(fields as Record<string, unknown>)) {
    if (ALLOWED_FIELDS.has(key)) {
      safeFields[key] = value
    }
  }

  if (Object.keys(safeFields).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const table = ALLOWED_TABLES[entityType as EntityType]
  const supabase = getServiceClient()

  const { error } = await supabase
    .from(table)
    .update(safeFields)
    .eq('id', id)

  if (error) {
    console.error('KB update error:', error.message)
    return NextResponse.json({ error: 'Update failed.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
