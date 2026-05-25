import { z } from 'zod'
import type { WeekPlanV1 } from '../types/planning'
import { weekPlanV1Schema } from '../types/planning'
import { countAssignedRecipes } from './weekPlan'

/**
 * Local draft recovery helpers (unsaved `persistenceKind === 'none'` week before first POST).
 *
 * Limits: uses tab-scoped `sessionStorage` (lost when the tab closes); subject to browser quota
 * and private-mode restrictions; not a substitute for server save or cross-device sync.
 */
export const PLANNER_WEEK_DRAFT_SNAPSHOT_STORAGE_KEY = 'mealprepper:planner-week-draft-v1'

/** How the week tab is backed (`none` = no linked row yet — unsaved saved-weekplan draft). */
export type PlannerDraftPersistenceKind = 'none' | 'saved-weekplan'

/** Versioned payload for local draft recovery (refresh before first server save). */
export type PlannerWeekDraftSnapshotV1 = {
  v: 1
  weekPlan: WeekPlanV1
  weekPlanTitle: string
  updatedAt: string
}

const plannerWeekDraftSnapshotV1Schema = z.object({
  v: z.literal(1),
  weekPlan: weekPlanV1Schema,
  weekPlanTitle: z.string(),
  updatedAt: z.string(),
})

/** True when the title is non-empty (trimmed) or at least one recipe slot is filled. */
export function plannerDraftHasMeaningfulEdits(week: WeekPlanV1, title: string): boolean {
  if (title.trim().length > 0) {
    return true
  }
  return countAssignedRecipes(week) > 0
}

/** True when leaving the planner could lose an unsaved Saved Weekplan draft. */
export function plannerUnsavedSavedWeekplanDraftNeedsGuard(
  persistenceKind: PlannerDraftPersistenceKind,
  week: WeekPlanV1,
  title: string,
): boolean {
  return persistenceKind === 'none' && plannerDraftHasMeaningfulEdits(week, title)
}

/** Serializes a v1 snapshot for `sessionStorage` / tests. */
export function serializePlannerWeekDraftSnapshot(snapshot: PlannerWeekDraftSnapshotV1): string {
  return JSON.stringify(snapshot)
}

/** Parses and validates a snapshot string; fails closed on bad data. */
export function parsePlannerWeekDraftSnapshot(raw: string): { ok: true, value: PlannerWeekDraftSnapshotV1 } | { ok: false } {
  try {
    const parsed = plannerWeekDraftSnapshotV1Schema.safeParse(JSON.parse(raw))
    if (!parsed.success) {
      return { ok: false }
    }
    return { ok: true, value: parsed.data }
  }
  catch {
    return { ok: false }
  }
}

/** Reads and parses a snapshot from storage (`null` if missing or invalid). */
export function readPlannerWeekDraftSnapshot(
  storage: Pick<Storage, 'getItem'> | null,
  key: string,
): PlannerWeekDraftSnapshotV1 | null {
  if (!storage) {
    return null
  }
  const raw = storage.getItem(key)
  if (raw === null || raw === '') {
    return null
  }
  const parsed = parsePlannerWeekDraftSnapshot(raw)
  return parsed.ok ? parsed.value : null
}

/** Persists a snapshot; swallows quota / access errors (callers treat as best-effort). */
export function writePlannerWeekDraftSnapshot(
  storage: Pick<Storage, 'setItem'> | null,
  key: string,
  snapshot: PlannerWeekDraftSnapshotV1,
): void {
  if (!storage) {
    return
  }
  try {
    storage.setItem(key, serializePlannerWeekDraftSnapshot(snapshot))
  }
  catch {
    /* quota, private mode, or disabled storage */
  }
}

/** Removes the snapshot key if present. */
export function clearPlannerWeekDraftSnapshot(storage: Pick<Storage, 'removeItem'> | null, key: string): void {
  if (!storage) {
    return
  }
  try {
    storage.removeItem(key)
  }
  catch {
    /* ignore */
  }
}

/**
 * Whether a stored draft should be applied after initial load.
 * Avoids overwriting in-memory meaningful state or clobbering a deep-linked server load.
 */
export function shouldApplyStoredPlannerWeekDraftSnapshot(args: {
  routeHasTemplateQuery: boolean
  persistenceKind: PlannerDraftPersistenceKind
  currentWeek: WeekPlanV1
  currentTitle: string
  snapshot: PlannerWeekDraftSnapshotV1 | null
}): boolean {
  if (args.routeHasTemplateQuery) {
    return false
  }
  if (args.persistenceKind !== 'none') {
    return false
  }
  if (!args.snapshot) {
    return false
  }
  if (plannerDraftHasMeaningfulEdits(args.currentWeek, args.currentTitle)) {
    return false
  }
  return plannerDraftHasMeaningfulEdits(args.snapshot.weekPlan, args.snapshot.weekPlanTitle)
}
