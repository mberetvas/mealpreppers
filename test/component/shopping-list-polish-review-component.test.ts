import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import PolishReview from '../../app/components/shopping-list/PolishReview.vue'

beforeEach(() => {
  vi.unstubAllGlobals()
})

const defaultProps = {
  reviewLines: [
    { id: 'L1', name: 'tomaten', quantity: 600, unit: 'g', provenance: [] },
    { id: 'L2', name: 'olijfolie', quantity: 4, unit: 'el', provenance: [] },
  ],
  hints: [
    { lineId: 'L1', rule: 'quantity-cap', severity: 'error', message: 'Quantity 600 exceeds baseline cap 400 for line "L1"' },
  ],
  sections: [
    { recipeId: 'r1', recipeTitle: 'Pasta', occurrenceCount: 2, ingredients: [{ rawText: '400 g tomaten', name: 'tomaten', quantity: 400, unit: 'g' }] },
  ],
}

describe('PolishReview component: recipe sections reference', () => {
  it('shows recipe sections reference by default', () => {
    const wrapper = mount(PolishReview, { props: defaultProps })
    expect(wrapper.find('[data-testid="ref-sections"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="ref-baseline"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="tab-baseline"]').exists()).toBe(false)
  })
})

describe('PolishReview component: editable lines', () => {
  it('renders editable inputs for each line', () => {
    const wrapper = mount(PolishReview, { props: defaultProps })
    expect(wrapper.find('[data-testid="edit-name-L1"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="edit-qty-L1"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="edit-unit-L1"]').exists()).toBe(true)
  })

  it('emits update-line when name input changes', async () => {
    const wrapper = mount(PolishReview, { props: defaultProps })
    const nameInput = wrapper.find('[data-testid="edit-name-L1"]')
    await nameInput.setValue('cherry tomaten')
    const emitted = wrapper.emitted('update-line')
    expect(emitted).toBeTruthy()
    expect(emitted![0][0]).toBe('L1')
    expect(emitted![0][1]).toEqual({ name: 'cherry tomaten' })
  })

  it('emits update-line when quantity input changes', async () => {
    const wrapper = mount(PolishReview, { props: defaultProps })
    const qtyInput = wrapper.find('[data-testid="edit-qty-L1"]')
    await qtyInput.setValue('400')
    const emitted = wrapper.emitted('update-line')
    expect(emitted).toBeTruthy()
    expect(emitted![0][0]).toBe('L1')
    expect(emitted![0][1]).toEqual({ quantity: 400 })
  })
})

describe('PolishReview component: hint acknowledgment', () => {
  it('shows error hint with acknowledge button', () => {
    const wrapper = mount(PolishReview, { props: defaultProps })
    expect(wrapper.find('[data-testid="hint-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="acknowledge-hint"]').exists()).toBe(true)
  })

  it('approve button stays enabled when unacknowledged error hints exist', () => {
    const wrapper = mount(PolishReview, { props: defaultProps })
    const confirmBtn = wrapper.find('[data-testid="confirm-review"]')
    expect(confirmBtn.attributes('disabled')).toBeUndefined()
    expect(confirmBtn.text()).toContain('Approve')
  })

  it('does not show a blocked message for unacknowledged error hints', () => {
    const wrapper = mount(PolishReview, { props: defaultProps })
    expect(wrapper.find('[data-testid="confirm-blocked-message"]').exists()).toBe(false)
  })

  it('info hints do not block approve', () => {
    const propsWithInfoOnly = {
      ...defaultProps,
      hints: [
        { lineId: 'L2', rule: 'no-removed-lines', severity: 'info', message: 'Line missing from response' },
      ],
    }
    const wrapper = mount(PolishReview, { props: propsWithInfoOnly })
    const confirmBtn = wrapper.find('[data-testid="confirm-review"]')
    expect(confirmBtn.attributes('disabled')).toBeUndefined()
  })
})

describe('PolishReview component: approve action', () => {
  it('emits confirm when approve is clicked and no errors remain', async () => {
    const propsNoErrors = { ...defaultProps, hints: [] }
    const wrapper = mount(PolishReview, { props: propsNoErrors })
    await wrapper.find('[data-testid="confirm-review"]').trigger('click')
    expect(wrapper.emitted('confirm')).toBeTruthy()
  })

  it('emits confirm when approve is clicked even with unacknowledged error hints', async () => {
    const wrapper = mount(PolishReview, { props: defaultProps })
    await wrapper.find('[data-testid="confirm-review"]').trigger('click')
    expect(wrapper.emitted('confirm')).toBeTruthy()
  })
})

describe('PolishReview component: responsive layout', () => {
  it('uses grid with lg:grid-cols-2 for side-by-side desktop layout', () => {
    const wrapper = mount(PolishReview, { props: defaultProps })
    const root = wrapper.find('[data-testid="polish-review"]')
    expect(root.classes()).toContain('lg:grid-cols-2')
  })
})
