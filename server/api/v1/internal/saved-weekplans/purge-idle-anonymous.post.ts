import { timingSafeEqual } from 'node:crypto'
import { getRequestHeader } from 'h3'
import { getSupabaseServerClient } from '../../../../db/supabaseClient'
import {
  ANONYMOUS_SAVED_WEEKPLAN_IDLE_RETENTION_DAYS,
  anonymousSavedWeekplanIdleCutoffIso,
} from '../../../../services/planning/anonymousSavedWeekplansIdlePurge'
import { purgeAnonymousIdleSavedWeekplans } from '../../../../services/planning/savedWeekplansRepository'
import { appLogger } from '../../../../utils/logger'
import { handlePlanningUnexpected, toPlanningHttpError } from '../../../../utils/planningErrors'
import { useStructuredLogger } from '../../../../utils/structuredLogger'

/** Compares purge job bearer token to configured secret using a constant-time check. */
function bearerMatchesSecret(authorizationHeader: string | undefined, secret: string): boolean {
  if (!authorizationHeader) return false
  const token = authorizationHeader.replace(/^\s*Bearer\s+/i, '').trim()
  if (!token) return false
  const a = Buffer.from(token, 'utf8')
  const b = Buffer.from(secret, 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export default defineEventHandler(async (event) => {
  const started = Date.now()
  const config = useRuntimeConfig()
  const purgeSecret = config.savedWeekplansIdlePurgeSecret as string | undefined

  if (purgeSecret === undefined || purgeSecret === '') {
    throw createError({
      statusCode: 503,
      statusMessage: 'Anonymous idle purge is not configured.',
    })
  }

  const authHeader = getRequestHeader(event, 'authorization')
  if (!bearerMatchesSecret(authHeader, purgeSecret)) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized.' })
  }

  const traceId = getRequestHeader(event, 'x-trace-id')
  const slog = useStructuredLogger(appLogger.withTag('saved-weekplans-idle-purge'), traceId)

  const now = new Date()
  const cutoffIso = anonymousSavedWeekplanIdleCutoffIso(now)

  try {
    slog.info('planning.anonymous_idle_purge_started', {
      retention_days: ANONYMOUS_SAVED_WEEKPLAN_IDLE_RETENTION_DAYS,
      idle_field: 'updated_at',
      cutoff_at: cutoffIso,
    })

    const supabase = getSupabaseServerClient()
    const result = await purgeAnonymousIdleSavedWeekplans(supabase, { now })

    if (!result.ok) {
      slog.error('planning.anonymous_idle_purge_failed', {
        failure_kind: result.error.kind,
        duration_ms: Date.now() - started,
        retention_days: ANONYMOUS_SAVED_WEEKPLAN_IDLE_RETENTION_DAYS,
        idle_field: 'updated_at',
        cutoff_at: cutoffIso,
      })
      throw createError(toPlanningHttpError(result.error))
    }

    const durationMs = Date.now() - started
    slog.info('planning.anonymous_idle_purge_completed', {
      deleted_count: result.value.deleted,
      duration_ms: durationMs,
      retention_days: ANONYMOUS_SAVED_WEEKPLAN_IDLE_RETENTION_DAYS,
      idle_field: 'updated_at',
      cutoff_at: cutoffIso,
    })

    return {
      deleted: result.value.deleted,
      retention_days: ANONYMOUS_SAVED_WEEKPLAN_IDLE_RETENTION_DAYS,
      idle_field: 'updated_at',
      cutoff_at: cutoffIso,
      duration_ms: durationMs,
    }
  }
  catch (err) {
    handlePlanningUnexpected(err, 'saved-weekplans-idle-purge', 'purge idle anonymous saved weekplans', traceId)
  }
})
