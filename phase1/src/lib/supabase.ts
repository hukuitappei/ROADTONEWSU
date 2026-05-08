import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export const hasSupabaseEnv = () => Boolean(url && anonKey && serviceRoleKey)

export const createSupabaseAnonClient = () => {
  if (!url || !anonKey) {
    throw new Error('missing_supabase_anon_env')
  }

  return createClient(url, anonKey)
}

export const createSupabaseServiceClient = () => {
  if (!url || !serviceRoleKey) {
    throw new Error('missing_supabase_service_env')
  }

  return createClient(url, serviceRoleKey)
}
