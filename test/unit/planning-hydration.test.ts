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

  it('loads and returns the template row for a valid id', async () => {
    const { fetcher, mock } = createFetcherMock()
    const body = emptyWeekPlan()
    mock.mockResolvedValue({ id: 'tpl-1', body })
    const result = await fetchWeekTemplateRowForPlanner(fetcher, ' tpl-1 ')
    expect(mock).toHaveBeenCalledWith('/api/v1/planning/week-templates/tpl-1')
    expect(result).toEqual({ ok: true, id: 'tpl-1', body })
  })

  it('returns ok false when fetching template row fails', async () => {
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
