import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PlanShoppingListNudge from '../../app/components/plan/ShoppingListNudge.vue'

const PLAN_ID = 'abc-123'
const mountOptions = {
  global: {
    stubs: {
      NuxtLink: {
        name: 'NuxtLink',
        props: ['to'],
        template: '<a><slot /></a>',
      },
    },
  },
}

describe('PlanShoppingListNudge', () => {
  it('renders the banner when planId is non-null', () => {
    const wrapper = mount(PlanShoppingListNudge, { ...mountOptions, props: { planId: PLAN_ID } })
    expect(wrapper.find('[role="status"]').exists()).toBe(true)
  })

  it('does not render when planId is null', () => {
    const wrapper = mount(PlanShoppingListNudge, { ...mountOptions, props: { planId: null } })
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
  })

  it('contains the copy "Plan saved!"', () => {
    const wrapper = mount(PlanShoppingListNudge, { ...mountOptions, props: { planId: PLAN_ID } })
    expect(wrapper.text()).toContain('Plan saved!')
  })

  it('contains a "View shopping list" link to the correct route', () => {
    const wrapper = mount(PlanShoppingListNudge, { ...mountOptions, props: { planId: PLAN_ID } })
    const link = wrapper.getComponent({ name: 'NuxtLink' })
    expect(link.props('to')).toEqual({ path: '/shopping-list', query: { plan: PLAN_ID } })
    expect(link.text()).toContain('View shopping list')
  })

  it('has aria-live="polite" on the status region', () => {
    const wrapper = mount(PlanShoppingListNudge, { ...mountOptions, props: { planId: PLAN_ID } })
    const region = wrapper.get('[role="status"]')
    expect(region.attributes('aria-live')).toBe('polite')
  })

  it('emits "dismissed" when the dismiss button is clicked', async () => {
    const wrapper = mount(PlanShoppingListNudge, { ...mountOptions, props: { planId: PLAN_ID } })
    await wrapper.find('button[aria-label="Dismiss"]').trigger('click')
    expect(wrapper.emitted('dismissed')).toHaveLength(1)
  })

  it('updates the link route when planId changes', async () => {
    const wrapper = mount(PlanShoppingListNudge, { ...mountOptions, props: { planId: PLAN_ID } })
    await wrapper.setProps({ planId: 'new-xyz' })
    expect(wrapper.getComponent({ name: 'NuxtLink' }).props('to')).toEqual({
      path: '/shopping-list',
      query: { plan: 'new-xyz' },
    })
  })

  it('hides after planId is set to null (reactive dismiss)', async () => {
    const wrapper = mount(PlanShoppingListNudge, { ...mountOptions, props: { planId: PLAN_ID } })
    expect(wrapper.find('[role="status"]').exists()).toBe(true)
    await wrapper.setProps({ planId: null })
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
  })
})
