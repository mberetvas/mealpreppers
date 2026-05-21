import { createClient } from '@supabase/supabase-js'
import { auditLegacyUnownedWeekTemplates } from '../server/services/planning/auditLegacyUnownedWeekTemplates'

/**
 * One-off audit runner for issue 001. Requires service-role credentials in the environment.
 * Usage: bun scripts/audit-legacy-unowned-week-templates.ts
 * Optional: MEALPREPPERS_ENV=local|staging|production (default: local)
 */
async function main(): Promise<void> {
  const environment = process.env.MEALPREPPERS_ENV ?? 'local'
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')
    process.exit(1)
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const result = await auditLegacyUnownedWeekTemplates(client)

  if (!result.ok) {
    console.error(JSON.stringify({ environment, ok: false, error: result.error }, null, 2))
    process.exit(1)
  }

  console.log(JSON.stringify({
    environment,
    ok: true,
    count: result.value.count,
    sampleIds: result.value.sampleIds,
    auditedAt: new Date().toISOString(),
  }, null, 2))
}

await main()
