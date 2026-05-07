import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import FormFlowStatusSurfaces from '../../app/components/FormFlowStatusSurfaces.vue'
import { STATE_MESSAGING_CONTRACT_LABEL } from '../../utils/stateMessagingContract'

describe(`${STATE_MESSAGING_CONTRACT_LABEL} / FormFlowStatusSurfaces`, () => {
  it('exposes error copy with assertive alert semantics', () => {
    const wrapper = mount(FormFlowStatusSurfaces, {
      props: { errorMessage: 'Could not save recipe.' },
    })
    const region = wrapper.get('[role="alert"]')
    expect(region.text()).toContain('Could not save recipe.')
    expect(region.attributes('aria-live')).toBe('assertive')
    expect(region.attributes('aria-atomic')).toBe('true')
  })

  it('exposes warnings with polite status semantics', () => {
    const wrapper = mount(FormFlowStatusSurfaces, {
      props: { warnings: ['Partial import', 'Image skipped'] },
    })
    const region = wrapper.get('[role="status"]')
    expect(region.text()).toContain('Partial import')
    expect(region.attributes('aria-live')).toBe('polite')
    expect(region.attributes('aria-atomic')).toBe('true')
  })

  it('exposes success with polite status semantics', () => {
    const wrapper = mount(FormFlowStatusSurfaces, {
      props: { successMessage: 'Recipe imported.' },
    })
    const regions = wrapper.findAll('[role="status"]')
    expect(regions).toHaveLength(1)
    expect(regions[0].text()).toContain('Recipe imported.')
    expect(regions[0].attributes('aria-live')).toBe('polite')
  })

  it('keeps success and warnings visible together without hiding assertive error', () => {
    const wrapper = mount(FormFlowStatusSurfaces, {
      props: {
        errorMessage: 'Save failed.',
        warnings: ['Stale data'],
        successMessage: 'Draft restored.',
      },
    })
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    expect(wrapper.findAll('[role="status"]')).toHaveLength(2)
  })
})
