import { fetchGuideItems } from '@/lib/kb'
import { GuidePageClient } from '@/components/GuidePageClient'

export const dynamic = 'force-dynamic'

export default async function GuidePage() {
  const items = await fetchGuideItems()
  return <GuidePageClient items={items} />
}
