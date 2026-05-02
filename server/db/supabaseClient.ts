import { createClient } from '@supabase/supabase-js'

export function getSupabaseServerClient(): ReturnType<typeof createClient> {
  const config = useRuntimeConfig()
  const supabaseUrl = config.supabaseUrl
  const serviceRoleKey = config.supabaseServiceRoleKey

  if (!supabaseUrl || !serviceRoleKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Supabase server credentials are not configured.',
    })
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}