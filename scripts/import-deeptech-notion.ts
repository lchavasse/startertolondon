import { createClient } from '@supabase/supabase-js'

const NOTION_PAGE_ID = '32e5762df40e80bba2eefa09b7d32ff7'
const TARGET_PAGES = ['Sponsorship Plan', 'Founders / Companies', 'Working.', '08.07', 'Expo Form'] as const
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

type NotionBlock = {
  id: string
  type: string
  has_more?: boolean
  next_cursor?: string | null
  results?: NotionBlock[]
  child_page?: { title?: string }
  paragraph?: { rich_text?: Array<{ plain_text?: string; text?: { content?: string } }> }
  bulleted_list_item?: { rich_text?: Array<{ plain_text?: string; text?: { content?: string } }> }
  numbered_list_item?: { rich_text?: Array<{ plain_text?: string; text?: { content?: string } }> }
  to_do?: { checked?: boolean; rich_text?: Array<{ plain_text?: string; text?: { content?: string } }> }
  heading_1?: { rich_text?: Array<{ plain_text?: string; text?: { content?: string } }> }
  heading_2?: { rich_text?: Array<{ plain_text?: string; text?: { content?: string } }> }
  heading_3?: { rich_text?: Array<{ plain_text?: string; text?: { content?: string } }> }
}

function notionHeaders() {
  return {
    Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
    'Notion-Version': '2025-09-03',
    'Content-Type': 'application/json',
  }
}

function textFromRichText(rich: Array<{ plain_text?: string; text?: { content?: string } }> = []) {
  return rich.map((item) => item.plain_text ?? item.text?.content ?? '').join('').trim()
}

async function notionGet(url: string) {
  const response = await fetch(url, { headers: notionHeaders() })
  if (!response.ok) throw new Error(`Notion request failed: ${response.status} ${await response.text()}`)
  return response.json()
}

async function fetchChildren(blockId: string) {
  let url: string | null = `https://api.notion.com/v1/blocks/${blockId}/children?page_size=100`
  const results: NotionBlock[] = []
  while (url) {
    const data = (await notionGet(url)) as { results?: NotionBlock[]; has_more?: boolean; next_cursor?: string | null }
    results.push(...(data.results ?? []))
    url = data.has_more ? `https://api.notion.com/v1/blocks/${blockId}/children?page_size=100&start_cursor=${data.next_cursor}` : null
  }
  return results
}

async function usersBySlug() {
  const { data, error } = await supabase.from('crm_users').select('id, slug')
  if (error) throw error
  return new Map((data ?? []).map((row) => [row.slug, row.id]))
}

async function findEntity(entityType: string, sourceRef: string) {
  const { data, error } = await supabase
    .from('crm_source_links')
    .select('id, entity_id')
    .eq('entity_type', entityType)
    .eq('source_system', 'notion')
    .eq('source_ref', sourceRef)
    .limit(1)
  if (error) throw error
  return data?.[0] ?? null
}

async function linkSource(entityType: string, entityId: string, sourceRef: string, metadata: Record<string, unknown>) {
  const existing = await findEntity(entityType, sourceRef)
  const { error } = await supabase.from('crm_source_links').upsert({
    id: existing?.id,
    entity_type: entityType,
    entity_id: entityId,
    source_system: 'notion',
    source_ref: sourceRef,
    source_url: `https://app.notion.com/${NOTION_PAGE_ID.replace(/-/g, '')}`,
    metadata,
    last_synced_at: new Date().toISOString(),
  })
  if (error) throw error
}

function ownerForPage(users: Map<string, string>, page: string) {
  if (['Sponsorship Plan', 'Founders / Companies', '08.07'].includes(page)) return users.get('lachlan') ?? null
  return null
}

async function main() {
  const users = await usersBySlug()
  const rootChildren = await fetchChildren(NOTION_PAGE_ID)
  const childPages = new Map(rootChildren.filter((block) => block.type === 'child_page').map((block) => [block.child_page.title, block.id]))
  const counters = { tasks: 0, interactions: 0 }

  for (const page of TARGET_PAGES) {
    const pageId = childPages.get(page)
    if (!pageId) continue
    const blocks = await fetchChildren(pageId)
    let currentHeading: string | null = null

    for (let index = 0; index < blocks.length; index += 1) {
      const block = blocks[index]
      const blockType = block.type as string

      if (blockType.startsWith('heading_')) {
        currentHeading = textFromRichText(block[blockType]?.rich_text ?? [])
        continue
      }

      if (blockType === 'to_do') {
        const text = textFromRichText(block.to_do?.rich_text ?? [])
        if (!text) continue
        const sourceRef = `${page}:${index + 1}:todo`
        const existing = await findEntity('task', sourceRef)
        const { data, error } = await supabase.from('crm_tasks').upsert({
          id: existing?.entity_id,
          title: text.slice(0, 160),
          description: currentHeading ? `${page} · ${currentHeading}` : page,
          owner_user_id: ownerForPage(users, page),
          status: block.to_do?.checked ? 'done' : 'todo',
          priority: 'medium',
        }).select('*').single()
        if (error) throw error
        await linkSource('task', data.id, sourceRef, { page, heading: currentHeading, text })
        counters.tasks += 1
        continue
      }

      if (['paragraph', 'bulleted_list_item', 'numbered_list_item'].includes(blockType)) {
        const payload = block[blockType]
        const text = textFromRichText(payload?.rich_text ?? [])
        if (!text) continue
        const sourceRef = `${page}:${index + 1}:note`
        const existing = await findEntity('interaction', sourceRef)
        const query = existing?.entity_id
          ? supabase.from('crm_interactions').upsert({
              id: existing.entity_id,
              interaction_type: 'manual',
              direction: 'internal',
              summary: text.slice(0, 250),
              raw_excerpt: text,
              source_system: 'notion',
              source_external_id: sourceRef,
              source_url: `https://app.notion.com/${NOTION_PAGE_ID.replace(/-/g, '')}`,
              created_by_user_id: ownerForPage(users, page),
            }).select('*').single()
          : supabase.from('crm_interactions').insert({
              interaction_type: 'manual',
              direction: 'internal',
              summary: text.slice(0, 250),
              raw_excerpt: text,
              source_system: 'notion',
              source_external_id: sourceRef,
              source_url: `https://app.notion.com/${NOTION_PAGE_ID.replace(/-/g, '')}`,
              created_by_user_id: ownerForPage(users, page),
            }).select('*').single()
        const { data, error } = await query
        if (error) throw error
        await linkSource('interaction', data.id, sourceRef, { page, heading: currentHeading })
        counters.interactions += 1
      }
    }
  }

  console.log(JSON.stringify(counters, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
