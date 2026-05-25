import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { WeekPlanV1 } from '../../types/planning'
import { emptyWeekPlan } from '../../utils/weekPlan'

/**
 * Issue 010: Clear post-save nudge on template switch and hydration.
 * Ensures shoppingListNudgeId is nulled when switching grids.
 */

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
const pageSource = readFileSync(join(repoRoot, 'app', 'pages', 'weekly-plan.vue'), 'utf8')

function sliceFunction(source: string, name: string): string {
  const start = source.indexOf(`async function ${name}`)
  if (start < 0) {
    throw new Error(`function ${name} not found`)
  }
  const nextFn = source.indexOf('\nasync function ', start + 1)
  const end = nextFn < 0 ? source.length : nextFn
  return source.slice(start, end)
}

/** Mirrors loadTemplateIntoWeek with shoppingListNudgeId tracking. */
function createLoadTemplateLogic(fetchFn: typeof globalThis.$fetch) {
  const weekPlan = ref<WeekPlanV1>(emptyWeekPlan())
  const activeTemplateId = ref<string | null>(null)
  const weekPlanTitle = ref('')
  const weekPersistenceKind = ref<'none' | 'saved-weekplan'>('none')
  const saveStatus = ref<'saved' | 'saving' | 'dirty' | 'error'>('saved')
  const templateBusyId = ref<string | null>(null)
  const shoppingListNudgeId = ref<string | null>('prior-plan-id')

  async function loadTemplateIntoWeek(id: string): Promise<void> {
    shoppingListNudgeId.value = null
    templateBusyId.value = id
    try {
      const row = await fetchFn<{ id: string, name: string, body: WeekPlanV1 }>(`/api/v1/saved-weekplans/${id}`)
      weekPlan.value = row.body
      activeTemplateId.value = row.id
      weekPlanTitle.value = row.name
      weekPersistenceKind.value = 'saved-weekplan'
      saveStatus.value = 'saved'
    }
    finally {
      templateBusyId.value = null
    }
  }

  return {
    weekPlan,
    activeTemplateId,
    weekPlanTitle,
    weekPersistenceKind,
    saveStatus,
    templateBusyId,
    shoppingListNudgeId,
    loadTemplateIntoWeek,
  }
}

/** Mirrors hydrateTemplateFromRoute with shoppingListNudgeId tracking. */
function createHydrateLogic(fetchFn: (url: string) => Promise<{ ok: true, id: string, name: string, body: WeekPlanV1 } | { ok: false }>) {
  const weekPlan = ref<WeekPlanV1>(emptyWeekPlan())
  const activeTemplateId = ref<string | null>(null)
  const weekPlanTitle = ref('')
  const weekPersistenceKind = ref<'none' | 'saved-weekplan'>('none')
  const saveStatus = ref<'saved' | 'saving' | 'dirty' | 'error'>('saved')
  const shoppingListNudgeId = ref<string | null>('prior-plan-id')

  async function hydrateTemplateFromRoute(tid: string): Promise<void> {
    if (!tid) return
    const loaded = await fetchFn(tid)
    if (!loaded.ok) {
      saveStatus.value = 'error'
      return
    }
    weekPlan.value = loaded.body
    activeTemplateId.value = loaded.id
    weekPlanTitle.value = loaded.name
    weekPersistenceKind.value = 'saved-weekplan'
    saveStatus.value = 'saved'
    shoppingListNudgeId.value = null
  }

  return {
    weekPlan,
    activeTemplateId,
    weekPlanTitle,
    weekPersistenceKind,
    saveStatus,
    shoppingListNudgeId,
    hydrateTemplateFromRoute,
  }
}

describe('weekly-plan nudge cleared on template switch (issue 010)', () => {
  it('loadTemplateIntoWeek nulls shoppingListNudgeId at the start (source inspection)', () => {
    const fn = sliceFunction(pageSource, 'loadTemplateIntoWeek')
    const nullLine = fn.indexOf('shoppingListNudgeId.value = null')
    const fetchLine = fn.indexOf('await $fetch')
    expect(nullLine).toBeGreaterThan(-1)
    expect(fetchLine).toBeGreaterThan(-1)
    expect(nullLine).toBeLessThan(fetchLine)
  })

  it('hydrateTemplateFromRoute nulls shoppingListNudgeId on success (source inspection)', () => {
    const fn = sliceFunction(pageSource, 'hydrateTemplateFromRoute')
    // Must appear inside the function body itself (before the closing brace before onMounted)
    const fnBody = fn.slice(0, fn.indexOf('\n\nonMounted') > 0 ? fn.indexOf('\n\nonMounted') : fn.indexOf('\n}') + 2)
    expect(fnBody).toContain('shoppingListNudgeId.value = null')
  })

  it('loading a second grid via template library clears any prior nudge', async () => {
    const body = emptyWeekPlan()
    const fetchFn = vi.fn().mockResolvedValue({ id: 'sw-new', name: 'New Plan', body })
    const { loadTemplateIntoWeek, shoppingListNudgeId } =
      createLoadTemplateLogic(fetchFn as unknown as typeof globalThis.$fetch)

    expect(shoppingListNudgeId.value).toBe('prior-plan-id')
    await loadTemplateIntoWeek('sw-new')
    expect(shoppingListNudgeId.value).toBeNull()
  })

  it('route hydration to a different Saved Weekplan clears any prior nudge', async () => {
    const body = emptyWeekPlan()
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, id: 'sw-hydrated', name: 'Hydrated', body })
    const { hydrateTemplateFromRoute, shoppingListNudgeId } =
      createHydrateLogic(fetchFn)

    expect(shoppingListNudgeId.value).toBe('prior-plan-id')
    await hydrateTemplateFromRoute('sw-hydrated')
    expect(shoppingListNudgeId.value).toBeNull()
  })
})
