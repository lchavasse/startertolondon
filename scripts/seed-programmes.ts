import { createClient } from '@supabase/supabase-js'
import { Database } from '../src/lib/database.types'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type ProgrammeInsert = Database['public']['Tables']['programmes']['Insert']

const PROGRAMMES: ProgrammeInsert[] = [
  {
    slug: 'foundry-lab',
    name: 'Foundry Lab',
    strapline: 'UCL-affiliated AI incubator for early-stage founders',
    sectors: ['ai', 'deeptech'],
    programme_type: 'incubator',
    cost_type: 'equity',
    website: 'https://foundry-lab.xyz',
    featured: false,
  },
  {
    slug: 'encode-ai-for-science',
    name: 'Encode: AI for Science',
    strapline: 'Bootcamp programme applying AI to scientific research, backed by Pillar VC',
    sectors: ['ai', 'science'],
    programme_type: 'bootcamp',
    cost_type: 'free',
    website: 'https://www.encodeclub.com',
    featured: false,
  },
  {
    slug: '5050',
    name: '5050',
    strapline: 'Equity-free incubator for scientists becoming founders, run by 50 Years twice a year',
    sectors: ['deeptech', 'climate', 'science'],
    programme_type: 'incubator',
    cost_type: 'free',
    cohort_size: 20,
    website: 'https://www.50years.vc',
    featured: false,
  },
]

async function seed() {
  console.log(`Seeding ${PROGRAMMES.length} programmes...`)

  const { data, error } = await supabase
    .from('programmes')
    .upsert(PROGRAMMES, { onConflict: 'slug' })
    .select('id, name')

  if (error) {
    console.error('Error seeding programmes:', error)
    process.exit(1)
  }

  console.log(`✓ Seeded ${data?.length} programmes`)
  data?.forEach((p) => console.log(`  - ${p.name}`))
}

seed()
