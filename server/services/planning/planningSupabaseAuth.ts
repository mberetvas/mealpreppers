import type { H3Event } from 'h3'
import { getRequestHeader } from 'h3'
import { getSupabaseServerClient } from '../../db/supabaseClient'

/**
 * Resolves the Supabase Auth user id from `Authorization: Bearer <access_token>`, or null when missing or invalid.
 */
export async function resolveSupabaseUserIdFromBearer(event: H3Event): Promise<string | null> {
  const raw = getRequestHeader(event, 'authorization')
  if (typeof raw !== 'string') return null
  const token = raw.replace(/^\s*Bearer\s+/i, '').trim()
  if (!token) return null

  const { data, error } = await getSupabaseServerClient().auth.getUser(token)
  if (error || !data.user?.id) return null
  return data.user.id
}
