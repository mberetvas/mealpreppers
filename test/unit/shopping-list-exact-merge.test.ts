import { describe, it, expect } from 'vitest'
import type { ShoppingListSection } from '../../utils/shoppingList'
import { exactMerge, buildPolishContext, canonicalDisplayName } from '../../server/services/shopping-list/exactMerge'

const RID_A = '11111111-1111-1111-1111-111111111111'
const RID_B = '22222222-2222-2222-2222-222222222222'
const RID_C = '33333333-3333-3333-3333-333333333333'

function makeSection(
  recipeId: string,
  recipeTitle: string,
  ingredients: ShoppingListSection['ingredients'],
): ShoppingListSection {
  return { recipeId, recipeTitle, occurrenceCount: 1, ingredients }
}

describe('canonicalDisplayName', () => {
  it('strips preparation suffix after comma', () => {
    expect(canonicalDisplayName('ui, in ringen')).toBe('ui')
    expect(canonicalDisplayName('chorizo, in plakjes')).toBe('chorizo')
  })

  it('returns name unchanged when no comma', () => {
    expect(canonicalDisplayName('bloemkool')).toBe('bloemkool')
  })
})

describe('exactMerge', () => {
  it('merges identical name + unit lines and sums quantities', () => {
    const sections: ShoppingListSection[] = [
      makeSection(RID_A, 'Pasta', [
        { rawText: '400 g pasta', name: 'pasta', quantity: 400, unit: 'g' },
      ]),
      makeSection(RID_B, 'Noodles', [
        { rawText: '400 g pasta', name: 'pasta', quantity: 400, unit: 'g' },
      ]),
    ]
    const result = exactMerge(sections)
    expect(result.lines).toHaveLength(1)
    expect(result.lines[0].quantity).toBe(800)
    expect(result.lines[0].unit).toBe('g')
    expect(result.lines[0].name).toBe('pasta')
  })

  it('merges lines that differ only by preparation suffix after comma', () => {
    const sections: ShoppingListSection[] = [
      makeSection(RID_A, 'Stoofschotel', [
        { rawText: '1 ui, in ringen', name: 'ui, in ringen', quantity: 1, unit: undefined },
      ]),
      makeSection(RID_B, 'Bloemkool', [
        { rawText: '1 ui', name: 'ui', quantity: 1, unit: undefined },
      ]),
    ]
    const result = exactMerge(sections)
    expect(result.lines).toHaveLength(1)
    expect(result.lines[0].quantity).toBe(2)
    expect(result.lines[0].name).toBe('ui')
    expect(result.lines[0].provenance).toHaveLength(2)
  })

  it('applies unit aliases before comparison so gr and g merge', () => {
    const sections: ShoppingListSection[] = [
      makeSection(RID_A, 'Soup', [
        { rawText: '400 gr bloem', name: 'bloem', quantity: 400, unit: 'gr' },
      ]),
      makeSection(RID_B, 'Cake', [
        { rawText: '400 g bloem', name: 'bloem', quantity: 400, unit: 'g' },
      ]),
    ]
    const result = exactMerge(sections)
    expect(result.lines).toHaveLength(1)
    expect(result.lines[0].quantity).toBe(800)
    expect(result.lines[0].unit).toBe('g')
  })

  it('merges teentje and teentjes unit aliases', () => {
    const sections: ShoppingListSection[] = [
      makeSection(RID_A, 'A', [
        { rawText: '1 teentje knoflook', name: 'knoflook', quantity: 1, unit: 'teentje' },
      ]),
      makeSection(RID_B, 'B', [
        { rawText: '2 teentjes knoflook', name: 'knoflook', quantity: 2, unit: 'teentjes' },
      ]),
    ]
    const result = exactMerge(sections)
    expect(result.lines).toHaveLength(1)
    expect(result.lines[0].quantity).toBe(3)
    expect(result.lines[0].unit).toBe('teentje')
  })

  it('keeps lines with different units separate', () => {
    const sections: ShoppingListSection[] = [
      makeSection(RID_A, 'Salad', [
        { rawText: '400 g tomaten', name: 'tomaten', quantity: 400, unit: 'g' },
        { rawText: '2 stuks tomaten', name: 'tomaten', quantity: 2, unit: 'stuks' },
      ]),
    ]
    const result = exactMerge(sections)
    expect(result.lines).toHaveLength(2)
    expect(result.lines[0].unit).toBe('g')
    expect(result.lines[0].quantity).toBe(400)
    expect(result.lines[1].unit).toBe('stuks')
    expect(result.lines[1].quantity).toBe(2)
  })

  it('assigns deterministic L{n} ids based on merge order', () => {
    const sections: ShoppingListSection[] = [
      makeSection(RID_A, 'Recipe A', [
        { rawText: '1 l melk', name: 'melk', quantity: 1, unit: 'l' },
        { rawText: '200 g boter', name: 'boter', quantity: 200, unit: 'g' },
      ]),
      makeSection(RID_B, 'Recipe B', [
        { rawText: '100 g suiker', name: 'suiker', quantity: 100, unit: 'g' },
      ]),
    ]
    const result = exactMerge(sections)
    expect(result.lines[0].id).toBe('L1')
    expect(result.lines[0].name).toBe('melk')
    expect(result.lines[1].id).toBe('L2')
    expect(result.lines[1].name).toBe('boter')
    expect(result.lines[2].id).toBe('L3')
    expect(result.lines[2].name).toBe('suiker')
  })

  it('tracks recipe provenance per merged line', () => {
    const sections: ShoppingListSection[] = [
      makeSection(RID_A, 'Pasta', [
        { rawText: '200 g kaas', name: 'kaas', quantity: 200, unit: 'g' },
      ]),
      makeSection(RID_B, 'Pizza', [
        { rawText: '150 g kaas', name: 'kaas', quantity: 150, unit: 'g' },
      ]),
    ]
    const result = exactMerge(sections)
    expect(result.lines[0].provenance).toEqual([
      { recipeId: RID_A, recipeTitle: 'Pasta' },
      { recipeId: RID_B, recipeTitle: 'Pizza' },
    ])
  })

  it('does not duplicate provenance when same recipe contributes multiple ingredients', () => {
    const sections: ShoppingListSection[] = [
      makeSection(RID_A, 'Pasta', [
        { rawText: '200 g kaas', name: 'kaas', quantity: 200, unit: 'g' },
        { rawText: '100 g kaas', name: 'kaas', quantity: 100, unit: 'g' },
      ]),
    ]
    const result = exactMerge(sections)
    expect(result.lines[0].provenance).toHaveLength(1)
    expect(result.lines[0].quantity).toBe(300)
  })

  it('returns an empty baseline for empty input', () => {
    const result = exactMerge([])
    expect(result.lines).toEqual([])
  })

  it('handles a single-recipe plan correctly', () => {
    const sections: ShoppingListSection[] = [
      makeSection(RID_A, 'Solo Recipe', [
        { rawText: '500 ml water', name: 'water', quantity: 500, unit: 'ml' },
        { rawText: '2 el olie', name: 'olie', quantity: 2, unit: 'el' },
      ]),
    ]
    const result = exactMerge(sections)
    expect(result.lines).toHaveLength(2)
    expect(result.lines[0]).toMatchObject({ id: 'L1', name: 'water', quantity: 500, unit: 'ml' })
    expect(result.lines[1]).toMatchObject({ id: 'L2', name: 'olie', quantity: 2, unit: 'el' })
    expect(result.lines[0].provenance).toEqual([{ recipeId: RID_A, recipeTitle: 'Solo Recipe' }])
  })

  it('rounds float quantities to 2 decimals', () => {
    const sections: ShoppingListSection[] = [
      makeSection(RID_A, 'A', [
        { rawText: '0.1 l olie', name: 'olie', quantity: 0.1, unit: 'l' },
      ]),
      makeSection(RID_B, 'B', [
        { rawText: '0.2 l olie', name: 'olie', quantity: 0.2, unit: 'l' },
      ]),
    ]
    const result = exactMerge(sections)
    // 0.1 + 0.2 = 0.30000000000000004 in JS
    expect(result.lines[0].quantity).toBe(0.3)
  })

  it('includes and merges quantity-less ingredients by normalized name', () => {
    const sections: ShoppingListSection[] = [
      makeSection(RID_A, 'Soup', [
        { rawText: 'zout', name: 'zout', quantity: undefined, unit: undefined },
        { rawText: '500 ml water', name: 'water', quantity: 500, unit: 'ml' },
      ]),
      makeSection(RID_B, 'Salad', [
        { rawText: 'zout', name: 'zout', quantity: undefined, unit: undefined },
      ]),
    ]
    const result = exactMerge(sections)
    expect(result.lines).toHaveLength(2)
    expect(result.lines.find(l => l.name === 'water')).toMatchObject({ quantity: 500, unit: 'ml' })
    const zout = result.lines.find(l => l.name === 'zout')
    expect(zout).toMatchObject({ quantity: undefined, unit: undefined })
    expect(zout?.provenance).toHaveLength(2)
  })

  it('keeps quantity-less lines separate from quantified lines with the same name', () => {
    const sections: ShoppingListSection[] = [
      makeSection(RID_A, 'A', [
        { rawText: 'peper', name: 'peper', quantity: undefined, unit: undefined },
        { rawText: '1 tl peper', name: 'peper', quantity: 1, unit: 'tl' },
      ]),
    ]
    const result = exactMerge(sections)
    expect(result.lines).toHaveLength(2)
    expect(result.lines.find(l => l.quantity === undefined)?.name).toBe('peper')
    expect(result.lines.find(l => l.quantity === 1)?.unit).toBe('tl')
  })

  it('merges case-insensitively on ingredient name', () => {
    const sections: ShoppingListSection[] = [
      makeSection(RID_A, 'A', [
        { rawText: '200 g Pasta', name: 'Pasta', quantity: 200, unit: 'g' },
      ]),
      makeSection(RID_B, 'B', [
        { rawText: '300 g pasta', name: 'pasta', quantity: 300, unit: 'g' },
      ]),
    ]
    const result = exactMerge(sections)
    expect(result.lines).toHaveLength(1)
    expect(result.lines[0].quantity).toBe(500)
  })

  it('line id stability: rerunning same input produces same ids', () => {
    const sections: ShoppingListSection[] = [
      makeSection(RID_A, 'A', [
        { rawText: '100 g a', name: 'a', quantity: 100, unit: 'g' },
        { rawText: '200 ml b', name: 'b', quantity: 200, unit: 'ml' },
      ]),
      makeSection(RID_B, 'B', [
        { rawText: '50 g c', name: 'c', quantity: 50, unit: 'g' },
      ]),
    ]
    const result1 = exactMerge(sections)
    const result2 = exactMerge(sections)
    expect(result1.lines.map(l => l.id)).toEqual(result2.lines.map(l => l.id))
    expect(result1.lines.map(l => l.id)).toEqual(['L1', 'L2', 'L3'])
  })

  it('merges eetlepel alias to el', () => {
    const sections: ShoppingListSection[] = [
      makeSection(RID_A, 'A', [
        { rawText: '2 eetlepel olie', name: 'olie', quantity: 2, unit: 'eetlepel' },
      ]),
      makeSection(RID_B, 'B', [
        { rawText: '1 el olie', name: 'olie', quantity: 1, unit: 'el' },
      ]),
    ]
    const result = exactMerge(sections)
    expect(result.lines).toHaveLength(1)
    expect(result.lines[0].quantity).toBe(3)
    expect(result.lines[0].unit).toBe('el')
  })
})

describe('buildPolishContext', () => {
  it('builds context JSON from baseline with stable ids, quantities, units, provenance', () => {
    const sections: ShoppingListSection[] = [
      makeSection(RID_A, 'Pasta', [
        { rawText: '400 g pasta', name: 'pasta', quantity: 400, unit: 'g' },
      ]),
      makeSection(RID_B, 'Salad', [
        { rawText: '100 g tomaten', name: 'tomaten', quantity: 100, unit: 'g' },
      ]),
    ]
    const baseline = exactMerge(sections)
    const context = buildPolishContext(baseline)

    expect(context.lines).toHaveLength(2)
    expect(context.lines[0]).toEqual({
      id: 'L1',
      name: 'pasta',
      quantity: 400,
      unit: 'g',
      provenance: [{ recipeId: RID_A, recipeTitle: 'Pasta' }],
    })
    expect(context.lines[1]).toEqual({
      id: 'L2',
      name: 'tomaten',
      quantity: 100,
      unit: 'g',
      provenance: [{ recipeId: RID_B, recipeTitle: 'Salad' }],
    })
  })

  it('returns empty lines array for empty baseline', () => {
    const context = buildPolishContext({ lines: [] })
    expect(context.lines).toEqual([])
  })

  it('preserves multi-recipe provenance in context', () => {
    const sections: ShoppingListSection[] = [
      makeSection(RID_A, 'A', [
        { rawText: '200 g kaas', name: 'kaas', quantity: 200, unit: 'g' },
      ]),
      makeSection(RID_B, 'B', [
        { rawText: '300 g kaas', name: 'kaas', quantity: 300, unit: 'g' },
      ]),
      makeSection(RID_C, 'C', [
        { rawText: '100 g kaas', name: 'kaas', quantity: 100, unit: 'g' },
      ]),
    ]
    const baseline = exactMerge(sections)
    const context = buildPolishContext(baseline)

    expect(context.lines[0].provenance).toHaveLength(3)
    expect(context.lines[0].quantity).toBe(600)
  })
})
