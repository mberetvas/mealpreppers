import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AisleSection from '../../app/components/shopping-list/AisleSection.vue'

/** Minimal MergedLine-compatible shape for test fixtures. */
function line(
  id: string,
  name: string,
  aisleCategory?: 'produce' | 'dry_goods' | 'dairy',
) {
  return { id, name, quantity: undefined, unit: undefined, provenance: [], aisleCategory }
}

describe('AisleSection: AI-assigned grouping', () => {
  it('renders one details element per run-length aisle group', () => {
    const wrapper = mount(AisleSection, {
      props: {
        lines: [
          line('L1', 'tomaten', 'produce'),
          line('L2', 'sla', 'produce'),
          line('L3', 'pasta', 'dry_goods'),
        ],
      },
    })
    const groups = wrapper.findAll('[data-testid^="aisle-group-"]')
    expect(groups).toHaveLength(2)
  })

  it('preserves line order within groups (not global walk order)', () => {
    const wrapper = mount(AisleSection, {
      props: {
        lines: [
          line('L1', 'pasta', 'dry_goods'),
          line('L2', 'tomaten', 'produce'),
          line('L3', 'rijst', 'dry_goods'),
        ],
      },
    })
    const groups = wrapper.findAll('[data-testid^="aisle-group-"]')
    expect(groups[0].attributes('data-testid')).toBe('aisle-group-dry_goods')
    expect(groups[1].attributes('data-testid')).toBe('aisle-group-produce')
    expect(groups[2].attributes('data-testid')).toBe('aisle-group-dry_goods')
    expect(groups[0].text()).toContain('pasta')
    expect(groups[2].text()).toContain('rijst')
  })

  it('renders the Dutch aisle label in the summary', () => {
    const wrapper = mount(AisleSection, {
      props: {
        lines: [line('L1', 'pasta', 'dry_goods')],
      },
    })
    const label = wrapper.find('[data-testid="aisle-label-dry_goods"]')
    expect(label.text()).toContain('Droogwaren')
  })

  it('renders an empty state gracefully when no lines are provided', () => {
    const wrapper = mount(AisleSection, {
      props: { lines: [] },
    })
    expect(wrapper.findAll('[data-testid^="aisle-group-"]').length).toBe(0)
    expect(wrapper.find('[data-testid="aisle-flat-list"]').exists()).toBe(false)
  })
})

describe('AisleSection: legacy flat mode', () => {
  it('renders a flat list without aisle headers when no aisleCategory', () => {
    const wrapper = mount(AisleSection, {
      props: {
        lines: [
          { id: 'L1', name: 'pasta', quantity: 400, unit: 'g', provenance: [] },
          { id: 'L2', name: 'tomaten', quantity: 300, unit: 'g', provenance: [] },
        ],
      },
    })
    expect(wrapper.find('[data-testid="aisle-flat-list"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid^="aisle-group-"]').length).toBe(0)
    expect(wrapper.find('[data-testid="legacy-flat-banner"]').text()).toContain('Re-consolidate')
  })

  it('shows all legacy lines in flat list order', () => {
    const wrapper = mount(AisleSection, {
      props: {
        lines: [
          { id: 'L1', name: 'pasta', quantity: undefined, unit: undefined, provenance: [] },
          { id: 'L2', name: 'melk', quantity: undefined, unit: undefined, provenance: [] },
        ],
      },
    })
    const flat = wrapper.find('[data-testid="aisle-flat-list"]')
    expect(flat.text()).toContain('pasta')
    expect(flat.text()).toContain('melk')
  })
})

describe('AisleSection: readonly and diff highlighting', () => {
  it('hides checkboxes when readonly is true', () => {
    const wrapper = mount(AisleSection, {
      props: {
        lines: [line('L1', 'pasta', 'dry_goods')],
        readonly: true,
      },
    })
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false)
  })

  it('shows checkboxes when readonly is false', () => {
    const wrapper = mount(AisleSection, {
      props: {
        lines: [line('L1', 'pasta', 'dry_goods')],
        readonly: false,
      },
    })
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(true)
  })

  it('highlights changed line IDs', () => {
    const wrapper = mount(AisleSection, {
      props: {
        lines: [line('L1', 'pasta', 'dry_goods')],
        changedLineIds: new Set(['L1']),
      },
    })
    expect(wrapper.find('[data-testid="diff-changed"]').exists()).toBe(true)
  })
})
