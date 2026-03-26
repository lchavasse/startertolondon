import { createClient } from '@supabase/supabase-js'
import { Database } from '../src/lib/database.types'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type PersonInsert = Database['public']['Tables']['people']['Insert']

const PEOPLE: PersonInsert[] = [
  {
    slug: 'riam',
    name: 'Riam',
    role: 'Conception X',
    tags: ['deeptech', 'science'],
    featured: false,
  },
  {
    slug: 'carry',
    name: 'Carry',
    role: 'Conception X',
    tags: ['deeptech', 'science'],
    featured: false,
  },
  {
    slug: 'steph',
    name: 'Steph',
    role: '50 Years',
    tags: ['deeptech', 'science', 'climate'],
    featured: false,
  },
  {
    slug: 'ofer',
    name: 'Ofer',
    role: 'Ignite London',
    tags: ['ai', 'deeptech'],
    featured: false,
  },
  {
    slug: 'leone',
    name: 'Leone',
    role: 'Encode: AI for Science',
    tags: ['ai', 'science'],
    featured: false,
  },
  {
    slug: 'leah',
    name: 'Leah',
    role: 'Encode: AI for Science',
    tags: ['ai', 'science'],
    featured: false,
  },
  {
    slug: 'federico',
    name: 'Federico',
    role: 'Nucleate UK',
    tags: ['science', 'deeptech'],
    featured: false,
  },
  {
    slug: 'digby',
    name: 'Digby',
    role: 'LifeLabs',
    tags: ['science'],
    featured: false,
  },
  {
    slug: 'yen',
    name: 'Yen',
    role: 'Prosemino',
    tags: ['climate', 'science'],
    featured: false,
  },
  {
    slug: 'erv',
    name: 'ERV',
    role: 'Prosemino',
    tags: ['climate', 'science'],
    featured: false,
  },
  {
    slug: 'fab',
    name: 'Fab',
    role: 'Wilbe',
    tags: ['science', 'deeptech'],
    featured: false,
  },
  {
    slug: 'subaita',
    name: 'Subaita',
    role: 'Wilbe',
    tags: ['science', 'deeptech'],
    featured: false,
  },
  {
    slug: 'ale',
    name: 'Ale',
    role: 'Wilbe',
    tags: ['science', 'deeptech'],
    featured: false,
  },
  {
    slug: 'micah',
    name: 'Micah',
    role: 'Telos House',
    tags: ['founders'],
    featured: false,
  },
  {
    slug: 'maitham',
    name: 'Maitham',
    role: 'Telos House',
    tags: ['founders'],
    featured: false,
  },
]

async function seed() {
  console.log(`Seeding ${PEOPLE.length} people...`)

  const { data, error } = await supabase
    .from('people')
    .upsert(PEOPLE, { onConflict: 'slug' })
    .select('id, name')

  if (error) {
    console.error('Error seeding people:', error)
    process.exit(1)
  }

  console.log(`✓ Seeded ${data?.length} people`)
  data?.forEach((p) => console.log(`  - ${p.name}`))
}

seed()
