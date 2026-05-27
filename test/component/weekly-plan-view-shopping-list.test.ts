/**
 * Component tests: "View shopping list" action in the weekly planner.
 *
 * Acceptance criteria covered:
 * - Action present when a Saved Weekplan is loaded (AC #2)
 * - Action absent in draft mode (no template loaded)
 * - Clicking opens ConsolidatedShoppingListPreview for the correct plan (AC #3)
 * - Preview modal receives flags matching the plan's state (AC #5)
 * - All three modal states (ready, outdated, no-list) reachable (AC #6)
 */
import { defineComponent, h, Suspense, ref, computed, watch, shallowRef, onMounted, onBeforeUnmount } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import WeeklyPlanPage from '../../app/pages/weekly-plan.vue'

/** Stub that exposes received props via data-attributes so tests can assert them. */
const PreviewStub = {
  name: 'ShoppingListConsolidatedShoppingListPreview',
  props: ['planId', 'hasSavedShoppingList', 'shoppingListDeprecated', 'open'],
  emits: ['update:open'],
  template: `<div
    v-if="open"
    data-testid="preview-modal-stub"
    :data-plan-id="planId"
    :data-has-saved="String(hasSavedShoppingList)"
    :data-deprecated="String(shoppingListDeprecated)"
  />`,
}

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

function setupGlobals(planRow: ReturnType<typeof makePlanRow>, templateId?: string) {
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
  vi.stubGlobal('useRoute', () => ({
    query: templateId ? { template: templateId } : {},
  }))
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
    stubs: {
      NuxtLink: { name: 'NuxtLink', props: ['to'], template: '<a><slot /></a>' },
      PlanWeekPlanEditor: { name: 'PlanWeekPlanEditor', template: '<div />' },
      PlanShoppingListNudge: { name: 'PlanShoppingListNudge', props: ['planId'], template: '<div />' },
      PlanRecipePickerModal: { name: 'PlanRecipePickerModal', template: '<div />' },
      PlanTemplateLibraryPanel: { name: 'PlanTemplateLibraryPanel', template: '<div />' },
      PlanMonthPlanOverview: { name: 'PlanMonthPlanOverview', template: '<div />' },
      ShoppingListWeekplanConsolidatedListStatus: { template: '<span />' },
      ShoppingListConsolidatedShoppingListPreview: PreviewStub,
    },
  },
}

async function mountPage(planRow: ReturnType<typeof makePlanRow>, templateId = planRow.id) {
  setupGlobals(planRow, templateId)
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

// ---------------------------------------------------------------------------
// Action presence
// ---------------------------------------------------------------------------

describe('weekly-plan page: View shopping list action when Saved Weekplan loaded', () => {
  it('renders "View shopping list" button when a Saved Weekplan is loaded', async () => {
    const wrapper = await mountPage(makePlanRow({
      hasSavedShoppingList: true,
      shoppingListDeprecated: false,
    }))
    expect(wrapper.find('[data-testid="view-shopping-list-btn"]').exists()).toBe(true)
  })

  it('renders "View shopping list" button even when plan has no list yet', async () => {
    const wrapper = await mountPage(makePlanRow({
      hasSavedShoppingList: false,
      shoppingListDeprecated: false,
    }))
    expect(wrapper.find('[data-testid="view-shopping-list-btn"]').exists()).toBe(true)
  })

  it('does NOT render "View shopping list" button in draft mode (no Saved Weekplan)', async () => {
    // No template query → hydrateTemplateFromRoute is a no-op → weekPersistenceKind stays 'none'
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

    expect(wrapper.find('[data-testid="view-shopping-list-btn"]').exists()).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Clicking opens preview modal for correct plan
// ---------------------------------------------------------------------------

describe('weekly-plan page: clicking View shopping list opens preview modal', () => {
  it('opens preview modal with the correct planId after clicking', async () => {
    const wrapper = await mountPage(makePlanRow({ id: 'week-plan-abc' }))
    expect(wrapper.find('[data-testid="preview-modal-stub"]').exists()).toBe(false)

    await wrapper.find('[data-testid="view-shopping-list-btn"]').trigger('click')
    await flushPromises()

    const modal = wrapper.find('[data-testid="preview-modal-stub"]')
    expect(modal.exists()).toBe(true)
    expect(modal.attributes('data-plan-id')).toBe('week-plan-abc')
  })
})

// ---------------------------------------------------------------------------
// All three modal states reachable from planner (flags correctly forwarded)
// ---------------------------------------------------------------------------

describe('weekly-plan page: all three modal states reachable', () => {
  it('forwards hasSavedShoppingList=false so modal shows no-list state', async () => {
    const wrapper = await mountPage(makePlanRow({
      hasSavedShoppingList: false,
      shoppingListDeprecated: false,
    }))
    await wrapper.find('[data-testid="view-shopping-list-btn"]').trigger('click')
    await flushPromises()

    const modal = wrapper.find('[data-testid="preview-modal-stub"]')
    expect(modal.attributes('data-has-saved')).toBe('false')
    expect(modal.attributes('data-deprecated')).toBe('false')
  })

  it('forwards hasSavedShoppingList=true, deprecated=false so modal shows ready state', async () => {
    const wrapper = await mountPage(makePlanRow({
      hasSavedShoppingList: true,
      shoppingListDeprecated: false,
    }))
    await wrapper.find('[data-testid="view-shopping-list-btn"]').trigger('click')
    await flushPromises()

    const modal = wrapper.find('[data-testid="preview-modal-stub"]')
    expect(modal.attributes('data-has-saved')).toBe('true')
    expect(modal.attributes('data-deprecated')).toBe('false')
  })

  it('forwards hasSavedShoppingList=true, deprecated=true so modal shows outdated state', async () => {
    const wrapper = await mountPage(makePlanRow({
      hasSavedShoppingList: true,
      shoppingListDeprecated: true,
    }))
    await wrapper.find('[data-testid="view-shopping-list-btn"]').trigger('click')
    await flushPromises()

    const modal = wrapper.find('[data-testid="preview-modal-stub"]')
    expect(modal.attributes('data-has-saved')).toBe('true')
    expect(modal.attributes('data-deprecated')).toBe('true')
  })
})
