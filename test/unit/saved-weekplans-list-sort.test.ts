import { describe, expect, it } from 'vitest'
import { sortSavedWeekplanListItems } from '../../utils/savedWeekplansListSort'

describe('sortSavedWeekplanListItems', () => {
  const items = [
    { id: 'a', name: 'Zebra', updatedAt: '2026-01-01T00:00:00.000Z' },
    { id: 'b', name: 'Alpha', updatedAt: '2026-06-01T12:00:00.000Z' },
    { id: 'c', name: 'Mike', updatedAt: '2026-03-15T08:00:00.000Z' },
  ]

  it('sorts by updated descending when mode is updated', () => {
    const sorted = sortSavedWeekplanListItems(items, 'updated')
    expect(sorted.map(i => i.id)).toEqual(['b', 'c', 'a'])
  })

  it('sorts by name case-insensitively when mode is name', () => {
    const sorted = sortSavedWeekplanListItems(items, 'name')
    expect(sorted.map(i => i.id)).toEqual(['b', 'c', 'a'])
  })

  it('does not mutate the original array', () => {
    const copy = [...items]
    sortSavedWeekplanListItems(copy, 'name')
    expect(copy[0]?.id).toBe('a')
  })
})
