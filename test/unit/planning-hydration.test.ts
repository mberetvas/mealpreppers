import { describe, expect, it, vi } from 'vitest'
import type { $Fetch } from 'ofetch'
import { fetchMonthPlanBodyForPlanner, fetchWeekTemplateRowForPlanner } from '../../utils/planningHydration'
import { emptyMonthPlan, emptyWeekPlan } from '../../utils/weekPlan'

/** Builds a typed fetcher mock for planner hydration tests. */
function createFetcherMock(): { fetcher: $Fetch, mock: ReturnType<typeof vi.fn> } {
  const mock = vi.fn()
  return { fetcher: mock as unknown as $Fetch, mock }
}

describe('fetchWeekTemplateRowForPlanner', () => {
  it('returns ok false for a blank template id', async () => {
    const { fetcher, mock } = createFetcherMock()
    const result = await fetchWeekTemplateRowForPlanner(fetcher, '   ')
    expect(result).toEqual({ ok: false })
    expect(mock).not.toHaveBeenCalled()
  })

  it('loads from saved-weekplans when available', async () => {
    const { fetcher, mock } = createFetcherMock()
    const body = emptyWeekPlan()
    mock.mockResolvedValue({ id: 'sw-1', body, name: 'Lunch week' })
    const result = await fetchWeekTemplateRowForPlanner(fetcher, ' sw-1 ')
    expect(mock).toHaveBeenCalledWith('/api/v1/saved-weekplans/sw-1')
    expect(result).toEqual({
      ok: true,
      id: 'sw-1',
      body,
      name: 'Lunch week',
      source: 'saved-weekplan',
    })
  })

  it('falls back to week-templates when saved-weekplans fetch fails', async () => {
    const { fetcher, mock } = createFetcherMock()
    const body = emptyWeekPlan()
    mock.mockImplementation(async (url: string) => {
      if (url.includes('saved-weekplans')) {
        throw new Error('not found')
      }
      if (url.includes('week-templates')) {
        return { id: 'tpl-1', body, name: 'Legacy' }
      }
      throw new Error(`unexpected url ${url}`)
    })
    const result = await fetchWeekTemplateRowForPlanner(fetcher, 'tpl-1')
    expect(mock).toHaveBeenCalledWith('/api/v1/saved-weekplans/tpl-1')
    expect(mock).toHaveBeenCalledWith('/api/v1/planning/week-templates/tpl-1')
    expect(result).toEqual({
      ok: true,
      id: 'tpl-1',
      body,
      name: 'Legacy',
      source: 'week-template',
    })
  })

  it('returns ok false when both saved and legacy fetches fail', async () => {
    const { fetcher, mock } = createFetcherMock()
    mock.mockRejectedValue(new Error('boom'))
    const result = await fetchWeekTemplateRowForPlanner(fetcher, 'tpl-1')
    expect(result).toEqual({ ok: false })
  })
})

describe('fetchMonthPlanBodyForPlanner', () => {
  it('loads and returns month plan body for an active id', async () => {
    const { fetcher, mock } = createFetcherMock()
    const body = emptyMonthPlan()
    mock.mockResolvedValue({ body })
    const result = await fetchMonthPlanBodyForPlanner(fetcher, 'm1')
    expect(mock).toHaveBeenCalledWith('/api/v1/planning/month-plans/m1')
    expect(result).toEqual({ ok: true, body })
  })

  it('returns ok false when month plan fetch fails', async () => {
    const { fetcher, mock } = createFetcherMock()
    mock.mockRejectedValue(new Error('boom'))
    const result = await fetchMonthPlanBodyForPlanner(fetcher, 'm1')
    expect(result).toEqual({ ok: false })
  })
})
