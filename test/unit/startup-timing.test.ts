import { describe, expect, it } from 'vitest'
import { isStartupTimingEnabled } from '../../server/utils/startupTiming'

describe('isStartupTimingEnabled', () => {
  it('is false unless MEALPREPPER_STARTUP_TIMING is exactly 1', () => {
    const prev = process.env.MEALPREPPER_STARTUP_TIMING
    try {
      delete process.env.MEALPREPPER_STARTUP_TIMING
      expect(isStartupTimingEnabled()).toBe(false)

      process.env.MEALPREPPER_STARTUP_TIMING = 'true'
      expect(isStartupTimingEnabled()).toBe(false)

      process.env.MEALPREPPER_STARTUP_TIMING = '1'
      expect(isStartupTimingEnabled()).toBe(true)
    }
    finally {
      if (prev === undefined) {
        delete process.env.MEALPREPPER_STARTUP_TIMING
      }
      else {
        process.env.MEALPREPPER_STARTUP_TIMING = prev
      }
    }
  })
})
