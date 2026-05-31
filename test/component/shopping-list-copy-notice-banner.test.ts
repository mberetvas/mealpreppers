/**
 * Component tests for ConsolidatedListCopyNotice — the one-time dismissible banner
 * shown when a plan's shopping list was inherited via copy-on-match.
 *
 * Covers the three required scenarios: shown on first open, hidden after dismiss,
 * and hidden when the copy-on-match flag is absent.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ConsolidatedListCopyNotice from '../../app/components/shopping-list/ConsolidatedListCopyNotice.vue'

const PLAN_ID = 'plan-abc-123'
const DISMISS_KEY = `consolidated-list-copy-notice-dismissed:${PLAN_ID}`

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  localStorage.clear()
})

describe('ConsolidatedListCopyNotice', () => {
  it('shows the banner on first open when shoppingListCopiedFromMatch is true', () => {
    const wrapper = mount(ConsolidatedListCopyNotice, {
      props: { planId: PLAN_ID, shoppingListCopiedFromMatch: true },
    })
    expect(wrapper.find('[data-testid="copy-notice-banner"]').exists()).toBe(true)
  })

  it('hides the banner when shoppingListCopiedFromMatch is false', () => {
    const wrapper = mount(ConsolidatedListCopyNotice, {
      props: { planId: PLAN_ID, shoppingListCopiedFromMatch: false },
    })
    expect(wrapper.find('[data-testid="copy-notice-banner"]').exists()).toBe(false)
  })

  it('hides the banner after the user dismisses it', async () => {
    const wrapper = mount(ConsolidatedListCopyNotice, {
      props: { planId: PLAN_ID, shoppingListCopiedFromMatch: true },
    })
    expect(wrapper.find('[data-testid="copy-notice-banner"]').exists()).toBe(true)

    await wrapper.find('button[aria-label="Dismiss"]').trigger('click')

    expect(wrapper.find('[data-testid="copy-notice-banner"]').exists()).toBe(false)
  })

  it('persists dismiss state in localStorage keyed by plan id', async () => {
    const wrapper = mount(ConsolidatedListCopyNotice, {
      props: { planId: PLAN_ID, shoppingListCopiedFromMatch: true },
    })
    await wrapper.find('button[aria-label="Dismiss"]').trigger('click')

    expect(localStorage.getItem(DISMISS_KEY)).toBeTruthy()
  })

  it('hides the banner when localStorage already has the dismiss key (prior session)', () => {
    localStorage.setItem(DISMISS_KEY, '1')

    const wrapper = mount(ConsolidatedListCopyNotice, {
      props: { planId: PLAN_ID, shoppingListCopiedFromMatch: true },
    })

    expect(wrapper.find('[data-testid="copy-notice-banner"]').exists()).toBe(false)
  })

  it('does not show banners for a different plan id even when one is dismissed', async () => {
    const otherPlanId = 'plan-other-999'
    const wrapper = mount(ConsolidatedListCopyNotice, {
      props: { planId: PLAN_ID, shoppingListCopiedFromMatch: true },
    })
    await wrapper.find('button[aria-label="Dismiss"]').trigger('click')

    const wrapper2 = mount(ConsolidatedListCopyNotice, {
      props: { planId: otherPlanId, shoppingListCopiedFromMatch: true },
    })
    expect(wrapper2.find('[data-testid="copy-notice-banner"]').exists()).toBe(true)
  })

  it('contains a message about the copied list', () => {
    const wrapper = mount(ConsolidatedListCopyNotice, {
      props: { planId: PLAN_ID, shoppingListCopiedFromMatch: true },
    })
    expect(wrapper.text()).toContain('copied')
  })

  it('has a status role and aria-live polite for accessibility', () => {
    const wrapper = mount(ConsolidatedListCopyNotice, {
      props: { planId: PLAN_ID, shoppingListCopiedFromMatch: true },
    })
    const banner = wrapper.find('[data-testid="copy-notice-banner"]')
    expect(banner.attributes('role')).toBe('status')
    expect(banner.attributes('aria-live')).toBe('polite')
  })
})
