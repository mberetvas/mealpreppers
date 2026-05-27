import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AisleSection from '../../app/components/shopping-list/AisleSection.vue'

/** Minimal MergedLine-compatible shape for test fixtures. */
function line(id: string, name: string, quantity?: number, unit?: string) {
  return { id, name, quantity, unit, provenance: [] }
}

describe('AisleSection: grouping and walk order', () => {
  it('renders one details element per non-empty aisle group', () => {
    const wrapper = mount(AisleSection, {
      props: {
        lines: [
          line('L1', 'pasta'),    // dry_goods
          line('L2', 'tomaten'),  // produce
        ],
      },
    })
    const groups = wrapper.findAll('[data-testid^="aisle-group-"]')
    expect(groups).toHaveLength(2)
  })

  it('renders aisle groups in supermarket walk order (produce before dry_goods)', () => {
    const wrapper = mount(AisleSection, {
      props: {
        lines: [
          line('L1', 'pasta'),    // dry_goods
          line('L2', 'tomaten'),  // produce
        ],
      },
    })
    const groups = wrapper.findAll('[data-testid^="aisle-group-"]')
    expect(groups[0].attributes('data-testid')).toBe('aisle-group-produce')
    expect(groups[1].attributes('data-testid')).toBe('aisle-group-dry_goods')
  })

  it('omits groups that have no lines', () => {
    const wrapper = mount(AisleSection, {
      props: {
        lines: [line('L1', 'pasta')],
      },
    })
    expect(wrapper.find('[data-testid="aisle-group-produce"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="aisle-group-dry_goods"]').exists()).toBe(true)
  })

  it('renders the Dutch aisle label in the summary', () => {
    const wrapper = mount(AisleSection, {
      props: {
        lines: [line('L1', 'pasta')],
      },
    })
    const label = wrapper.find('[data-testid="aisle-label-dry_goods"]')
    expect(label.text()).toContain('Droogwaren')
  })

  it('renders all lines in their respective group', () => {
    const wrapper = mount(AisleSection, {
      props: {
        lines: [
          line('L1', 'pasta'),
          line('L2', 'rijst'),
          line('L3', 'tomaten'),
        ],
      },
    })
    expect(wrapper.find('[data-testid="aisle-group-dry_goods"]').text()).toContain('pasta')
    expect(wrapper.find('[data-testid="aisle-group-dry_goods"]').text()).toContain('rijst')
    expect(wrapper.find('[data-testid="aisle-group-produce"]').text()).toContain('tomaten')
  })

  it('renders an empty state gracefully when no lines are provided', () => {
    const wrapper = mount(AisleSection, {
      props: { lines: [] },
    })
    expect(wrapper.findAll('[data-testid^="aisle-group-"]')).toHaveLength(0)
  })
})

describe('AisleSection: expanded on mount', () => {
  it('all details sections start with the open attribute', () => {
    const wrapper = mount(AisleSection, {
      props: {
        lines: [
          line('L1', 'pasta'),
          line('L2', 'tomaten'),
          line('L3', 'melk'),
        ],
      },
    })
    const details = wrapper.findAll('details')
    expect(details.length).toBeGreaterThan(0)
    for (const detail of details) {
      expect(detail.attributes('open')).toBeDefined()
    }
  })
})

describe('AisleSection: readonly prop', () => {
  it('does NOT render checkboxes when readonly is true', () => {
    const wrapper = mount(AisleSection, {
      props: {
        lines: [line('L1', 'pasta', 400, 'g')],
        readonly: true,
      },
    })
    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(0)
  })

  it('renders checkboxes when readonly is false (default)', () => {
    const wrapper = mount(AisleSection, {
      props: {
        lines: [line('L1', 'pasta', 400, 'g')],
      },
    })
    expect(wrapper.findAll('input[type="checkbox"]').length).toBeGreaterThan(0)
  })

  it('renders a checkbox per line when readonly is false', () => {
    const wrapper = mount(AisleSection, {
      props: {
        lines: [
          line('L1', 'pasta', 400, 'g'),
          line('L2', 'rijst', 200, 'g'),
        ],
      },
    })
    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(2)
  })
})

describe('AisleSection: diff highlighting via changedLineIds', () => {
  it('marks changed lines with data-testid="diff-changed"', () => {
    const wrapper = mount(AisleSection, {
      props: {
        lines: [
          line('L1', 'pasta', 400, 'g'),
          line('L2', 'tomaten', 200, 'g'),
        ],
        changedLineIds: new Set(['L1']),
      },
    })
    const diffLines = wrapper.findAll('[data-testid="diff-changed"]')
    expect(diffLines).toHaveLength(1)
    expect(diffLines[0].text()).toContain('pasta')
  })

  it('does NOT mark unchanged lines as diff-changed', () => {
    const wrapper = mount(AisleSection, {
      props: {
        lines: [line('L1', 'pasta', 400, 'g')],
        changedLineIds: new Set<string>(),
      },
    })
    expect(wrapper.findAll('[data-testid="diff-changed"]')).toHaveLength(0)
  })

  it('no diff indicators when changedLineIds is not passed', () => {
    const wrapper = mount(AisleSection, {
      props: {
        lines: [line('L1', 'pasta', 400, 'g')],
      },
    })
    expect(wrapper.findAll('[data-testid="diff-changed"]')).toHaveLength(0)
  })
})

describe('AisleSection: line formatting', () => {
  it('formats lines with quantity, unit, and name', () => {
    const wrapper = mount(AisleSection, {
      props: {
        lines: [line('L1', 'pasta', 400, 'g')],
      },
    })
    expect(wrapper.text()).toContain('400 g pasta')
  })

  it('renders line name only when no quantity', () => {
    const wrapper = mount(AisleSection, {
      props: {
        lines: [{ id: 'L1', name: 'peterselie', quantity: undefined, unit: undefined, provenance: [] }],
      },
    })
    expect(wrapper.text()).toContain('peterselie')
  })
})
