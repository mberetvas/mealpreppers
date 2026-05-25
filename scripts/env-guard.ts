/** Allowlisted values for MEALPREPPERS_ENV that skip confirmation. */
const ALLOWED_ENVIRONMENTS = ['local'] as const

export type EnvGuardResult =
  | { allowed: true; environment: string }
  | { allowed: false; reason: 'unset' | 'non-local'; environment?: string; message: string }

/**
 * Validates MEALPREPPERS_ENV is set and allowlisted before running ops scripts.
 * Returns a discriminated result indicating whether execution should proceed.
 */
export function checkEnvironmentGuard(env: string | undefined): EnvGuardResult {
  if (env === undefined || env === '') {
    return {
      allowed: false,
      reason: 'unset',
      message:
        'ERROR: MEALPREPPERS_ENV is not set. Set MEALPREPPERS_ENV=local to run against the local database. Aborting.',
    }
  }

  if (!ALLOWED_ENVIRONMENTS.includes(env as (typeof ALLOWED_ENVIRONMENTS)[number])) {
    return {
      allowed: false,
      reason: 'non-local',
      environment: env,
      message:
        `WARNING: MEALPREPPERS_ENV="${env}" — this targets a NON-LOCAL environment. Aborting to prevent accidental production queries.`,
    }
  }

  return { allowed: true, environment: env }
}
