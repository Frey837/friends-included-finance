import { createClient } from '@supabase/supabase-js'

let client

export function getSupabaseAdmin() {
  if (client) return client
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
  }
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
  return client
}

export async function rpc(name, args) {
  const { data, error } = await getSupabaseAdmin().rpc(name, args)
  if (error) {
    const err = new Error(error.message)
    err.code = error.code
    throw err
  }
  return data
}
