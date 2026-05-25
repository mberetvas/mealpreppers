import { describe, expect, it, vi } from 'vitest'
import type { $Fetch } from 'ofetch'
import { fetchMonthPlanBodyForPlanner, fetchSavedWeekplanForPlanner } from '../../utils/planningHydration'
import { emptyMonthPlan, emptyWeekPlan } from '../../utils/weekPlan'

/** Builds a typed fetcher mock for planner hydration tests. */
function createFetcherMock(): { fetcher: $Fetch, mock: ReturnType<typeof vi.fn> } {
  const mock = vi.fn()
  return { fetcher: mock as unknown as $Fetch, mock }
}

describe('fetchSavedWeekplanForPlanner', () => {
  it('returns ok false for a blank template id', async () => {
    const { fetcher, mock } = createFetcherMock()
    const result = await fetchSavedWeekplanForPlanner(fetcher, '   ')
    expect(result).toEqual({ ok: false })
    expect(mock).not.toHaveBeenCalled()
  })

  it('loads from saved-weekplans when available', async () => {
    const { fetcher, mock } = createFetcherMock()
    const body = emptyWeekPlan()
    mock.mockResolvedValue({ id: 'sw-1', body, name: 'Lunch week' })
    const result = await fetchSavedWeekplanForPlanner(fetcher, ' sw-1 ')
    expect(mock).toHaveBeenCalledWith('/api/v1/saved-weekplans/sw-1')
    expect(result).toEqual({
      ok: true,
      id: 'sw-1',
      body,
      name: 'Lunch week',
    })
  })

  it('returns ok false when saved-weekplans returns 404 (no legacy fallback)', async () => {
    const { fetcher, mock } = createFetcherMock()
    mock.mockRejectedValue(Object.assign(new Error('not found'), { statusCode: 404 }))
    const result = await fetchSavedWeekplanForPlanner(fetcher, 'tpl-1')
    expect(mock).toHaveBeenCalledTimes(1)
    expect(mock).toHaveBeenCalledWith('/api/v1/saved-weekplans/tpl-1')
    expect(result).toEqual({ ok: false })
  })

  it('returns ok false on 403 without a second fetch', async () => {
    const { fetcher, mock } = createFetcherMock()
    mock.mockRejectedValue(Object.assign(new Error('forbidden'), { statusCode: 403 }))
    const result = await fetchSavedWeekplanForPlanner(fetcher, 'tpl-1')
    expect(mock).toHaveBeenCalledTimes(1)
    expect(mock).toHaveBeenCalledWith('/api/v1/saved-weekplans/tpl-1')
    expect(result).toEqual({ ok: false })
  })

  it('returns ok false on 500 without a second fetch', async () => {
    const { fetcher, mock } = createFetcherMock()
    mock.mockRejectedValue(Object.assign(new Error('server error'), { statusCode: 500 }))
    const result = await fetchSavedWeekplanForPlanner(fetcher, 'tpl-1')
    expect(mock).toHaveBeenCalledTimes(1)
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
