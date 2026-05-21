import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { WeekPlanV1 } from '../../types/planning'
import { emptyWeekPlan } from '../../utils/weekPlan'

/**
 * Issue 003: in-planner template library uses principal-scoped Saved Weekplans only.
 * Source inspection gates the useFetch URL; extracted handlers gate load/delete contracts.
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

/** Mirrors loadTemplateIntoWeek in weekly-plan.vue (Saved Weekplans only). */
function createLoadTemplateLogic(fetchFn: typeof globalThis.$fetch) {
  const weekPlan = ref<WeekPlanV1>(emptyWeekPlan())
  const activeTemplateId = ref<string | null>(null)
  const weekPlanTitle = ref('')
  const weekPersistenceKind = ref<'none' | 'saved-weekplan'>('none')
  const saveStatus = ref<'saved' | 'saving' | 'dirty' | 'error'>('saved')
  const templateBusyId = ref<string | null>(null)

  async function loadTemplateIntoWeek(id: string): Promise<void> {
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
    loadTemplateIntoWeek,
  }
}

/** Mirrors deleteTemplate in weekly-plan.vue (Saved Weekplans only). */
function createDeleteTemplateLogic(fetchFn: typeof globalThis.$fetch) {
  const activeTemplateId = ref<string | null>('sw-1')
  const weekPersistenceKind = ref<'none' | 'saved-weekplan'>('saved-weekplan')
  const templateBusyId = ref<string | null>(null)
  const refreshTemplates = vi.fn()

  async function deleteTemplate(id: string): Promise<void> {
    templateBusyId.value = id
    try {
      await fetchFn(`/api/v1/saved-weekplans/${id}`, { method: 'DELETE' })
      if (activeTemplateId.value === id) {
        activeTemplateId.value = null
        weekPersistenceKind.value = 'none'
      }
      await refreshTemplates()
    }
    finally {
      templateBusyId.value = null
    }
  }

  return { activeTemplateId, weekPersistenceKind, templateBusyId, refreshTemplates, deleteTemplate }
}

describe('weekly-plan template library uses saved-weekplans (issue 003)', () => {
  it('lists templates via GET /api/v1/saved-weekplans', () => {
    const templateListFetch = pageSource.match(
      /const \{ data: templateList[\s\S]*?useFetch[\s\S]*?\)/,
    )?.[0]
    expect(templateListFetch).toBeTruthy()
    expect(templateListFetch).toContain("'/api/v1/saved-weekplans'")
    expect(templateListFetch).not.toContain('/api/v1/planning/week-templates')
  })

  it('loadTemplateIntoWeek fetches saved-weekplans and sets persistence to saved-weekplan', () => {
    const loadFn = sliceFunction(pageSource, 'loadTemplateIntoWeek')
    expect(loadFn).toContain('/api/v1/saved-weekplans/')
    expect(loadFn).not.toContain('week-templates')
    expect(loadFn).toContain("weekPersistenceKind.value = 'saved-weekplan'")
    expect(loadFn).not.toContain("'week-template'")
  })

  it('deleteTemplate uses DELETE /api/v1/saved-weekplans/:id', () => {
    const deleteFn = sliceFunction(pageSource, 'deleteTemplate')
    expect(deleteFn).toContain('/api/v1/saved-weekplans/')
    expect(deleteFn).toContain("method: 'DELETE'")
    expect(deleteFn).not.toContain('week-templates')
  })

  it('loadTemplateIntoWeek calls saved-weekplans GET and sets saved-weekplan persistence', async () => {
    const body = emptyWeekPlan()
    const fetchFn = vi.fn().mockResolvedValue({ id: 'sw-9', name: 'Lunch week', body })
    const { loadTemplateIntoWeek, weekPersistenceKind, activeTemplateId, weekPlanTitle } =
      createLoadTemplateLogic(fetchFn as unknown as typeof globalThis.$fetch)

    await loadTemplateIntoWeek('sw-9')

    expect(fetchFn).toHaveBeenCalledWith('/api/v1/saved-weekplans/sw-9')
    expect(weekPersistenceKind.value).toBe('saved-weekplan')
    expect(activeTemplateId.value).toBe('sw-9')
    expect(weekPlanTitle.value).toBe('Lunch week')
  })

  it('deleteTemplate calls saved-weekplans DELETE', async () => {
    const fetchFn = vi.fn().mockResolvedValue(undefined)
    const { deleteTemplate, refreshTemplates, activeTemplateId, weekPersistenceKind } =
      createDeleteTemplateLogic(fetchFn as unknown as typeof globalThis.$fetch)

    await deleteTemplate('sw-1')

    expect(fetchFn).toHaveBeenCalledWith('/api/v1/saved-weekplans/sw-1', { method: 'DELETE' })
    expect(activeTemplateId.value).toBeNull()
    expect(weekPersistenceKind.value).toBe('none')
    expect(refreshTemplates).toHaveBeenCalled()
  })
})
