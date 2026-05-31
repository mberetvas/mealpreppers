/**
 * Integration tests: WeekplanConsolidatedListStatus badge in the weekly planner.
 * Verifies all three badge states when a Saved Weekplan is loaded via the ?template= route.
 */
import { defineComponent, h, Suspense, ref, computed, watch, shallowRef, onMounted, onBeforeUnmount } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import WeeklyPlanPage from '../../app/pages/weekly-plan.vue'
import WeekplanConsolidatedListStatus from '../../app/components/shopping-list/WeekplanConsolidatedListStatus.vue'

/** Minimal valid WeekPlanV1 body for API mock responses. */
const EMPTY_BODY = {
  version: 'week_v1',
  days: Object.fromEntries(
    ['1', '2', '3', '4', '5', '6', '7'].map(k => [
      k,
      { breakfast: { recipeId: null }, lunch: { recipeId: null }, dinner: { recipeId: null } },
    ]),
  ),
}

function makePlanRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'plan-123',
    name: 'My Week',
    body: EMPTY_BODY,
    hasSavedShoppingList: false,
    shoppingListDeprecated: false,
    ...overrides,
  }
}

function setupGlobals(planRow: ReturnType<typeof makePlanRow>) {
  // Vue composables used as Nuxt auto-imports in weekly-plan.vue
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('watch', watch)
  vi.stubGlobal('shallowRef', shallowRef)
  vi.stubGlobal('onMounted', onMounted)
  vi.stubGlobal('onBeforeUnmount', onBeforeUnmount)

  vi.stubGlobal('useFetch', vi.fn(() => ({
    data: ref([]),
    pending: ref(false),
    error: ref(null),
    refresh: vi.fn().mockResolvedValue(undefined),
  })))
  vi.stubGlobal('useRoute', () => ({ query: { template: planRow.id } }))
  vi.stubGlobal('useRouter', () => ({ replace: vi.fn().mockResolvedValue(undefined) }))
  vi.stubGlobal('useHead', vi.fn())
  vi.stubGlobal('useState', vi.fn(() => ref([])))
  vi.stubGlobal('usePlanningWeekAutosave', vi.fn())
  vi.stubGlobal('usePlanningMonthAutosave', vi.fn())
  vi.stubGlobal('useAccessibleOverlayInteraction', vi.fn())
  vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(planRow))
}

const mountOptions = {
  global: {
    components: {
      ShoppingListWeekplanConsolidatedListStatus: WeekplanConsolidatedListStatus,
    },
    stubs: {
      NuxtLink: { name: 'NuxtLink', props: ['to'], template: '<a><slot /></a>' },
      PlanWeekPlanEditor: { name: 'PlanWeekPlanEditor', template: '<div />' },
      PlanShoppingListNudge: { name: 'PlanShoppingListNudge', props: ['planId'], template: '<div />' },
      PlanRecipePickerModal: { name: 'PlanRecipePickerModal', template: '<div />' },
      PlanTemplateLibraryPanel: { name: 'PlanTemplateLibraryPanel', template: '<div />' },
      PlanMonthPlanOverview: { name: 'PlanMonthPlanOverview', template: '<div />' },
    },
  },
}

async function mountPage(planRow: ReturnType<typeof makePlanRow>) {
  setupGlobals(planRow)
  const wrapper = mount(
    defineComponent({ render: () => h(Suspense, null, { default: () => h(WeeklyPlanPage) }) }),
    mountOptions,
  )
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('weekly-plan page: WeekplanConsolidatedListStatus badge when Saved Weekplan is loaded', () => {
  it('renders "List ready" when hasSavedShoppingList=true and shoppingListDeprecated=false', async () => {
    const wrapper = await mountPage(makePlanRow({
      hasSavedShoppingList: true,
      shoppingListDeprecated: false,
    }))
    expect(wrapper.text()).toContain('List ready')
  })

  it('renders "List outdated" when hasSavedShoppingList=true and shoppingListDeprecated=true', async () => {
    const wrapper = await mountPage(makePlanRow({
      hasSavedShoppingList: true,
      shoppingListDeprecated: true,
    }))
    expect(wrapper.text()).toContain('List outdated')
  })

  it('renders "No list yet" when hasSavedShoppingList=false', async () => {
    const wrapper = await mountPage(makePlanRow({
      hasSavedShoppingList: false,
      shoppingListDeprecated: false,
    }))
    expect(wrapper.text()).toContain('No list yet')
  })

  it('does not render the badge when no Saved Weekplan is loaded (draft mode)', async () => {
    // No template query → weekPersistenceKind stays 'none' → badge not rendered
    vi.stubGlobal('ref', ref)
    vi.stubGlobal('computed', computed)
    vi.stubGlobal('watch', watch)
    vi.stubGlobal('shallowRef', shallowRef)
    vi.stubGlobal('onMounted', onMounted)
    vi.stubGlobal('onBeforeUnmount', onBeforeUnmount)
    vi.stubGlobal('useFetch', vi.fn(() => ({
      data: ref([]),
      pending: ref(false),
      error: ref(null),
      refresh: vi.fn().mockResolvedValue(undefined),
    })))
    vi.stubGlobal('useRoute', () => ({ query: {} }))
    vi.stubGlobal('useRouter', () => ({ replace: vi.fn().mockResolvedValue(undefined) }))
    vi.stubGlobal('useHead', vi.fn())
    vi.stubGlobal('useState', vi.fn(() => ref([])))
    vi.stubGlobal('usePlanningWeekAutosave', vi.fn())
    vi.stubGlobal('usePlanningMonthAutosave', vi.fn())
    vi.stubGlobal('useAccessibleOverlayInteraction', vi.fn())
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({}))

    const wrapper = mount(
      defineComponent({ render: () => h(Suspense, null, { default: () => h(WeeklyPlanPage) }) }),
      mountOptions,
    )
    await flushPromises()

    expect(wrapper.text()).not.toContain('List ready')
    expect(wrapper.text()).not.toContain('List outdated')
    expect(wrapper.text()).not.toContain('No list yet')
  })
})
