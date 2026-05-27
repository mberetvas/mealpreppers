/**
 * Component tests for WeekplanConsolidatedListStatus — covers all three badge states:
 * "List ready", "List outdated", and "No list yet".
 */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import WeekplanConsolidatedListStatus from '../../app/components/shopping-list/WeekplanConsolidatedListStatus.vue'

describe('WeekplanConsolidatedListStatus', () => {
  it('renders "List ready" when hasSavedShoppingList=true and shoppingListDeprecated=false', () => {
    const wrapper = mount(WeekplanConsolidatedListStatus, {
      props: { hasSavedShoppingList: true, shoppingListDeprecated: false },
    })
    expect(wrapper.text()).toContain('List ready')
  })

  it('renders "List outdated" when hasSavedShoppingList=true and shoppingListDeprecated=true', () => {
    const wrapper = mount(WeekplanConsolidatedListStatus, {
      props: { hasSavedShoppingList: true, shoppingListDeprecated: true },
    })
    expect(wrapper.text()).toContain('List outdated')
  })

  it('renders "No list yet" when hasSavedShoppingList=false', () => {
    const wrapper = mount(WeekplanConsolidatedListStatus, {
      props: { hasSavedShoppingList: false, shoppingListDeprecated: false },
    })
    expect(wrapper.text()).toContain('No list yet')
  })

  it('renders "No list yet" regardless of shoppingListDeprecated when hasSavedShoppingList=false', () => {
    const wrapper = mount(WeekplanConsolidatedListStatus, {
      props: { hasSavedShoppingList: false, shoppingListDeprecated: true },
    })
    expect(wrapper.text()).toContain('No list yet')
  })

  it('has a status role for accessibility', () => {
    const wrapper = mount(WeekplanConsolidatedListStatus, {
      props: { hasSavedShoppingList: true, shoppingListDeprecated: false },
    })
    expect(wrapper.find('[role="status"]').exists()).toBe(true)
  })
})
