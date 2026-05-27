/**
 * Component tests for ConsolidatedShoppingListPreview — the read-only modal that
 * shows a plan's shopping list status without leaving the current page.
 *
 * Three states driven by hasSavedShoppingList + shoppingListDeprecated:
 *   Ready     — fetches and shows aisle-grouped lines (readonly)
 *   Outdated  — outdated warning, no fetch, no lines
 *   No list   — empty-state message, no fetch, no lines
 *
 * All states show an "Open full list" link to /shopping-list?plan=<id>.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ConsolidatedShoppingListPreview from '../../app/components/shopping-list/ConsolidatedShoppingListPreview.vue'

const PLAN_ID = 'plan-abc-123'

/** Minimal MergedLine fixture for list assertions. */
function line(
  id: string,
  name: string,
  quantity?: number,
  unit?: string,
  aisleCategory?: 'dry_goods' | 'produce',
) {
  return { id, name, quantity, unit, provenance: [], aisleCategory }
}

const readyLines = [
  line('L1', 'pasta', 400, 'g', 'dry_goods'),
  line('L2', 'tomaten', 300, 'g', 'produce'),
]

function mountPreview(props: {
  planId?: string
  hasSavedShoppingList: boolean
  shoppingListDeprecated: boolean
  shoppingListCopiedFromMatch?: boolean
  open?: boolean
  fetchSavedList?: () => Promise<unknown>
}) {
  return mount(ConsolidatedShoppingListPreview, {
    props: {
      planId: props.planId ?? PLAN_ID,
      hasSavedShoppingList: props.hasSavedShoppingList,
      shoppingListDeprecated: props.shoppingListDeprecated,
      shoppingListCopiedFromMatch: props.shoppingListCopiedFromMatch ?? false,
      open: props.open ?? true,
      ...(props.fetchSavedList ? { fetchSavedList: props.fetchSavedList } : {}),
    },
    global: {
      stubs: {
        NuxtLink: {
          name: 'NuxtLink',
          props: ['to'],
          template: '<a :data-to="typeof to === \'string\' ? to : JSON.stringify(to)"><slot /></a>',
        },
      },
    },
  })
}

beforeEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

afterEach(() => {
  localStorage.clear()
})

// ---------------------------------------------------------------------------
// Ready state
// ---------------------------------------------------------------------------

describe('ConsolidatedShoppingListPreview: Ready state', () => {
  it('fetches and renders aisle-grouped lines when hasSavedShoppingList=true and not deprecated', async () => {
    const fetchSavedList = vi.fn().mockResolvedValue({
      lines: readyLines,
      sourceFingerprint: 'fp1',
      confirmedAt: '2024-01-01T00:00:00Z',
    })

    const wrapper = mountPreview({
      hasSavedShoppingList: true,
      shoppingListDeprecated: false,
      fetchSavedList,
    })
    await flushPromises()

    expect(fetchSavedList).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-testid="aisle-section"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('pasta')
    expect(wrapper.text()).toContain('tomaten')
  })

  it('renders aisle sections with readonly=true (no checkboxes)', async () => {
    const fetchSavedList = vi.fn().mockResolvedValue({
      lines: readyLines,
      sourceFingerprint: 'fp1',
      confirmedAt: '2024-01-01T00:00:00Z',
    })

    const wrapper = mountPreview({
      hasSavedShoppingList: true,
      shoppingListDeprecated: false,
      fetchSavedList,
    })
    await flushPromises()

    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(0)
  })

  it('does NOT render outdated warning in ready state', async () => {
    const fetchSavedList = vi.fn().mockResolvedValue({
      lines: readyLines,
      sourceFingerprint: 'fp1',
      confirmedAt: '2024-01-01T00:00:00Z',
    })

    const wrapper = mountPreview({
      hasSavedShoppingList: true,
      shoppingListDeprecated: false,
      fetchSavedList,
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="outdated-warning"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Outdated state
// ---------------------------------------------------------------------------

describe('ConsolidatedShoppingListPreview: Outdated state', () => {
  it('renders outdated warning when hasSavedShoppingList=true and shoppingListDeprecated=true', async () => {
    const fetchSavedList = vi.fn()

    const wrapper = mountPreview({
      hasSavedShoppingList: true,
      shoppingListDeprecated: true,
      fetchSavedList,
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="outdated-warning"]').exists()).toBe(true)
  })

  it('does NOT fetch the saved list in outdated state', async () => {
    const fetchSavedList = vi.fn()

    mountPreview({
      hasSavedShoppingList: true,
      shoppingListDeprecated: true,
      fetchSavedList,
    })
    await flushPromises()

    expect(fetchSavedList).not.toHaveBeenCalled()
  })

  it('does NOT render aisle lines in outdated state', async () => {
    const fetchSavedList = vi.fn()

    const wrapper = mountPreview({
      hasSavedShoppingList: true,
      shoppingListDeprecated: true,
      fetchSavedList,
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="aisle-section"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// No list state
// ---------------------------------------------------------------------------

describe('ConsolidatedShoppingListPreview: No list yet state', () => {
  it('renders empty-state when hasSavedShoppingList=false', async () => {
    const fetchSavedList = vi.fn()

    const wrapper = mountPreview({
      hasSavedShoppingList: false,
      shoppingListDeprecated: false,
      fetchSavedList,
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(true)
  })

  it('does NOT fetch the saved list in no-list state', async () => {
    const fetchSavedList = vi.fn()

    mountPreview({
      hasSavedShoppingList: false,
      shoppingListDeprecated: false,
      fetchSavedList,
    })
    await flushPromises()

    expect(fetchSavedList).not.toHaveBeenCalled()
  })

  it('does NOT render aisle lines or outdated warning in no-list state', async () => {
    const fetchSavedList = vi.fn()

    const wrapper = mountPreview({
      hasSavedShoppingList: false,
      shoppingListDeprecated: false,
      fetchSavedList,
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="aisle-section"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="outdated-warning"]').exists()).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Open full list link
// ---------------------------------------------------------------------------

describe('ConsolidatedShoppingListPreview: Open full list link', () => {
  it('shows Open full list link in ready state navigating to /shopping-list?plan=<id>', async () => {
    const fetchSavedList = vi.fn().mockResolvedValue({
      lines: readyLines,
      sourceFingerprint: 'fp1',
      confirmedAt: '2024-01-01T00:00:00Z',
    })

    const wrapper = mountPreview({
      hasSavedShoppingList: true,
      shoppingListDeprecated: false,
      fetchSavedList,
    })
    await flushPromises()

    const link = wrapper.find('[data-testid="open-full-list"]')
    expect(link.exists()).toBe(true)
    const href = link.attributes('data-to') ?? link.attributes('href') ?? ''
    expect(href).toContain(PLAN_ID)
    expect(href).toContain('shopping-list')
  })

  it('shows Open full list link in outdated state navigating to /shopping-list?plan=<id>', async () => {
    const wrapper = mountPreview({
      hasSavedShoppingList: true,
      shoppingListDeprecated: true,
    })
    await flushPromises()

    const link = wrapper.find('[data-testid="open-full-list"]')
    expect(link.exists()).toBe(true)
    const href = link.attributes('data-to') ?? link.attributes('href') ?? ''
    expect(href).toContain(PLAN_ID)
    expect(href).toContain('shopping-list')
  })

  it('shows Open full list link in no-list state navigating to /shopping-list?plan=<id>', async () => {
    const wrapper = mountPreview({
      hasSavedShoppingList: false,
      shoppingListDeprecated: false,
    })
    await flushPromises()

    const link = wrapper.find('[data-testid="open-full-list"]')
    expect(link.exists()).toBe(true)
    const href = link.attributes('data-to') ?? link.attributes('href') ?? ''
    expect(href).toContain(PLAN_ID)
    expect(href).toContain('shopping-list')
  })
})

// ---------------------------------------------------------------------------
// No consolidation API call
// ---------------------------------------------------------------------------

describe('ConsolidatedShoppingListPreview: No consolidation API call', () => {
  it('never calls the consolidation endpoint under any state', async () => {
    const consolidateMock = vi.fn()
    vi.stubGlobal('$fetch', consolidateMock)

    // Ready state with injected fetch
    const fetchSavedList = vi.fn().mockResolvedValue({
      lines: readyLines,
      sourceFingerprint: 'fp1',
      confirmedAt: '2024-01-01T00:00:00Z',
    })
    mountPreview({ hasSavedShoppingList: true, shoppingListDeprecated: false, fetchSavedList })
    await flushPromises()

    const callArgs = consolidateMock.mock.calls.map((c: unknown[]) => String(c[0]))
    const consolidateCalls = callArgs.filter((url: string) => url.includes('consolidate'))
    expect(consolidateCalls).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Copy notice
// ---------------------------------------------------------------------------

describe('ConsolidatedShoppingListPreview: Copy notice', () => {
  it('shows copy notice banner when shoppingListCopiedFromMatch=true', async () => {
    const fetchSavedList = vi.fn().mockResolvedValue({
      lines: readyLines,
      sourceFingerprint: 'fp1',
      confirmedAt: '2024-01-01T00:00:00Z',
    })

    const wrapper = mountPreview({
      hasSavedShoppingList: true,
      shoppingListDeprecated: false,
      shoppingListCopiedFromMatch: true,
      fetchSavedList,
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="copy-notice-banner"]').exists()).toBe(true)
  })

  it('does NOT show copy notice banner when shoppingListCopiedFromMatch=false', async () => {
    const fetchSavedList = vi.fn().mockResolvedValue({
      lines: readyLines,
      sourceFingerprint: 'fp1',
      confirmedAt: '2024-01-01T00:00:00Z',
    })

    const wrapper = mountPreview({
      hasSavedShoppingList: true,
      shoppingListDeprecated: false,
      shoppingListCopiedFromMatch: false,
      fetchSavedList,
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="copy-notice-banner"]').exists()).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Collapse reset on reopen
// ---------------------------------------------------------------------------

describe('ConsolidatedShoppingListPreview: aisle collapse reset on reopen', () => {
  it('all aisle details sections start open when modal is first opened', async () => {
    const fetchSavedList = vi.fn().mockResolvedValue({
      lines: readyLines,
      sourceFingerprint: 'fp1',
      confirmedAt: '2024-01-01T00:00:00Z',
    })

    const wrapper = mountPreview({
      hasSavedShoppingList: true,
      shoppingListDeprecated: false,
      fetchSavedList,
    })
    await flushPromises()

    const details = wrapper.findAll('details')
    expect(details.length).toBeGreaterThan(0)
    for (const detail of details) {
      expect(detail.attributes('open')).toBeDefined()
    }
  })

  it('re-fetches and resets lines on each open (no stale collapse state)', async () => {
    const fetchSavedList = vi.fn().mockImplementation(() => {
      return Promise.resolve({
        lines: readyLines,
        sourceFingerprint: 'fp1',
        confirmedAt: '2024-01-01T00:00:00Z',
      })
    })

    const wrapper = mountPreview({
      hasSavedShoppingList: true,
      shoppingListDeprecated: false,
      fetchSavedList,
    })
    await flushPromises()

    // Close and reopen
    await wrapper.setProps({ open: false })
    await wrapper.setProps({ open: true })
    await flushPromises()

    expect(fetchSavedList).toHaveBeenCalledTimes(2)
  })
})

// ---------------------------------------------------------------------------
// Hidden when closed
// ---------------------------------------------------------------------------

describe('ConsolidatedShoppingListPreview: visibility', () => {
  it('does not render modal content when open=false', () => {
    const wrapper = mountPreview({
      hasSavedShoppingList: true,
      shoppingListDeprecated: false,
      open: false,
    })

    expect(wrapper.find('[data-testid="preview-modal"]').exists()).toBe(false)
  })

  it('renders modal content when open=true', async () => {
    const fetchSavedList = vi.fn().mockResolvedValue({
      lines: readyLines,
      sourceFingerprint: 'fp1',
      confirmedAt: '2024-01-01T00:00:00Z',
    })

    const wrapper = mountPreview({
      hasSavedShoppingList: true,
      shoppingListDeprecated: false,
      open: true,
      fetchSavedList,
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="preview-modal"]').exists()).toBe(true)
  })
})
