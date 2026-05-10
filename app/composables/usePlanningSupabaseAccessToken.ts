/**
 * Supabase (or compatible) access token for authenticated Saved Weekplans API calls.
 * Set from your auth layer when the session becomes available (e.g. after SIGNED_IN); clear on sign-out.
 */
export function usePlanningSupabaseAccessToken() {
  return useState<string | null>('planningSupabaseAccessToken', () => null)
}
