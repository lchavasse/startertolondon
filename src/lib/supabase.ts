import { createClient } from '@supabase/supabase-js'
import { Database } from './database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl) throw new Error('Missing env var: NEXT_PUBLIC_SUPABASE_URL')
if (!supabaseAnonKey) throw new Error('Missing env var: NEXT_PUBLIC_SUPABASE_ANON_KEY')

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

// Convenience type aliases
export type Tables = Database['public']['Tables']
export type Space = Tables['spaces']['Row']
export type Community = Tables['communities']['Row']
export type EventSeries = Tables['event_series']['Row']
export type Programme = Tables['programmes']['Row']
export type VC = Tables['vcs']['Row']
export type Person = Tables['people']['Row']
export type Company = Tables['companies']['Row']
export type Accommodation = Tables['accommodation']['Row']
