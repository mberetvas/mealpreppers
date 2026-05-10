import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyWeekPlan } from '../../utils/weekPlan'
import {
  buildPlannerWeekPatchInput,
  createPlanningMonthAutosave,
  createPlanningWeekAutosave,
} from '../../utils/planningAutosave'

/** Flushes pending promise microtasks after timer callbacks run. */
async function flushMicrotasks(): Promise<void> {
  await Promise.resolve()
}

describe('createPlanningWeekAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('marks dirty and skips patch when no template is linked', () => {
    const patch = vi.fn().mockResolvedValue(undefined)
    const onDirty = vi.fn()
    const ctrl = createPlanningWeekAutosave({
      debounceMs: 700,
      getTemplateId: () => null,
      getWeekBody: () => emptyWeekPlan(),
      patch,
      onDirty,
      onSaving: vi.fn(),
      onSaved: vi.fn(),
      onError: vi.fn(),
    })
    ctrl.notifyWeekPlanChanged()
    expect(onDirty).toHaveBeenCalledTimes(1)
    expect(patch).not.toHaveBeenCalled()
  })

  it('debounces patch until the delay elapses', async () => {
    const patch = vi.fn().mockResolvedValue(undefined)
    const onSaved = vi.fn()
    const ctrl = createPlanningWeekAutosave({
      debounceMs: 700,
      getTemplateId: () => 'tpl-1',
      getWeekBody: () => emptyWeekPlan(),
      patch,
      onDirty: vi.fn(),
      onSaving: vi.fn(),
      onSaved,
      onError: vi.fn(),
    })
    ctrl.notifyWeekPlanChanged()
    expect(patch).not.toHaveBeenCalled()
    vi.advanceTimersByTime(700)
    await flushMicrotasks()
    expect(patch).toHaveBeenCalledTimes(1)
    expect(patch).toHaveBeenCalledWith('tpl-1', { body: emptyWeekPlan() })
    expect(onSaved).toHaveBeenCalledTimes(1)
  })

  it('coalesces rapid changes into a single patch', async () => {
    const patch = vi.fn().mockResolvedValue(undefined)
    const ctrl = createPlanningWeekAutosave({
      debounceMs: 700,
      getTemplateId: () => 'tpl-1',
      getWeekBody: () => emptyWeekPlan(),
      patch,
      onDirty: vi.fn(),
      onSaving: vi.fn(),
      onSaved: vi.fn(),
      onError: vi.fn(),
    })
    ctrl.notifyWeekPlanChanged()
    vi.advanceTimersByTime(699)
    ctrl.notifyWeekPlanChanged()
    vi.advanceTimersByTime(700)
    await flushMicrotasks()
    expect(patch).toHaveBeenCalledTimes(1)
    expect(patch).toHaveBeenCalledWith('tpl-1', { body: emptyWeekPlan() })
  })

  it('includes trimmed name in patch when getWeekName is provided', async () => {
    const patch = vi.fn().mockResolvedValue(undefined)
    const body = emptyWeekPlan()
    const ctrl = createPlanningWeekAutosave({
      debounceMs: 700,
      getTemplateId: () => 'tpl-1',
      getWeekBody: () => body,
      getWeekName: () => '  Hello ',
      patch,
      onDirty: vi.fn(),
      onSaving: vi.fn(),
      onSaved: vi.fn(),
      onError: vi.fn(),
    })
    ctrl.notifyWeekPlanChanged()
    vi.advanceTimersByTime(700)
    await flushMicrotasks()
    expect(patch).toHaveBeenCalledWith('tpl-1', { body, name: 'Hello' })
  })

  it('does not PATCH until an id exists (draft vs post-create)', async () => {
    const patch = vi.fn().mockResolvedValue(undefined)
    let id: string | null = null
    const ctrl = createPlanningWeekAutosave({
      debounceMs: 700,
      getTemplateId: () => id,
      getWeekBody: () => emptyWeekPlan(),
      getWeekName: () => 'Titled',
      patch,
      onDirty: vi.fn(),
      onSaving: vi.fn(),
      onSaved: vi.fn(),
      onError: vi.fn(),
    })
    ctrl.notifyWeekPlanChanged()
    vi.advanceTimersByTime(700)
    await flushMicrotasks()
    expect(patch).not.toHaveBeenCalled()
    id = 'new-1'
    ctrl.notifyWeekPlanChanged()
    vi.advanceTimersByTime(700)
    await flushMicrotasks()
    expect(patch).toHaveBeenCalledTimes(1)
    expect(patch).toHaveBeenCalledWith('new-1', { body: emptyWeekPlan(), name: 'Titled' })
  })
})

describe('buildPlannerWeekPatchInput', () => {
  it('adds trimmed name when getter returns spaced text', () => {
    const body = emptyWeekPlan()
    const input = buildPlannerWeekPatchInput(body, () => '  Hi  ')
    expect(input).toEqual({ body, name: 'Hi' })
  })

  it('omits name for whitespace-only title', () => {
    const body = emptyWeekPlan()
    const input = buildPlannerWeekPatchInput(body, () => '   ')
    expect(input).toEqual({ body })
  })
})

describe('createPlanningMonthAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('does nothing when no month plan is active', async () => {
    const patch = vi.fn().mockResolvedValue(undefined)
    const ctrl = createPlanningMonthAutosave({
      debounceMs: 800,
      getMonthPlanId: () => null,
      getBody: () => ({ version: 'month_v1', weeks: [null, null, null, null] }),
      patch,
    })
    ctrl.notifyMonthPlanChanged()
    vi.advanceTimersByTime(800)
    await flushMicrotasks()
    expect(patch).not.toHaveBeenCalled()
  })

  it('debounces month patch', async () => {
    const patch = vi.fn().mockResolvedValue(undefined)
    const body = { version: 'month_v1' as const, weeks: [null, null, null, null] as const }
    const ctrl = createPlanningMonthAutosave({
      debounceMs: 800,
      getMonthPlanId: () => 'm1',
      getBody: () => body,
      patch,
    })
    ctrl.notifyMonthPlanChanged()
    vi.advanceTimersByTime(800)
    await flushMicrotasks()
    expect(patch).toHaveBeenCalledWith('m1', body)
  })
})
