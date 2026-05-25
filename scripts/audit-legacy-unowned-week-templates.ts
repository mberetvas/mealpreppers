import { createClient } from '@supabase/supabase-js'
import { auditLegacyUnownedWeekTemplates } from '../server/services/planning/auditLegacyUnownedWeekTemplates'
import { checkEnvironmentGuard } from './env-guard'

/**
 * One-off audit runner for issue 001. Requires service-role credentials in the environment.
 * Usage: MEALPREPPERS_ENV=local bun scripts/audit-legacy-unowned-week-templates.ts
 */
async function main(): Promise<void> {
  const guard = checkEnvironmentGuard(process.env.MEALPREPPERS_ENV)
  if (!guard.allowed) {
    console.error(guard.message)
    process.exit(1)
  }

  const environment = guard.environment
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
