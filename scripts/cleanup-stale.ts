import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function run() {
  const { error: e1 } = await sb.from('communities').delete().in('slug', ['lifelabs'])
  const { error: e2 } = await sb.from('spaces').delete().in('slug', ['lifelabs'])
  console.log('communities delete:', e1 ?? 'ok')
  console.log('spaces delete:', e2 ?? 'ok')
}
run()
